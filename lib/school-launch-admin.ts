import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { getSchoolLaunchRecord, getSchoolLaunchStatus } from "./school-launch";
import { notifyOwnerOfLaunchEvent } from "./launch-notifications";
import type {
  AppUser,
  ImplementationSpecialist,
  LaunchAuditAction,
  LaunchAuditLogEntry,
  LaunchSession,
  LaunchTaskOverride,
  School,
  SchoolLaunchPayment,
} from "./types";

// ─── Staff admin surface for the School Launch Package ────────────────────
//
// Everything in this module is superadmin-only (enforced by firestore.rules
// on schoolLaunches/, launchUploads/, and launchAuditLog/ — this file does
// not re-check role client-side beyond what the calling UI already gates,
// same convention as the rest of lib/db.ts). Every write here has a matching
// audit log entry — see LaunchAuditLogEntry in lib/types.ts. That's what
// lets "who marked this school as paid, and when" be an answerable
// question rather than something buried in Firestore console history.
//
// Known scaling limit, called out honestly rather than hidden: the school
// picker (getSchoolLaunchAdminSummaries) computes a full launch status per
// school, which costs several Firestore reads per school. Fine for the
// current pilot-stage school count; if the network grows into the
// hundreds, this should move to a materialized per-school summary doc
// (written by a Cloud Function on the underlying data changing) instead of
// computed live on every admin page load.
//
// The `idToken` parameter some functions below accept is the calling staff
// member's fresh Firebase ID token — passed straight through to
// notifyOwnerOfLaunchEvent so it can authenticate the best-effort push
// call to /api/notifications/send (same pattern app/teacher/page.tsx uses
// for teacher -> parent chat pushes). It's optional and omitting it just
// means the owner still gets the durable in-app notification, no push.

export interface AdminActor {
  uid: string;
  name: string;
}

export function actorFromAppUser(appUser: AppUser | null): AdminActor {
  return {
    uid: appUser?.uid ?? "unknown",
    name: appUser?.displayName || appUser?.email || "Unknown staff member",
  };
}

// ─── Shared write helpers ──────────────────────────────────────────────────

// setDoc(..., {merge:true}) so this works whether or not a schoolLaunches
// doc exists yet — no school is ever required to have one in advance (see
// normalizeSchoolLaunchRecord in lib/school-launch.ts). `undefined` values
// are converted to deleteField() since the Firestore SDK rejects raw
// `undefined` in a write payload.
async function writeLaunchRecordFields(schoolId: string, fields: Record<string, unknown>): Promise<void> {
  const ref = doc(db, "schoolLaunches", schoolId);
  const snap = await getDoc(ref);
  const now = new Date().toISOString();

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    sanitized[key] = value === undefined ? deleteField() : value;
  }

  await setDoc(ref, {
    schoolId,
    ...sanitized,
    updatedAt: now,
    ...(snap.exists() ? {} : { createdAt: now }),
  }, { merge: true });
}

// Audit logging is important but secondary to the write actually landing —
// if this fails (network blip, etc.) we don't want the staff member to
// think their change didn't take. Logged to console rather than silently
// dropped so it's visible in error monitoring.
async function safeLogAudit(
  schoolId: string,
  action: LaunchAuditAction,
  summary: string,
  actor: AdminActor,
  metadata?: Record<string, string>,
): Promise<void> {
  try {
    await addDoc(collection(db, "launchAuditLog"), {
      schoolId,
      action,
      summary,
      actorUid: actor.uid,
      actorName: actor.name,
      createdAt: new Date().toISOString(),
      ...(metadata ? { metadata } : {}),
    });
  } catch (err) {
    console.error("Failed to write launch audit log entry", { schoolId, action, err });
  }
}

// ─── Specialist ─────────────────────────────────────────────────────────────

export async function updateSpecialist(
  schoolId: string,
  specialist: ImplementationSpecialist | undefined,
  actor: AdminActor,
  idToken?: string,
): Promise<void> {
  await writeLaunchRecordFields(schoolId, { specialist });
  await safeLogAudit(
    schoolId,
    "specialist_updated",
    specialist ? `Specialist set to ${specialist.name}` : "Specialist unassigned",
    actor,
  );
  if (specialist) {
    await notifyOwnerOfLaunchEvent({
      schoolId,
      category: "specialist_assigned",
      title: "Your implementation specialist has been assigned",
      body: `${specialist.name} is now your point of contact for your School Launch Package.`,
      link: "/owner",
      actorIdToken: idToken,
    });
  }
}

// ─── Payment ────────────────────────────────────────────────────────────────

const PAYMENT_NOTIFICATION_COPY: Record<SchoolLaunchPayment["status"], string | null> = {
  unpaid: null, // resets are an internal correction, not owner-facing news
  invoiced: "An invoice for your School Launch Package is on its way.",
  paid: "Thanks. Your School Launch Package payment has been confirmed.",
  waived: "Your School Launch Package fee has been waived.",
};

export async function updatePayment(
  schoolId: string,
  payment: SchoolLaunchPayment,
  actor: AdminActor,
  idToken?: string,
): Promise<void> {
  const withTimestamp: SchoolLaunchPayment = {
    ...payment,
    paidAt: payment.status === "paid" ? (payment.paidAt ?? new Date().toISOString()) : payment.paidAt,
  };
  await writeLaunchRecordFields(schoolId, { payment: withTimestamp });
  await safeLogAudit(schoolId, "payment_updated", `Payment marked as ${payment.status}`, actor, { status: payment.status });

  const body = PAYMENT_NOTIFICATION_COPY[payment.status];
  if (body) {
    await notifyOwnerOfLaunchEvent({
      schoolId,
      category: "payment_updated",
      title: `${payment.packageName}: payment update`,
      body,
      link: "/owner",
      actorIdToken: idToken,
    });
  }
}

// ─── Target go-live date ────────────────────────────────────────────────────

export async function updateTargetGoLiveDate(
  schoolId: string,
  targetGoLiveDate: string | undefined,
  actor: AdminActor,
): Promise<void> {
  await writeLaunchRecordFields(schoolId, { targetGoLiveDate });
  await safeLogAudit(
    schoolId,
    "target_date_updated",
    targetGoLiveDate ? `Target launch date set to ${targetGoLiveDate}` : "Target launch date cleared",
    actor,
  );
}

// ─── Sessions ───────────────────────────────────────────────────────────────
// Sessions live as an array on the record rather than a subcollection (there
// are never more than a handful per school) — read-modify-write is safe here
// since this is a low-concurrency internal staff tool, not a high-write path.

export async function upsertLaunchSession(
  schoolId: string,
  session: Omit<LaunchSession, "id"> & { id?: string },
  actor: AdminActor,
  idToken?: string,
): Promise<void> {
  const record = await getSchoolLaunchRecord(schoolId);
  const isNew = !session.id;
  const finalSession: LaunchSession = { ...session, id: session.id ?? crypto.randomUUID() };
  const nextSessions = isNew
    ? [...record.sessions, finalSession]
    : record.sessions.map(s => (s.id === finalSession.id ? finalSession : s));

  await writeLaunchRecordFields(schoolId, { sessions: nextSessions });
  await safeLogAudit(
    schoolId,
    isNew ? "session_created" : "session_updated",
    `${isNew ? "Scheduled" : "Updated"} session: ${finalSession.title}`,
    actor,
    { sessionId: finalSession.id, status: finalSession.status },
  );

  const whenText = finalSession.scheduledAt
    ? new Date(finalSession.scheduledAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })
    : "a time to be confirmed";
  await notifyOwnerOfLaunchEvent({
    schoolId,
    category: isNew ? "session_scheduled" : "session_updated",
    title: isNew ? "A launch session has been scheduled" : "Your launch session was updated",
    body: `${finalSession.title}, ${whenText}.`,
    link: "/owner",
    actorIdToken: idToken,
  });
}

export async function removeLaunchSession(schoolId: string, sessionId: string, actor: AdminActor): Promise<void> {
  const record = await getSchoolLaunchRecord(schoolId);
  const removed = record.sessions.find(s => s.id === sessionId);
  const nextSessions = record.sessions.filter(s => s.id !== sessionId);

  await writeLaunchRecordFields(schoolId, { sessions: nextSessions });
  await safeLogAudit(
    schoolId,
    "session_removed",
    `Removed session${removed ? `: ${removed.title}` : ""}`,
    actor,
    { sessionId },
  );
}

// ─── Task overrides & go-live ───────────────────────────────────────────────
// Only for tasks with no derivable signal — team training, final readiness,
// and anything staff need to manually unblock. Passing null clears an
// override, falling back to the task's normal derivation.

export async function setTaskOverride(
  schoolId: string,
  taskKey: string,
  override: LaunchTaskOverride | null,
  actor: AdminActor,
): Promise<void> {
  const record = await getSchoolLaunchRecord(schoolId);
  const nextOverrides = { ...record.taskOverrides };
  if (override) nextOverrides[taskKey] = override;
  else delete nextOverrides[taskKey];

  await writeLaunchRecordFields(schoolId, { taskOverrides: nextOverrides });
  await safeLogAudit(
    schoolId,
    override ? "task_override_set" : "task_override_cleared",
    override ? `"${taskKey}" manually set to ${override.status}` : `"${taskKey}" override cleared`,
    actor,
    { taskKey },
  );
}

// goLive's status is derived purely from record.launchedAt (see
// lib/school-launch.ts deriveTaskStatus) — no taskOverrides entry needed,
// just set the timestamp that marks the school as live.
export async function markSchoolGoLive(schoolId: string, actor: AdminActor, idToken?: string): Promise<void> {
  await writeLaunchRecordFields(schoolId, { launchedAt: new Date().toISOString() });
  await safeLogAudit(schoolId, "go_live_marked", "School marked as live", actor);
  await notifyOwnerOfLaunchEvent({
    schoolId,
    category: "go_live",
    title: "Your school is now live on LittleLoop",
    body: "Your School Launch Package is complete. You're fully operational.",
    link: "/owner",
    actorIdToken: idToken,
  });
}

// ─── Upload review ──────────────────────────────────────────────────────────

export async function reviewLaunchUpload(
  uploadId: string,
  schoolId: string,
  decision: "under_review" | "needs_changes" | "accepted",
  reviewerUid: string,
  actor: AdminActor,
  feedback?: string,
  idToken?: string,
): Promise<void> {
  await updateDoc(doc(db, "launchUploads", uploadId), {
    status: decision,
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerUid,
    ...(feedback !== undefined ? { feedback } : {}),
  });

  const summary =
    decision === "accepted" ? "Upload accepted and imported"
    : decision === "needs_changes" ? "Upload sent back for changes"
    : "Upload marked as under review";
  await safeLogAudit(schoolId, "upload_reviewed", summary, actor, { uploadId, decision });

  // "under_review" is a staff-internal waypoint, not owner-actionable —
  // only tell the owner once there's something they'd actually do differently.
  if (decision === "accepted") {
    await notifyOwnerOfLaunchEvent({
      schoolId,
      category: "upload_reviewed",
      title: "Your data submission was imported",
      body: "We've reviewed and imported your file. No action needed.",
      link: "/owner",
      actorIdToken: idToken,
    });
  } else if (decision === "needs_changes") {
    await notifyOwnerOfLaunchEvent({
      schoolId,
      category: "upload_reviewed",
      title: "Your data submission needs a change",
      body: feedback?.trim() || "We found something that needs fixing before we can import it. Please re-upload.",
      link: "/owner",
      actorIdToken: idToken,
    });
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function getAuditLogForSchool(schoolId: string, take = 50): Promise<LaunchAuditLogEntry[]> {
  const q = query(
    collection(db, "launchAuditLog"),
    where("schoolId", "==", schoolId),
    orderBy("createdAt", "desc"),
    limit(take),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as LaunchAuditLogEntry);
}

export interface SchoolLaunchAdminSummary {
  schoolId: string;
  progressPct: number;
  isComplete: boolean;
  paymentStatus: SchoolLaunchPayment["status"];
  specialistName?: string;
  pendingUploadCount: number;
  blockerCount: number;
}

// One entry per school, for the admin picker list — see the scaling note
// at the top of this file.
export async function getSchoolLaunchAdminSummaries(schools: School[]): Promise<Record<string, SchoolLaunchAdminSummary>> {
  const entries = await Promise.all(schools.map(async (school): Promise<[string, SchoolLaunchAdminSummary]> => {
    const status = await getSchoolLaunchStatus(school.id, school, null);
    const pendingUploadCount = Object.values(status.uploads)
      .filter(u => u && (u.status === "submitted" || u.status === "under_review"))
      .length;
    return [school.id, {
      schoolId: school.id,
      progressPct: status.progressPct,
      isComplete: status.isComplete,
      paymentStatus: status.payment.status,
      specialistName: status.specialist?.name,
      pendingUploadCount,
      blockerCount: status.blockers.length,
    }];
  }));
  return Object.fromEntries(entries);
}

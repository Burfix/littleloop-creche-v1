import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { countWhere } from "./onboarding";
import { getLatestLaunchUploads } from "./launch-uploads";
import type {
  AppUser,
  ImplementationSpecialist,
  LaunchSession,
  LaunchStageKey,
  LaunchTaskStatus,
  LaunchUpload,
  LaunchUploadKind,
  School,
  SchoolLaunchPayment,
  SchoolLaunchRecord,
  SchoolLaunchStage,
  SchoolLaunchStatus,
  SchoolLaunchTask,
} from "./types";

// ─── School Launch ("School Launch Package" paid onboarding) ─────────────────
//
// This module supersedes the visible onboarding UI over time but does NOT
// replace lib/onboarding.ts (still used by the shipped onboarding screens
// and OnboardingChecklist) — the two coexist. Everything here is additive:
// no existing school loses data or breaks because a SchoolLaunchRecord
// doesn't exist for it yet (see normalizeSchoolLaunchRecord).
//
// Design principle: computeSchoolLaunchStatus is a pure function of plain
// data (no Firestore, no network). getSchoolLaunchStatus is the thin async
// wrapper that fetches the inputs. Keeping the derivation pure is what
// makes progress/readiness logic unit-testable without mocking Firebase.

// Feature flag: onboarding payment enforcement is NOT wired to block
// anything yet. Flip this to true once the business is ready to actually
// gate launch readiness on payment — until then it only affects whether
// "onboarding payment complete" shows as required or recommended.
export const ENFORCE_ONBOARDING_PAYMENT = false;

export const DEFAULT_LAUNCH_PACKAGE_NAME = "School Launch Package";

// Typed fallback so components never have to special-case "no specialist
// assigned yet" — render this and show a calm "not yet assigned" state
// rather than crashing or hardcoding a real person's details.
export const UNASSIGNED_SPECIALIST: ImplementationSpecialist = {
  id: "unassigned",
  name: "Not yet assigned",
  role: "Implementation Specialist",
  initials: "?",
};

// Which upload kind (if any) backs a given task — shared with the UI layer
// so LaunchTaskCard knows which LaunchUpload to show/act on for a task
// without duplicating this mapping.
export const TASK_KEY_TO_UPLOAD_KIND: Partial<Record<string, LaunchUploadKind>> = {
  uploadEnrolmentList: "children",
  inviteTeachers: "teachers",
  inviteParents: "parents",
  provideFeeStructure: "feeStructure",
};

const DEFAULT_PAYMENT: SchoolLaunchPayment = {
  status: "unpaid",
  packageName: DEFAULT_LAUNCH_PACKAGE_NAME,
  amountCents: 0, // set per-contract by LittleLoop staff — 0 means "not yet set", not "free"
};

// ─── Stage/task templates ─────────────────────────────────────────────────
// Static shape of the 10-stage journey. `status` here is a placeholder —
// computeSchoolLaunchStatus fills in the real status for every task based
// on derived signals + stored overrides before returning it.

interface TaskTemplate {
  key: string;
  title: string;
  description?: string;
  responsibility: SchoolLaunchTask["responsibility"];
  required: boolean;
  actionType: SchoolLaunchTask["actionType"];
  actionHref?: string;
  secondaryActionHref?: string;
  secondaryActionLabel?: string;
}

interface StageTemplate {
  key: LaunchStageKey;
  title: string;
  description: string;
  tasks: TaskTemplate[];
}

const STAGE_TEMPLATES: StageTemplate[] = [
  {
    key: "welcome",
    title: "Welcome",
    description: "A quick introduction to your School Launch Workspace.",
    tasks: [
      { key: "welcomeAcknowledged", title: "Welcome to LittleLoop", responsibility: "shared", required: true, actionType: "confirmation" },
    ],
  },
  {
    key: "schoolProfile",
    title: "School profile",
    description: "Confirm the details that identify your school.",
    tasks: [
      { key: "confirmSchoolDetails", title: "Confirm your school details", description: "Your school name and subdomain.", responsibility: "school", required: true, actionType: "manual_form", actionHref: "/onboarding/school-setup" },
    ],
  },
  {
    key: "childrenImport",
    title: "Children import",
    description: "Get your enrolled children into LittleLoop.",
    tasks: [
      {
        key: "uploadEnrolmentList", title: "Upload your enrolment list",
        description: "We'll clean and import the information for you. You do not need to add every child manually.",
        responsibility: "school", required: true, actionType: "upload",
        secondaryActionHref: "/onboarding/add-child", secondaryActionLabel: "Add manually instead",
      },
      { key: "validateImportedChildren", title: "LittleLoop validates imported data", description: "We check for duplicates and missing details.", responsibility: "littleloop", required: false, actionType: "none" },
    ],
  },
  {
    key: "classes",
    title: "Classes",
    description: "Group children by age so attendance and daily updates work together.",
    tasks: [
      { key: "createFirstClass", title: "Create your first class", responsibility: "school", required: true, actionType: "manual_form", actionHref: "/onboarding/classes" },
    ],
  },
  {
    key: "teachers",
    title: "Teachers",
    description: "Invite the staff who'll run daily attendance and updates.",
    tasks: [
      {
        key: "inviteTeachers", title: "Upload your teacher list",
        description: "We'll set up teacher accounts for you. You do not need to invite each teacher one by one.",
        responsibility: "school", required: true, actionType: "upload",
        secondaryActionHref: "/onboarding/invite", secondaryActionLabel: "Invite manually instead",
      },
    ],
  },
  {
    key: "parents",
    title: "Parents",
    description: "Connect parents so they can see their child's day and pay fees.",
    tasks: [
      {
        key: "inviteParents", title: "Upload your parent list",
        description: "We'll link parents to their children for you. You do not need to invite each parent one by one.",
        responsibility: "school", required: true, actionType: "upload",
        secondaryActionHref: "/onboarding/invite", secondaryActionLabel: "Invite manually instead",
      },
      { key: "parentInvitationReview", title: "Parent invitation review", description: "We'll check every child has a linked parent.", responsibility: "shared", required: false, actionType: "none" },
    ],
  },
  {
    key: "billingConfiguration",
    title: "Billing configuration",
    description: "Set up your fee structure so invoicing is ready from day one.",
    tasks: [
      {
        key: "provideFeeStructure", title: "Upload your fee structure",
        description: "Send us your fee list and we'll configure billing for you.",
        responsibility: "school", required: true, actionType: "upload",
        secondaryActionHref: "/onboarding/billing", secondaryActionLabel: "Create an invoice manually instead",
      },
      { key: "littleLoopPreparesBilling", title: "LittleLoop prepares billing", responsibility: "littleloop", required: false, actionType: "none" },
    ],
  },
  {
    key: "teamTraining",
    title: "Team training",
    description: "A short session to get your team comfortable with LittleLoop.",
    tasks: [
      { key: "completeTeacherTraining", title: "Complete teacher training", description: "We'll walk your team through daily attendance, updates and messaging.", responsibility: "shared", required: true, actionType: "none" },
    ],
  },
  {
    key: "launchReadiness",
    title: "Launch readiness",
    description: "A final check before your school goes live.",
    tasks: [
      { key: "finalReadinessConfirmation", title: "Final readiness confirmation", description: "LittleLoop confirms everything is in place.", responsibility: "littleloop", required: true, actionType: "none" },
    ],
  },
  {
    key: "goLive",
    title: "Go live",
    description: "Your school becomes fully operational on LittleLoop.",
    tasks: [
      { key: "goLive", title: "Go live", responsibility: "littleloop", required: true, actionType: "none" },
    ],
  },
];

// ─── Normalization ─────────────────────────────────────────────────────────

/**
 * Defensive normalization at the read boundary, same philosophy as
 * normalizeSchool in lib/db.ts — a school that predates this feature (i.e.
 * every school today) has no schoolLaunches doc at all, and that must
 * produce sensible defaults rather than an error.
 */
export function normalizeSchoolLaunchRecord(schoolId: string, data: Partial<SchoolLaunchRecord> | null): SchoolLaunchRecord {
  return {
    schoolId,
    targetGoLiveDate: data?.targetGoLiveDate,
    specialist: data?.specialist,
    payment: data?.payment ?? DEFAULT_PAYMENT,
    sessions: Array.isArray(data?.sessions) ? data!.sessions : [],
    taskOverrides: data?.taskOverrides ?? {},
    launchedAt: data?.launchedAt,
    createdAt: data?.createdAt ?? new Date(0).toISOString(),
    updatedAt: data?.updatedAt ?? new Date(0).toISOString(),
  };
}

export async function getSchoolLaunchRecord(schoolId: string): Promise<SchoolLaunchRecord> {
  const snap = await getDoc(doc(db, "schoolLaunches", schoolId));
  return normalizeSchoolLaunchRecord(schoolId, snap.exists() ? (snap.data() as Partial<SchoolLaunchRecord>) : null);
}

// ─── Pure status computation ───────────────────────────────────────────────

export interface DerivedCounts {
  childCount: number;
  classCount: number;
  teacherCount: number;
  parentCount: number;
  invoiceCount: number;
}

export interface ComputeStatusInput {
  school: School | null;
  hasSeenWelcome: boolean;
  counts: DerivedCounts;
  record: SchoolLaunchRecord;
  uploads: Partial<Record<LaunchUploadKind, LaunchUpload>>;
}

// An uploaded file takes precedence over the count-based signal — an owner
// who's submitted a file is actively going through the assisted path, even
// before LittleLoop has imported anything into the real collections yet.
// Falls back to the manual/count-based signal when no upload exists at all
// (covers both "did it manually instead" and schools that predate uploads).
function deriveUploadBackedTaskStatus(
  upload: LaunchUpload | undefined,
  fallbackDone: boolean,
): { status: LaunchTaskStatus; blockingReason?: string } {
  if (upload) {
    switch (upload.status) {
      case "accepted": return { status: "completed" };
      case "needs_changes": return { status: "needs_changes", blockingReason: upload.feedback };
      case "under_review": return { status: "under_review" };
      case "submitted": return { status: "submitted" };
    }
  }
  return { status: fallbackDone ? "completed" : "waiting_for_school" };
}

// Companion informational task (e.g. "LittleLoop validates imported data")
// mirrors the same upload's review state — not_applicable when there's
// nothing to review yet (no upload, or the upload was just submitted and
// review hasn't started).
function deriveUploadReviewStatus(upload: LaunchUpload | undefined): LaunchTaskStatus {
  if (!upload) return "not_applicable";
  if (upload.status === "accepted") return "completed";
  if (upload.status === "needs_changes") return "needs_changes";
  if (upload.status === "under_review") return "under_review";
  return "not_applicable";
}

function deriveTaskStatus(
  template: TaskTemplate,
  input: ComputeStatusInput,
): { status: LaunchTaskStatus; completedAt?: string; completedBy?: string; blockingReason?: string; notes?: string } {
  const override = input.record.taskOverrides[template.key];
  if (override) return override;

  const { school, hasSeenWelcome, counts, record, uploads } = input;

  switch (template.key) {
    case "welcomeAcknowledged":
      return { status: hasSeenWelcome ? "completed" : "not_started" };
    case "confirmSchoolDetails":
      return { status: school?.name ? "completed" : "waiting_for_school" };
    case "uploadEnrolmentList":
      return deriveUploadBackedTaskStatus(uploads.children, counts.childCount > 0);
    case "validateImportedChildren":
      return { status: deriveUploadReviewStatus(uploads.children) };
    case "createFirstClass":
      return { status: counts.classCount > 0 ? "completed" : "waiting_for_school" };
    case "inviteTeachers":
      return deriveUploadBackedTaskStatus(uploads.teachers, counts.teacherCount > 0);
    case "inviteParents":
      return deriveUploadBackedTaskStatus(uploads.parents, counts.parentCount > 0);
    case "parentInvitationReview":
      return { status: deriveUploadReviewStatus(uploads.parents) };
    case "provideFeeStructure":
      return deriveUploadBackedTaskStatus(uploads.feeStructure, counts.invoiceCount > 0);
    case "littleLoopPreparesBilling":
      return { status: deriveUploadReviewStatus(uploads.feeStructure) };
    case "completeTeacherTraining": {
      const trainingSession = record.sessions.find(s => s.type === "teacher_training");
      if (trainingSession?.status === "completed") return { status: "completed" };
      if (trainingSession?.status === "scheduled") return { status: "scheduled" };
      return { status: "not_started" };
    }
    case "finalReadinessConfirmation":
      // Computed below in computeSchoolLaunchStatus once every other
      // stage's required tasks are known — placeholder here, overwritten
      // after the full task list is built.
      return { status: "not_started" };
    case "goLive":
      return { status: record.launchedAt ? "completed" : "not_started" };
    default:
      return { status: "not_started" };
  }
}

export function computeSchoolLaunchStatus(input: ComputeStatusInput): SchoolLaunchStatus {
  let taskSortOrder = 0;
  const stages: SchoolLaunchStage[] = STAGE_TEMPLATES.map((stageTemplate, stageIndex) => {
    const tasks: SchoolLaunchTask[] = stageTemplate.tasks.map(taskTemplate => {
      const derived = deriveTaskStatus(taskTemplate, input);
      taskSortOrder += 1;
      return {
        id: `${stageTemplate.key}.${taskTemplate.key}`,
        key: taskTemplate.key,
        title: taskTemplate.title,
        description: taskTemplate.description,
        stage: stageTemplate.key,
        status: derived.status,
        responsibility: taskTemplate.responsibility,
        required: taskTemplate.required,
        completedAt: derived.completedAt,
        completedBy: derived.completedBy,
        blockingReason: derived.blockingReason,
        actionType: taskTemplate.actionType,
        actionHref: taskTemplate.actionHref,
        secondaryActionHref: taskTemplate.secondaryActionHref,
        secondaryActionLabel: taskTemplate.secondaryActionLabel,
        notes: derived.notes,
        sortOrder: taskSortOrder,
      };
    });
    return {
      key: stageTemplate.key,
      title: stageTemplate.title,
      description: stageTemplate.description,
      sortOrder: stageIndex,
      tasks,
    };
  });

  // Launch readiness's own task is derived from every OTHER required task
  // being complete — compute it in a second pass now that we have the
  // full list, unless staff have explicitly overridden it (e.g. blocked
  // with a note about a data error).
  const readinessOverride = input.record.taskOverrides["finalReadinessConfirmation"];
  if (!readinessOverride) {
    const otherRequiredOutstanding = stages
      .filter(s => s.key !== "launchReadiness" && s.key !== "goLive")
      .flatMap(s => s.tasks)
      .some(t => t.required && t.status !== "completed" && t.status !== "not_applicable");
    const readinessStage = stages.find(s => s.key === "launchReadiness")!;
    readinessStage.tasks[0].status = otherRequiredOutstanding ? "not_started" : "completed";
  }

  const allTasks = stages.flatMap(s => s.tasks);
  const requiredTasks = allTasks.filter(t => t.required);
  const completedRequiredCount = requiredTasks.filter(t => t.status === "completed").length;
  const totalRequiredCount = requiredTasks.length;
  const progressPct = totalRequiredCount === 0 ? 0 : Math.round((completedRequiredCount / totalRequiredCount) * 100);
  const isComplete = totalRequiredCount > 0 && completedRequiredCount === totalRequiredCount;

  const outstandingStage = stages.find(s =>
    s.tasks.some(t => t.required && t.status !== "completed" && t.status !== "not_applicable")
  );

  const blockers = allTasks.filter(t => t.required && (t.status === "blocked" || t.status === "needs_changes"));

  const scheduledSessions = input.record.sessions
    .filter(s => s.status === "scheduled" && s.scheduledAt)
    .sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1));

  return {
    stages,
    completedRequiredCount,
    totalRequiredCount,
    progressPct,
    isComplete,
    currentStage: isComplete ? null : outstandingStage ?? null,
    blockers,
    targetGoLiveDate: input.record.targetGoLiveDate,
    specialist: input.record.specialist,
    payment: input.record.payment,
    nextSession: scheduledSessions[0],
    uploads: input.uploads,
  };
}

// ─── Async wrapper ──────────────────────────────────────────────────────────

export async function getSchoolLaunchStatus(schoolId: string, school: School | null, appUser: AppUser | null): Promise<SchoolLaunchStatus> {
  const [record, childCount, classCount, teacherCount, parentCount, invoiceCount, uploads] = await Promise.all([
    getSchoolLaunchRecord(schoolId),
    countWhere("children", schoolId),
    countWhere("classes", schoolId),
    countWhere("users", schoolId, ["role", "teacher"]),
    countWhere("users", schoolId, ["role", "parent"]),
    countWhere("invoices", schoolId),
    getLatestLaunchUploads(schoolId),
  ]);

  return computeSchoolLaunchStatus({
    school,
    hasSeenWelcome: !!appUser?.hasSeenOnboardingWelcome,
    counts: { childCount, classCount, teacherCount, parentCount, invoiceCount },
    record,
    uploads,
  });
}

// ─── Launch readiness panel ─────────────────────────────────────────────────

export interface ReadinessCheck {
  key: string;
  label: string;
  met: boolean;
  detail?: string;
}

export interface LaunchReadiness {
  requiredForLaunch: ReadinessCheck[];
  recommendedAfterLaunch: ReadinessCheck[];
  blockerMessages: string[];
  isReadyForLaunch: boolean;
}

function findTask(status: SchoolLaunchStatus, key: string): SchoolLaunchTask | undefined {
  return status.stages.flatMap(s => s.tasks).find(t => t.key === key);
}

export function getLaunchReadiness(status: SchoolLaunchStatus): LaunchReadiness {
  const isMet = (key: string) => findTask(status, key)?.status === "completed";
  const hasDataErrors = status.stages
    .flatMap(s => s.tasks)
    .some(t => t.status === "needs_changes");

  const requiredForLaunch: ReadinessCheck[] = [
    { key: "schoolProfile", label: "School profile confirmed", met: isMet("confirmSchoolDetails") },
    { key: "childrenImported", label: "Children imported", met: isMet("uploadEnrolmentList") },
    { key: "classCreated", label: "At least one class created", met: isMet("createFirstClass") },
    { key: "teachersInvited", label: "Teachers invited", met: isMet("inviteTeachers") },
    { key: "parentsLinked", label: "Parents linked", met: isMet("inviteParents") },
    { key: "billingConfigured", label: "Billing configured", met: isMet("provideFeeStructure") },
    { key: "teacherTrainingComplete", label: "Teacher training complete", met: isMet("completeTeacherTraining") },
    { key: "noCriticalDataErrors", label: "No critical data errors", met: !hasDataErrors },
  ];

  const recommendedAfterLaunch: ReadinessCheck[] = [];

  const paymentCheck: ReadinessCheck = {
    key: "onboardingPaymentComplete",
    label: "Onboarding payment complete",
    met: status.payment.status === "paid" || status.payment.status === "waived",
  };
  (ENFORCE_ONBOARDING_PAYMENT ? requiredForLaunch : recommendedAfterLaunch).push(paymentCheck);

  const blockerMessages = status.blockers.map(t => t.blockingReason ?? `${t.title} needs attention`);

  return {
    requiredForLaunch,
    recommendedAfterLaunch,
    blockerMessages,
    isReadyForLaunch: requiredForLaunch.every(c => c.met),
  };
}

// Re-exported for convenience so consumers don't need to import from both
// lib/types.ts and lib/school-launch.ts for the same conceptual domain.
export type { LaunchSession, ImplementationSpecialist, SchoolLaunchRecord, SchoolLaunchStatus };

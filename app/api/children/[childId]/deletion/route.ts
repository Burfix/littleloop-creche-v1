import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit";

// Tight limits: erasure is a destructive, irreversible operation.
// PATCH (soft-delete): 10 requests per hour per IP.
// DELETE (hard erase): 5 requests per hour per IP.
const SOFT_DELETE_RATE_LIMIT = { namespace: "child-erasure-request", limit: 10, windowSeconds: 3600 };
const HARD_DELETE_RATE_LIMIT = { namespace: "child-erasure-confirm", limit: 5, windowSeconds: 3600 };

type RouteContext = {
  params: Promise<{ childId: string }>;
};

const CASCADE_COLLECTIONS = ["daily_updates", "moments", "invoices"] as const;
const MAX_BATCH_WRITES = 450;

async function getAuthorizedRequest(req: NextRequest, childId: string) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  const auth = adminAuth();
  const db = adminDb();
  const decoded = await auth.verifyIdToken(token);
  const [userSnap, childSnap] = await Promise.all([
    db.collection("users").doc(decoded.uid).get(),
    db.collection("children").doc(childId).get(),
  ]);

  if (!userSnap.exists) {
    return { error: NextResponse.json({ error: "User profile not found" }, { status: 403 }) };
  }

  if (!childSnap.exists) {
    return { error: NextResponse.json({ error: "Child not found" }, { status: 404 }) };
  }

  const user = userSnap.data();
  const child = childSnap.data();
  const role = user?.role;
  const schoolId = child?.schoolId;
  const canDelete = role === "superadmin" || (role === "owner" && user?.schoolId === schoolId);

  if (!canDelete) {
    return { error: NextResponse.json({ error: "You do not have permission to erase this child" }, { status: 403 }) };
  }

  return { db, uid: decoded.uid, childRef: childSnap.ref, child };
}

async function deleteQuery(
  db: ReturnType<typeof adminDb>,
  collectionName: string,
  childId: string
): Promise<number> {
  const snap = await db.collection(collectionName).where("childId", "==", childId).get();
  let deleted = 0;

  for (let i = 0; i < snap.docs.length; i += MAX_BATCH_WRITES) {
    const batch = db.batch();
    const chunk = snap.docs.slice(i, i + MAX_BATCH_WRITES);
    chunk.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

async function deleteMessagesForChild(
  db: ReturnType<typeof adminDb>,
  schoolId: string,
  childId: string
): Promise<number> {
  const byChildIdSnap = await db.collection("messages").where("childId", "==", childId).get();
  const refs = new Map(byChildIdSnap.docs.map(doc => [doc.id, doc.ref]));

  const schoolMessagesSnap = await db.collection("messages").where("schoolId", "==", schoolId).get();
  schoolMessagesSnap.docs.forEach(doc => {
    const threadId = doc.data().threadId;
    if (typeof threadId === "string" && threadId.split("_").includes(childId)) {
      refs.set(doc.id, doc.ref);
    }
  });

  const docs = Array.from(refs.values());
  for (let i = 0; i < docs.length; i += MAX_BATCH_WRITES) {
    const batch = db.batch();
    docs.slice(i, i + MAX_BATCH_WRITES).forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  return docs.length;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const rateLimited = await enforceRateLimit(req, SOFT_DELETE_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const { childId } = await context.params;
    const authorized = await getAuthorizedRequest(req, childId);
    if ("error" in authorized) return authorized.error;

    const now = new Date().toISOString();
    await authorized.childRef.update({
      deletionStatus: "pending_erasure",
      deletionRequestedAt: now,
      deletionRequestedBy: authorized.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await authorized.db.collection("audit_logs").add({
      action: "child_erasure_requested",
      actorId: authorized.uid,
      childId,
      schoolId: authorized.child?.schoolId,
      createdAt: now,
    });

    return NextResponse.json({ success: true, deletionStatus: "pending_erasure" });
  } catch (err) {
    console.error("Request child erasure error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to request child erasure" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const rateLimited = await enforceRateLimit(req, HARD_DELETE_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const { childId } = await context.params;
    const { confirmName } = await req.json();
    const authorized = await getAuthorizedRequest(req, childId);
    if ("error" in authorized) return authorized.error;

    const firstName = String(authorized.child?.firstName ?? "").trim();
    const lastName = String(authorized.child?.lastName ?? "").trim();
    const fullName = `${firstName} ${lastName}`.trim();

    if (authorized.child?.deletionStatus !== "pending_erasure") {
      return NextResponse.json({ error: "Soft-delete the child before permanent erasure" }, { status: 409 });
    }

    if (confirmName !== fullName) {
      return NextResponse.json({ error: "Confirmation name does not match the child record" }, { status: 400 });
    }

    const schoolId = String(authorized.child?.schoolId ?? "");
    const deletedCounts: Record<string, number> = {};

    for (const collectionName of CASCADE_COLLECTIONS) {
      deletedCounts[collectionName] = await deleteQuery(authorized.db, collectionName, childId);
    }
    deletedCounts.messages = await deleteMessagesForChild(authorized.db, schoolId, childId);

    await authorized.childRef.delete();

    await authorized.db.collection("audit_logs").add({
      action: "child_erased",
      actorId: authorized.uid,
      childId,
      schoolId,
      deletedCounts,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, deletedCounts });
  } catch (err) {
    console.error("Erase child data error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to erase child data" },
      { status: 500 }
    );
  }
}

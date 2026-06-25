import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type RouteContext = { params: Promise<{ childId: string }> };

// ─── Auth helper ──────────────────────────────────────────────────────────────

type AllowedRole = "owner" | "teacher" | "superadmin" | "parent";

async function authorise(req: NextRequest, childId: string, allowed: AllowedRole[]) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return { error: NextResponse.json({ error: "Auth required" }, { status: 401 }) };

  const auth = adminAuth();
  const db = adminDb();

  const decoded = await auth.verifyIdToken(token);
  const [userSnap, childSnap] = await Promise.all([
    db.collection("users").doc(decoded.uid).get(),
    db.collection("children").doc(childId).get(),
  ]);

  if (!userSnap.exists) return { error: NextResponse.json({ error: "User not found" }, { status: 403 }) };
  if (!childSnap.exists) return { error: NextResponse.json({ error: "Child not found" }, { status: 404 }) };

  const user = userSnap.data()!;
  const child = childSnap.data()!;
  const role: AllowedRole = user.role;

  if (!allowed.includes(role)) {
    return { error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }) };
  }

  // Parents can only access their own children
  if (role === "parent" && !child.parentIds?.includes(decoded.uid)) {
    return { error: NextResponse.json({ error: "Access denied" }, { status: 403 }) };
  }

  // Teachers/owners must belong to the same school
  if (["teacher", "owner"].includes(role) && user.schoolId !== child.schoolId) {
    return { error: NextResponse.json({ error: "School mismatch" }, { status: 403 }) };
  }

  return { uid: decoded.uid, role, child, user };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { childId } = await params;
  const result = await authorise(req, childId, ["owner", "teacher", "superadmin", "parent"]);
  if ("error" in result) return result.error;

  const db = adminDb();
  const snap = await db.collection("medical_records").doc(childId).get();

  if (!snap.exists) {
    // Return empty scaffold — record may not have been created yet
    return NextResponse.json({ exists: false, data: null });
  }

  return NextResponse.json({ exists: true, data: { id: snap.id, ...snap.data() } });
}

// ─── PUT ─────────────────────────────────────────────────────────────────────
// Parents cannot write — only staff

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { childId } = await params;
  const result = await authorise(req, childId, ["owner", "teacher", "superadmin"]);
  if ("error" in result) return result.error;

  const db = adminDb();
  const body = await req.json();

  // Strip fields the caller should not set directly
  const {
    id: _id, childId: _cid, schoolId: _sid,
    createdAt: _ca, updatedAt: _ua, lastUpdatedBy: _lub,
    ...safeData
  } = body;

  const ref = db.collection("medical_records").doc(childId);
  const existing = await ref.get();

  // Get schoolId from the child record
  const childSnap = await db.collection("children").doc(childId).get();
  const schoolId: string = childSnap.data()!.schoolId;

  await ref.set(
    {
      ...safeData,
      childId,
      schoolId,
      updatedAt: FieldValue.serverTimestamp(),
      lastUpdatedBy: result.uid,
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );

  // Audit log
  await db.collection("audit_logs").add({
    action: "medical_record_updated",
    childId,
    schoolId,
    performedBy: result.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true });
}

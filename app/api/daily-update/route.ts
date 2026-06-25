import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { notifyParentsOfUpdate } from "@/lib/notify";

/**
 * POST /api/daily-update
 * Called by the teacher portal on first check-in to trigger parent notification.
 * Subsequent updates (mood, meals, nap, notes) still go direct via client SDK.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const db = adminDb();
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);

    // Must be a teacher or owner
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    if (!["teacher", "owner", "superadmin"].includes(role ?? "")) {
      return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
    }

    const { childId, schoolId } = await req.json();
    if (!childId || !schoolId) {
      return NextResponse.json({ error: "childId and schoolId required" }, { status: 400 });
    }

    // Get child to find parents + name
    const childSnap = await db.collection("children").doc(childId).get();
    if (!childSnap.exists) {
      return NextResponse.json({ error: "Child not found" }, { status: 404 });
    }
    const child = childSnap.data()!;
    const parentIds: string[] = child.parentIds ?? [];

    // Fire notification (non-blocking)
    if (parentIds.length) {
      notifyParentsOfUpdate(parentIds, child.firstName).catch(console.warn);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Daily update notify error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

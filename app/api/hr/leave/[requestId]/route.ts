import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type RouteContext = { params: Promise<{ requestId: string }> };

// PATCH — owner approves or declines
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { requestId } = await params;
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const db = adminDb();
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    if (!["owner", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }

    const reqSnap = await db.collection("leave_requests").doc(requestId).get();
    if (!reqSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (reqSnap.data()?.schoolId !== userSnap.data()?.schoolId) {
      return NextResponse.json({ error: "School mismatch" }, { status: 403 });
    }

    const { status, reviewNote } = await req.json();
    if (!["approved", "declined"].includes(status)) {
      return NextResponse.json({ error: "status must be approved or declined" }, { status: 400 });
    }

    await reqSnap.ref.update({
      status,
      reviewedBy: decoded.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewNote: reviewNote ?? "",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

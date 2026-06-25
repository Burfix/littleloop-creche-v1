import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

// POST — staff submits leave request
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const db = adminDb();
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const user = userSnap.data()!;
    if (!["teacher", "owner"].includes(user.role)) {
      return NextResponse.json({ error: "Staff access required" }, { status: 403 });
    }

    const { type, startDate, endDate, days, reason } = await req.json();
    if (!type || !startDate || !endDate || !days || !reason) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    const ref = await db.collection("leave_requests").add({
      schoolId: user.schoolId,
      staffUid: decoded.uid,
      staffName: user.displayName ?? user.email ?? decoded.uid,
      type, startDate, endDate, days, reason,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: ref.id });
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

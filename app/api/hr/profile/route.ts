import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

// GET /api/hr/profile?staffUid=xxx
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const staffUid = req.nextUrl.searchParams.get("staffUid");
  if (!staffUid) return NextResponse.json({ error: "staffUid required" }, { status: 400 });

  try {
    const db = adminDb();
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    const schoolId: string = userSnap.data()?.schoolId;

    // Owner sees any staff in their school; staff see only themselves
    if (!["owner", "superadmin"].includes(role) && decoded.uid !== staffUid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snap = await db.collection("hr_profiles").doc(staffUid).get();
    return NextResponse.json({ exists: snap.exists, data: snap.exists ? { id: snap.id, ...snap.data() } : null });
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PUT /api/hr/profile
export async function PUT(req: NextRequest) {
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
    const schoolId: string = userSnap.data()?.schoolId;

    const body = await req.json();
    const { staffUid, ...profileData } = body;
    if (!staffUid) return NextResponse.json({ error: "staffUid required" }, { status: 400 });

    // Verify staff belongs to this school
    const staffSnap = await db.collection("users").doc(staffUid).get();
    if (!staffSnap.exists || staffSnap.data()?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Staff not found in your school" }, { status: 404 });
    }

    const ref = db.collection("hr_profiles").doc(staffUid);
    const existing = await ref.get();
    await ref.set({
      ...profileData,
      uid: staffUid, schoolId,
      updatedAt: FieldValue.serverTimestamp(),
      lastUpdatedBy: decoded.uid,
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

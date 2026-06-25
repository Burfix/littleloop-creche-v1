import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type RouteContext = { params: Promise<{ entryId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { entryId } = await params;
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const db = adminDb();
  const auth = adminAuth();

  try {
    const decoded = await auth.verifyIdToken(token);
    const [userSnap, entrySnap] = await Promise.all([
      db.collection("users").doc(decoded.uid).get(),
      db.collection("waitlist").doc(entryId).get(),
    ]);

    const role = userSnap.data()?.role;
    if (!["owner", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }
    if (!entrySnap.exists) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    const entry = entrySnap.data()!;
    if (entry.schoolId !== userSnap.data()?.schoolId) {
      return NextResponse.json({ error: "School mismatch" }, { status: 403 });
    }

    const { action, internalNotes } = await req.json();

    if (action === "offer") {
      await entrySnap.ref.update({
        status: "offered",
        offeredAt: FieldValue.serverTimestamp(),
        offeredBy: decoded.uid,
        updatedAt: FieldValue.serverTimestamp(),
        ...(internalNotes !== undefined ? { internalNotes } : {}),
      });
      return NextResponse.json({ success: true });
    }

    if (action === "decline") {
      await entrySnap.ref.update({
        status: "declined",
        updatedAt: FieldValue.serverTimestamp(),
        ...(internalNotes !== undefined ? { internalNotes } : {}),
      });
      return NextResponse.json({ success: true });
    }

    if (action === "convert") {
      // Create an Admission from this waitlist entry
      const admissionRef = await db.collection("admissions").add({
        schoolId: entry.schoolId,
        childFirstName: entry.childFirstName,
        childLastName: entry.childLastName,
        childDateOfBirth: entry.childDateOfBirth,
        parentName: entry.parentName,
        parentEmail: entry.parentEmail,
        parentPhone: entry.parentPhone,
        desiredStartDate: entry.desiredStartDate ?? "",
        notes: entry.notes ?? "",
        internalNotes: internalNotes ?? "",
        status: "reviewing",
        reviewedBy: decoded.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await entrySnap.ref.update({
        status: "converted",
        convertedAt: FieldValue.serverTimestamp(),
        convertedToAdmissionId: admissionRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, admissionId: admissionRef.id });
    }

    if (action === "notes") {
      await entrySnap.ref.update({
        internalNotes: internalNotes ?? "",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Waitlist PATCH error:", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}

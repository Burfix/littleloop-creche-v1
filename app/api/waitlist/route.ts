import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit";

// POST /api/waitlist — public submission
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { namespace: "waitlist", limit: 5, windowSeconds: 300 });
  if (limited) return limited;

  try {
    const db = adminDb();
    const {
      schoolId, childFirstName, childLastName, childDateOfBirth,
      parentName, parentEmail, parentPhone, desiredStartDate, notes,
    } = await req.json();

    if (!schoolId || !childFirstName || !childLastName || !parentName || !parentEmail || !parentPhone) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Verify school exists
    const schoolSnap = await db.collection("schools").doc(schoolId).get();
    if (!schoolSnap.exists) return NextResponse.json({ error: "School not found" }, { status: 404 });

    // Get current waitlist size to assign position
    const countSnap = await db.collection("waitlist")
      .where("schoolId", "==", schoolId)
      .where("status", "in", ["waiting", "offered"])
      .count()
      .get();
    const position = countSnap.data().count + 1;

    await db.collection("waitlist").add({
      schoolId,
      childFirstName: childFirstName.trim(),
      childLastName: childLastName.trim(),
      childDateOfBirth: childDateOfBirth ?? "",
      parentName: parentName.trim(),
      parentEmail: parentEmail.trim().toLowerCase(),
      parentPhone: parentPhone.trim(),
      desiredStartDate: desiredStartDate ?? "",
      notes: notes?.trim() ?? "",
      internalNotes: "",
      position,
      status: "waiting",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, position });
  } catch (err) {
    console.error("Waitlist submit error:", err);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}

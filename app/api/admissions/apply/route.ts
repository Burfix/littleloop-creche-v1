import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(req, {
    namespace: "admissions-apply",
    limit: 5,
    windowSeconds: 300, // 5 submissions per IP per 5 minutes
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const {
      schoolId,
      childFirstName, childLastName, childDateOfBirth,
      parentName, parentEmail, parentPhone,
      desiredStartDate, notes,
    } = body;

    // Validate required fields
    const missing = [
      ["schoolId", schoolId],
      ["childFirstName", childFirstName],
      ["childLastName", childLastName],
      ["childDateOfBirth", childDateOfBirth],
      ["parentName", parentName],
      ["parentEmail", parentEmail],
      ["parentPhone", parentPhone],
    ].filter(([, v]) => !v?.toString().trim());

    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.map(([k]) => k).join(", ")}` },
        { status: 400 }
      );
    }

    if (!parentEmail.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Verify school exists
    const db = adminDb();
    const schoolSnap = await db.collection("schools").doc(schoolId).get();
    if (!schoolSnap.exists) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    // Create admission record
    const ref = await db.collection("admissions").add({
      schoolId,
      childFirstName: childFirstName.trim(),
      childLastName: childLastName.trim(),
      childDateOfBirth,
      parentName: parentName.trim(),
      parentEmail: parentEmail.trim().toLowerCase(),
      parentPhone: parentPhone.trim(),
      desiredStartDate: desiredStartDate ?? null,
      notes: notes?.trim() ?? null,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, admissionId: ref.id });
  } catch (err) {
    console.error("Admission apply error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Submission failed" },
      { status: 500 }
    );
  }
}

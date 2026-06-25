import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthorizedOwner(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice("Bearer ".length);
  if (!token) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  const db = adminDb();
  const auth = adminAuth();
  const decoded = await auth.verifyIdToken(token);
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 403 }) };
  }
  const user = userSnap.data()!;
  if (!["owner", "superadmin"].includes(user.role)) {
    return { error: NextResponse.json({ error: "Owner access required" }, { status: 403 }) };
  }
  return { uid: decoded.uid, user, db, auth };
}

// PATCH /api/admissions/[id] — approve or decline
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const authorized = await getAuthorizedOwner(req);
    if ("error" in authorized) return authorized.error;
    const { uid, user, db, auth } = authorized;

    const body = await req.json();
    const { action, internalNotes, classId } = body as {
      action: "approve" | "decline" | "reviewing";
      internalNotes?: string;
      classId?: string;
    };

    if (!["approve", "decline", "reviewing"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const admissionSnap = await db.collection("admissions").doc(id).get();
    if (!admissionSnap.exists) {
      return NextResponse.json({ error: "Admission not found" }, { status: 404 });
    }

    const admission = admissionSnap.data()!;

    // Owners can only action their own school's admissions
    if (user.role === "owner" && user.schoolId !== admission.schoolId) {
      return NextResponse.json({ error: "Not authorised for this school" }, { status: 403 });
    }

    if (action === "reviewing") {
      await admissionSnap.ref.update({
        status: "reviewing",
        reviewedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, status: "reviewing" });
    }

    if (action === "decline") {
      await admissionSnap.ref.update({
        status: "declined",
        reviewedBy: uid,
        reviewedAt: FieldValue.serverTimestamp(),
        internalNotes: internalNotes ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, status: "declined" });
    }

    // ── Approve ──────────────────────────────────────────────────
    if (action === "approve") {
      // 1. Create or get Firebase Auth user for parent
      let parentUid: string;
      try {
        const existing = await auth.getUserByEmail(admission.parentEmail);
        parentUid = existing.uid;
      } catch {
        const newUser = await auth.createUser({
          email: admission.parentEmail,
          displayName: admission.parentName,
          emailVerified: false,
        });
        parentUid = newUser.uid;
      }

      // 2. Create Child record
      const childRef = db.collection("children").doc();
      await childRef.set({
        schoolId: admission.schoolId,
        branchId: null,
        classId: classId ?? null,
        firstName: admission.childFirstName,
        lastName: admission.childLastName,
        dateOfBirth: admission.childDateOfBirth,
        parentIds: [parentUid],
        photoConsent: false,       // must be given explicitly
        allergies: null,
        notes: admission.notes ?? null,
        deletionStatus: null,
        enrolledAt: FieldValue.serverTimestamp(),
      });

      // 3. Create or update parent Firestore user doc
      await db.collection("users").doc(parentUid).set({
        uid: parentUid,
        email: admission.parentEmail,
        displayName: admission.parentName,
        role: "parent",
        schoolId: admission.schoolId,
        childIds: FieldValue.arrayUnion(childRef.id),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // 4. Send invite email
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://littleloop-creche-v1.vercel.app";
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: "PASSWORD_RESET",
            email: admission.parentEmail,
            continueUrl: `${appUrl}/login`,
          }),
        }
      );

      // 5. Update admission record
      await admissionSnap.ref.update({
        status: "approved",
        reviewedBy: uid,
        reviewedAt: FieldValue.serverTimestamp(),
        childId: childRef.id,
        internalNotes: internalNotes ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        status: "approved",
        childId: childRef.id,
        parentUid,
      });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (err) {
    console.error("Admission action error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(req, {
    namespace: "invite",
    limit: 10,
    windowSeconds: 60,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { email, displayName, role, schoolId, schoolSlug, branchId, childIds, phone } = await req.json();

    if (!email || !displayName || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["teacher", "parent", "owner", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (role !== "superadmin" && !schoolId) {
      return NextResponse.json({ error: "School is required for this role" }, { status: 400 });
    }

    const auth = adminAuth();
    const db = adminDb();

    // 1. Create or get Firebase Auth user
    let uid: string;
    let isNew = false;
    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const newUser = await auth.createUser({
        email,
        displayName,
        emailVerified: false,
      });
      uid = newUser.uid;
      isNew = true;
    }

    // 2. Create Firestore user document
    const userData: Record<string, unknown> = {
      uid,
      email,
      displayName,
      role,
      schoolId: role === "superadmin" ? null : schoolId,
      phone: phone ?? null,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (branchId) userData.branchId = branchId;
    if (childIds) userData.childIds = childIds;
    void schoolSlug; // reserved for future subdomain routing

    await db.collection("users").doc(uid).set(userData, { merge: true });

    // 3. Send password setup email via Firebase Identity Toolkit
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://littleloop-creche-v1.vercel.app";
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    const sendEmailRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email,
          continueUrl: `${appUrl}/login`,
        }),
      }
    );

    if (!sendEmailRes.ok) {
      const err = await sendEmailRes.json();
      throw new Error(err.error?.message ?? "Failed to send invite email");
    }

    return NextResponse.json({
      success: true,
      uid,
      isNew,
      message: isNew
        ? `Invite email sent to ${email}. They'll set their password and land on their dashboard.`
        : `${email} already has an account. A password reset email has been sent.`,
    });

  } catch (err) {
    console.error("Invite user error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to invite user" },
      { status: 500 }
    );
  }
}

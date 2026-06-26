import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await enforceRateLimit(req, {
      namespace: "invite",
      limit: 5,
      windowSeconds: 60,
    });
    if (rateLimited) return rateLimited;

    const authorized = await requireSuperAdmin(req);
    if ("error" in authorized) return authorized.error;

    const { email, displayName, role, schoolId, branchId, childIds, phone } = await req.json();

    if (!email || !displayName || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["teacher", "parent", "owner", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (role !== "superadmin" && !schoolId) {
      return NextResponse.json({ error: "School is required for this role" }, { status: 400 });
    }

    const { auth, db } = authorized;

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
      createdAt: new Date().toISOString(),
    };
    if (branchId) userData.branchId = branchId;
    if (childIds) userData.childIds = childIds;

    await db.collection("users").doc(uid).set(userData, { merge: true });

    // 3. Send password setup email directly via Firebase Admin
    // This sends the official Firebase "Reset your password" email
    // with a link that takes them straight to set their password
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://littleloop-creche-v1.vercel.app";
    await auth.generatePasswordResetLink(email, {
      url: `${appUrl}/login`,
    });

    // Use Firebase Auth to send the email directly
    // generatePasswordResetLink generates the link; to send email we use
    // the client SDK's sendPasswordResetEmail — but from Admin we call
    // the identity toolkit REST API directly
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

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { email, displayName, role, schoolId, schoolSlug, branchId, childIds } = await req.json();

    if (!email || !displayName || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["teacher", "parent", "owner", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // superadmin doesn't need a schoolId
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
      createdAt: new Date().toISOString(),
    };
    if (branchId) userData.branchId = branchId;
    if (childIds) userData.childIds = childIds;

    await db.collection("users").doc(uid).set(userData, { merge: true });

    // 3. Generate setup/invite link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://littleloop-creche-v1.vercel.app";
    const setupLink = await auth.generatePasswordResetLink(email, {
      url: `${appUrl}/login?school=${schoolSlug ?? ""}`,
    });

    return NextResponse.json({
      success: true,
      uid,
      isNew,
      setupLink,
      message: isNew
        ? `Invite created for ${email}. Share the setup link with them.`
        : `${email} already has an account. Access granted to this school.`,
    });

  } catch (err) {
    console.error("Invite user error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to invite user" },
      { status: 500 }
    );
  }
}

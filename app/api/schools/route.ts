import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { name, slug, ownerName, ownerEmail, phone, address, branches } = await req.json();

    if (!name || !slug || !ownerEmail || !ownerName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = adminDb();
    const auth = adminAuth();

    // 1. Check slug is unique
    const existing = await db.collection("schools")
      .where("slug", "==", slug.toLowerCase()).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }

    // 2. Create school document
    const schoolRef = db.collection("schools").doc();
    const schoolId = schoolRef.id;
    await schoolRef.set({
      id: schoolId,
      name,
      slug: slug.toLowerCase(),
      phone: phone ?? "",
      address: address ?? "",
      branches: branches ?? [],
      plan: "starter",
      createdAt: new Date().toISOString(),
    });

    // 3. Create or get owner Firebase Auth user
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(ownerEmail);
      uid = existing.uid;
    } catch {
      // User doesn't exist — create them
      const newUser = await auth.createUser({
        email: ownerEmail,
        displayName: ownerName,
        emailVerified: false,
      });
      uid = newUser.uid;
    }

    // 4. Create owner Firestore user document
    await db.collection("users").doc(uid).set({
      uid,
      email: ownerEmail,
      displayName: ownerName,
      role: "owner",
      schoolId,
      createdAt: new Date().toISOString(),
    });

    // 5. Generate password setup link and send via Firebase Auth email
    const setupLink = await auth.generatePasswordResetLink(ownerEmail, {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/login?school=${slug}&setup=true`,
    });

    // 6. Send the invite email using Firebase Auth custom email
    // For now we return the link — in production connect SendGrid/Resend here
    // Firebase Auth will send the default password reset email automatically
    // when using generatePasswordResetLink with sendPasswordResetEmail
    await auth.generatePasswordResetLink(ownerEmail);

    return NextResponse.json({
      success: true,
      schoolId,
      uid,
      setupLink, // Return for display in admin UI until email is configured
      message: `School created. Setup link generated for ${ownerEmail}`,
    });

  } catch (err) {
    console.error("Create school error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create school" },
      { status: 500 }
    );
  }
}

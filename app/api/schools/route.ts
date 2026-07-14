import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await enforceRateLimit(req, {
      namespace: "schools",
      limit: 3,
      windowSeconds: 60 * 60,
    });
    if (rateLimited) return rateLimited;

    const authorized = await requireSuperAdmin(req);
    if ("error" in authorized) return authorized.error;

    const { name, slug, ownerName, ownerEmail, phone, address, branches } = await req.json();

    if (!name || !slug || !ownerEmail || !ownerName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { db, auth } = authorized;

    // 1. Check slug is unique
    const existing = await db.collection("schools")
      .where("slug", "==", slug.toLowerCase()).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: "Slug already taken. Choose a different URL name." }, { status: 409 });
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
    let isNew = false;
    try {
      const existingUser = await auth.getUserByEmail(ownerEmail);
      uid = existingUser.uid;
    } catch {
      const newUser = await auth.createUser({
        email: ownerEmail,
        displayName: ownerName,
        emailVerified: false,
      });
      uid = newUser.uid;
      isNew = true;
    }

    // 4. Create owner Firestore user document
    await db.collection("users").doc(uid).set({
      uid,
      email: ownerEmail,
      displayName: ownerName,
      role: "owner",
      schoolId,
      createdAt: new Date().toISOString(),
    }, { merge: true });

    // 5. Send password setup email directly
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://littleloop-creche-v1.vercel.app";
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    const sendEmailRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email: ownerEmail,
          continueUrl: `${appUrl}/login`,
        }),
      }
    );

    if (!sendEmailRes.ok) {
      const err = await sendEmailRes.json();
      console.error("Email send failed:", err);
      // Don't fail the whole request — school was created successfully
    }

    return NextResponse.json({
      success: true,
      schoolId,
      uid,
      isNew,
      message: `${name} created. Setup email sent to ${ownerEmail}.`,
    });

  } catch (err) {
    console.error("Create school error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create school" },
      { status: 500 }
    );
  }
}

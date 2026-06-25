/**
 * ONE-TIME superadmin bootstrap endpoint.
 *
 * Security guarantees:
 *  1. Requires BOOTSTRAP_SECRET header to match env var — so only you can call it.
 *  2. Refuses to run if ANY superadmin already exists in Firestore.
 *     Once the first superadmin is created this endpoint is permanently inert.
 *
 * Usage:
 *   POST https://your-app.vercel.app/api/bootstrap-superadmin
 *   Headers:
 *     x-bootstrap-secret: <your BOOTSTRAP_SECRET env var>
 *     Content-Type: application/json
 *   Body:
 *     { "email": "you@example.com", "password": "StrongPass123!", "displayName": "Thami" }
 *
 * After use: remove BOOTSTRAP_SECRET from Vercel env vars to fully disable this route.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── 1. Secret gate ────────────────────────────────────────────────────────
  const secret = req.headers.get("x-bootstrap-secret");
  if (!secret || secret !== process.env.BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = adminDb();
    const auth = adminAuth();

    // ── 2. Idempotency guard — refuse if superadmin already exists ────────────
    const existing = await db.collection("users")
      .where("role", "==", "superadmin")
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: "A superadmin already exists. This endpoint is permanently disabled." },
        { status: 409 }
      );
    }

    // ── 3. Parse body ─────────────────────────────────────────────────────────
    const { email, password, displayName } = await req.json();
    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: "email, password, and displayName are required" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // ── 4. Create Firebase Auth user ──────────────────────────────────────────
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });

    // ── 5. Write Firestore user doc ───────────────────────────────────────────
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role: "superadmin",
      schoolId: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`[bootstrap] Superadmin created: ${email} (${userRecord.uid})`);

    return NextResponse.json({
      success: true,
      message: `Superadmin account created for ${email}. You can now log in at /login and will be redirected to /admin.`,
      uid: userRecord.uid,
    });
  } catch (err: any) {
    console.error("[bootstrap-superadmin]", err);
    if (err.code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "A Firebase Auth user with that email already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

// Block all other methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

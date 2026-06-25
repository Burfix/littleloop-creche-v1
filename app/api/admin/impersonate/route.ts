/**
 * POST /api/admin/impersonate
 * Superadmin only. Returns:
 *   - customToken: sign in as target user
 *   - restoreToken: sign back in as superadmin when exiting impersonation
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const auth = adminAuth();
    const db = adminDb();
    const decoded = await auth.verifyIdToken(token);
    const callerSnap = await db.collection("users").doc(decoded.uid).get();
    if (callerSnap.data()?.role !== "superadmin") {
      return NextResponse.json({ error: "Superadmin only" }, { status: 403 });
    }

    const { targetUid } = await req.json();
    if (!targetUid) return NextResponse.json({ error: "targetUid required" }, { status: 400 });

    const targetSnap = await db.collection("users").doc(targetUid).get();
    if (!targetSnap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Token to become the target user
    const customToken = await auth.createCustomToken(targetUid, { impersonatedBy: decoded.uid });

    // Token to restore the superadmin session on exit (no sign-out needed)
    const restoreToken = await auth.createCustomToken(decoded.uid, { restored: true });

    return NextResponse.json({
      customToken,
      restoreToken,
      targetUser: {
        uid: targetUid,
        displayName: targetSnap.data()?.displayName,
        email: targetSnap.data()?.email,
        role: targetSnap.data()?.role,
      },
    });
  } catch (err: any) {
    console.error("[impersonate]", err);
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}

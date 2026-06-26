import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function requireSuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }

  const auth = adminAuth();
  const db = adminDb();

  try {
    const decoded = await auth.verifyIdToken(token);
    const userSnap = await db.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists || userSnap.data()?.role !== "superadmin") {
      return { error: NextResponse.json({ error: "Super admin access required" }, { status: 403 }) };
    }

    return { auth, db, uid: decoded.uid };
  } catch {
    return { error: NextResponse.json({ error: "Invalid authentication token" }, { status: 401 }) };
  }
}

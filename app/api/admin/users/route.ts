/**
 * GET /api/admin/users?schoolId=xxx
 * Returns users list for superadmin — used by the Users & Impersonate panel.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

    const schoolId = req.nextUrl.searchParams.get("schoolId");
    let q = schoolId
      ? db.collection("users").where("schoolId", "==", schoolId).orderBy("role")
      : db.collection("users").orderBy("role");

    const snap = await q.get();
    const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}

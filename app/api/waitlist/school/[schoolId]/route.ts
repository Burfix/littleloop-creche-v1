import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type RouteContext = { params: Promise<{ schoolId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { schoolId } = await params;
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const db = adminDb();
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const role = userSnap.data()?.role;

    if (!["owner", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }
    if (userSnap.data()?.schoolId !== schoolId && role !== "superadmin") {
      return NextResponse.json({ error: "School mismatch" }, { status: 403 });
    }

    const snap = await db.collection("waitlist")
      .where("schoolId", "==", schoolId)
      .orderBy("position", "asc")
      .get();

    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ entries });
  } catch (err) {
    console.error("Waitlist GET error:", err);
    return NextResponse.json({ error: "Failed to load waitlist" }, { status: 500 });
  }
}

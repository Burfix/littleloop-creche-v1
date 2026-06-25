import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ChildProfileReport } from "@/lib/pdf/ChildProfileReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ childId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { childId } = await params;
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const db = adminDb();
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    if (!["owner", "superadmin", "teacher"].includes(role)) {
      return NextResponse.json({ error: "Staff access required" }, { status: 403 });
    }
    const schoolId: string = userSnap.data()?.schoolId;

    const [childSnap, medicalSnap, schoolSnap] = await Promise.all([
      db.collection("children").doc(childId).get(),
      db.collection("medical_records").doc(childId).get(),
      db.collection("schools").doc(schoolId).get(),
    ]);

    if (!childSnap.exists) return NextResponse.json({ error: "Child not found" }, { status: 404 });
    const child = { id: childSnap.id, ...childSnap.data() } as any;
    if (child.schoolId !== schoolId) return NextResponse.json({ error: "School mismatch" }, { status: 403 });

    const parentIds: string[] = child.parentIds ?? [];
    const parentNames = await Promise.all(
      parentIds.map(async (pid: string) => {
        const snap = await db.collection("users").doc(pid).get();
        return snap.data()?.displayName ?? snap.data()?.email ?? pid;
      })
    );

    const schoolName: string = schoolSnap.data()?.name ?? "School";
    const medical = medicalSnap.exists ? { id: medicalSnap.id, ...medicalSnap.data() } as any : null;
    const generatedAt = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await (renderToBuffer as any)(
      createElement(ChildProfileReport, { schoolName, child, medical, parentNames, generatedAt })
    );

    const safeName = `${child.firstName}-${child.lastName}`.replace(/\s+/g, "-").toLowerCase();
    return new NextResponse(buffer as Buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="profile-${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reports/child]", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

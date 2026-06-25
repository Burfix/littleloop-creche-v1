import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { AttendanceReport } from "@/lib/pdf/AttendanceReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
  }

  try {
    const db = adminDb();
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    if (!["owner", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }
    const schoolId: string = userSnap.data()?.schoolId;

    const schoolSnap = await db.collection("schools").doc(schoolId).get();
    const schoolName: string = schoolSnap.data()?.name ?? "School";

    const classroomsSnap = await db.collection("classrooms")
      .where("schoolId", "==", schoolId).get();
    const classMap = new Map<string, string>();
    classroomsSnap.docs.forEach(d => classMap.set(d.id, d.data().name));

    const childrenSnap = await db.collection("children")
      .where("schoolId", "==", schoolId).get();

    const [year, mon] = month.split("-").map(Number);
    const end = new Date(year, mon, 0);
    const totalDays = end.getDate();

    const attendanceSnap = await db.collection("attendance")
      .where("schoolId", "==", schoolId)
      .where("date", ">=", month + "-01")
      .where("date", "<=", month + "-31")
      .get();

    const presentDays = new Map<string, number>();
    attendanceSnap.docs.forEach(d => {
      const { childId, status } = d.data();
      if (status === "present" || status === "late") {
        presentDays.set(childId, (presentDays.get(childId) ?? 0) + 1);
      }
    });

    const rows = childrenSnap.docs.map(d => {
      const child = d.data();
      const daysPresent = presentDays.get(d.id) ?? 0;
      return {
        childName: `${child.firstName} ${child.lastName}`,
        className: classMap.get(child.classroomId) ?? "—",
        daysPresent,
        daysAbsent: Math.max(0, totalDays - daysPresent),
        totalDays,
        rate: Math.round((daysPresent / totalDays) * 100),
      };
    }).sort((a, b) => a.childName.localeCompare(b.childName));

    const monthLabel = new Date(year, mon - 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
    const generatedAt = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await (renderToBuffer as any)(
      createElement(AttendanceReport, { schoolName, month: monthLabel, rows, generatedAt })
    );

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="attendance-${month}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reports/attendance]", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

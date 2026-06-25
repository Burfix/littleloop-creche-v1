import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { BillingReport } from "@/lib/pdf/BillingReport";

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

    const invoicesSnap = await db.collection("invoices")
      .where("schoolId", "==", schoolId)
      .where("month", "==", month)
      .get();

    const byChild = new Map<string, {
      childName: string; parentId: string;
      totalCents: number; paidCents: number; outstandingCents: number; overdueCents: number; count: number;
    }>();

    invoicesSnap.docs.forEach(d => {
      const inv = d.data();
      const existing = byChild.get(inv.childId) ?? {
        childName: inv.childName ?? inv.childId,
        parentId: inv.parentId,
        totalCents: 0, paidCents: 0, outstandingCents: 0, overdueCents: 0, count: 0,
      };
      existing.totalCents += inv.amountCents ?? 0;
      if (inv.status === "paid") existing.paidCents += inv.amountCents ?? 0;
      else if (inv.status === "overdue") existing.overdueCents += inv.amountCents ?? 0;
      else existing.outstandingCents += inv.amountCents ?? 0;
      existing.count += 1;
      byChild.set(inv.childId, existing);
    });

    const parentIds = [...new Set([...byChild.values()].map(v => v.parentId))];
    const parentNames = new Map<string, string>();
    await Promise.all(parentIds.map(async pid => {
      const snap = await db.collection("users").doc(pid).get();
      parentNames.set(pid, snap.data()?.displayName ?? snap.data()?.email ?? pid);
    }));

    const rows = [...byChild.entries()].map(([, v]) => ({
      childName: v.childName,
      parentName: parentNames.get(v.parentId) ?? "—",
      invoiceCount: v.count,
      totalCents: v.totalCents,
      paidCents: v.paidCents,
      outstandingCents: v.outstandingCents,
      overdueCents: v.overdueCents,
    })).sort((a, b) => a.childName.localeCompare(b.childName));

    const [year, mon] = month.split("-").map(Number);
    const monthLabel = new Date(year, mon - 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
    const generatedAt = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await (renderToBuffer as any)(
      createElement(BillingReport, { schoolName, month: monthLabel, rows, generatedAt })
    );

    return new NextResponse(buffer as Buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="billing-${month}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reports/billing]", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

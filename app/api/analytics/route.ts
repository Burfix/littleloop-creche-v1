import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
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
    const schoolId: string = userSnap.data()?.schoolId;

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // ── Date helpers ────────────────────────────────────────────
    function daysAgo(n: number): string {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d.toISOString().split("T")[0];
    }
    function monthStr(offset: number): string {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    // ── Parallel fetches ────────────────────────────────────────
    const thirtyDaysAgo = daysAgo(30);
    const sixMonthsAgo = monthStr(5);

    const [
      childrenSnap,
      updatesSnap,
      invoicesSnap,
      journalSnap,
      admissionsSnap,
      classesSnap,
    ] = await Promise.all([
      db.collection("children").where("schoolId", "==", schoolId).get(),
      db.collection("daily_updates")
        .where("schoolId", "==", schoolId)
        .where("date", ">=", thirtyDaysAgo)
        .where("date", "<=", today)
        .get(),
      db.collection("invoices")
        .where("schoolId", "==", schoolId)
        .where("month", ">=", sixMonthsAgo)
        .get(),
      db.collection("journal_entries")
        .where("schoolId", "==", schoolId)
        .get(),
      db.collection("admissions")
        .where("schoolId", "==", schoolId)
        .get(),
      db.collection("classes")
        .where("schoolId", "==", schoolId)
        .get(),
    ]);

    const totalChildren = childrenSnap.size;

    // ── Attendance trend (last 30 days) ─────────────────────────
    // Group updates by date, count checkedIn
    const updatesByDate: Record<string, { checkedIn: number; total: number }> = {};
    for (let i = 0; i <= 30; i++) {
      const d = daysAgo(30 - i);
      updatesByDate[d] = { checkedIn: 0, total: totalChildren };
    }
    updatesSnap.docs.forEach(doc => {
      const data = doc.data();
      const d: string = data.date;
      if (updatesByDate[d]) {
        if (data.checkedIn) updatesByDate[d].checkedIn++;
      }
    });
    const attendanceTrend = Object.entries(updatesByDate).map(([date, v]) => ({
      date,
      checkedIn: v.checkedIn,
      total: v.total,
      rate: v.total > 0 ? Math.round((v.checkedIn / v.total) * 100) : 0,
    }));

    // ── Revenue trend (last 6 months) ───────────────────────────
    const revByMonth: Record<string, { collectedCents: number; outstandingCents: number; overdueCents: number }> = {};
    for (let i = 5; i >= 0; i--) {
      revByMonth[monthStr(i)] = { collectedCents: 0, outstandingCents: 0, overdueCents: 0 };
    }
    invoicesSnap.docs.forEach(doc => {
      const data = doc.data();
      const m: string = data.month;
      if (!revByMonth[m]) return;
      if (data.status === "paid") revByMonth[m].collectedCents += data.amountCents;
      else if (data.status === "overdue") revByMonth[m].overdueCents += data.amountCents;
      else revByMonth[m].outstandingCents += data.amountCents;
    });
    const revenueTrend = Object.entries(revByMonth).map(([month, v]) => ({ month, ...v }));

    // ── Journal domain coverage ──────────────────────────────────
    const domainCounts: Record<string, number> = {};
    journalSnap.docs.forEach(doc => {
      const domains: string[] = doc.data().domains ?? [];
      domains.forEach(d => { domainCounts[d] = (domainCounts[d] ?? 0) + 1; });
    });

    // ── Admissions funnel ────────────────────────────────────────
    const funnel: Record<string, number> = { pending: 0, reviewing: 0, approved: 0, enrolled: 0, declined: 0 };
    admissionsSnap.docs.forEach(doc => {
      const s: string = doc.data().status;
      funnel[s] = (funnel[s] ?? 0) + 1;
    });

    // ── Occupancy ────────────────────────────────────────────────
    const totalCapacity = classesSnap.docs.reduce((s, d) => s + (d.data().capacity ?? 0), 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((totalChildren / totalCapacity) * 100) : 0;

    // ── Current month collection rate ────────────────────────────
    const currentMonth = monthStr(0);
    let collectedCents = 0, outstandingCents = 0, overdueCents = 0;
    invoicesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.month !== currentMonth) return;
      if (data.status === "paid") collectedCents += data.amountCents;
      else if (data.status === "overdue") overdueCents += data.amountCents;
      else outstandingCents += data.amountCents;
    });
    const totalBilled = collectedCents + outstandingCents + overdueCents;
    const collectionRate = totalBilled > 0 ? Math.round((collectedCents / totalBilled) * 100) : 0;

    return NextResponse.json({
      attendanceTrend,
      revenueTrend,
      domainCounts,
      journalCount: journalSnap.size,
      admissionsFunnel: funnel,
      occupancy: { enrolled: totalChildren, capacity: totalCapacity, rate: occupancyRate },
      collection: { collectedCents, outstandingCents, overdueCents, rate: collectionRate },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import {
  getChildrenForSchoolPage,
  getCockpitStats,
  getInvoicesForSchoolPage,
  getParentsForSchool,
  getSchool,
  getTeachersForSchool,
  getDailyUpdatesForSchoolDate,
  getClassesForSchool,
} from "@/lib/db";
import { getOnboardingStatus, type OnboardingStatus } from "@/lib/onboarding";
import type { AppUser, Child, ClassRoom, CockpitStats, DailyUpdate, Invoice, School } from "@/lib/types";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import toast from "react-hot-toast";
import { BarChart2, CreditCard, Settings, LogOut, UserPlus, Baby, Users } from "lucide-react";
import { AttendanceCard } from "./components/AttendanceCard";
import { AttendanceReport } from "./components/AttendanceReport";
import { FinancialStats } from "./components/FinancialStats";
import { BillingTab } from "./components/BillingTab";
import { SettingsTab } from "./components/SettingsTab";
import { OnboardingChecklist } from "./components/OnboardingChecklist";

type Tab = "overview" | "billing" | "settings";


export default function OwnerDashboard() {
  const { appUser, firebaseUser, signOut } = useAuth();
  const { school, loading: schoolLoading } = useSchool();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<CockpitStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [ownerSchool, setOwnerSchool] = useState<School | null>(null);
  const [parents, setParents] = useState<AppUser[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [todayUpdates, setTodayUpdates] = useState<DailyUpdate[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [invoiceCursor, setInvoiceCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreInvoices, setHasMoreInvoices] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "owner") { router.replace("/"); return; }
    if (schoolLoading) return;

    let cancelled = false;
    const schoolId = school?.id ?? appUser.schoolId;

    async function loadDashboard() {
      if (!schoolId) { if (!cancelled) setLoading(false); return; }

      try {
        const today = new Date().toISOString().slice(0, 10);
        const [resolvedSchool, s, invoicePage, schoolParents, schoolTeachers, schoolClasses, updates] = await Promise.all([
          school?.id === schoolId ? Promise.resolve(school) : getSchool(schoolId),
          getCockpitStats(schoolId),
          getInvoicesForSchoolPage(schoolId),
          getParentsForSchool(schoolId),
          getTeachersForSchool(schoolId),
          getClassesForSchool(schoolId),
          getDailyUpdatesForSchoolDate(schoolId, today),
        ]);
        const [childPage, onboardingStatus] = await Promise.all([
          getChildrenForSchoolPage(schoolId, { includePendingErasure: true }),
          getOnboardingStatus(schoolId, resolvedSchool),
        ]);

        if (cancelled) return;
        setOwnerSchool(resolvedSchool);
        setStats(s);
        setInvoices(invoicePage.items);
        setChildren(childPage.items);
        setParents(schoolParents);
        setTeachers(schoolTeachers);
        setClasses(schoolClasses);
        setTodayUpdates(updates);
        setOnboarding(onboardingStatus);
        setInvoiceCursor(invoicePage.nextCursor);
        setHasMoreInvoices(invoicePage.hasMore);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();
    return () => { cancelled = true; };
  }, [appUser, school, schoolLoading, router]);

  const loadMoreInvoices = async () => {
    const schoolId = school?.id ?? appUser?.schoolId;
    if (!schoolId || !invoiceCursor || loadingInvoices) return;

    setLoadingInvoices(true);
    try {
      const invoicePage = await getInvoicesForSchoolPage(schoolId, { cursor: invoiceCursor });
      setInvoices(prev => [...prev, ...invoicePage.items]);
      setInvoiceCursor(invoicePage.nextCursor);
      setHasMoreInvoices(invoicePage.hasMore);
    } catch {
      toast.error("Could not load more invoices");
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const requestChildErasure = async (child: Child) => {
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken();
    const res = await fetch(`/api/children/${child.id}/deletion`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setChildren(prev => prev.map(c => c.id === child.id
      ? { ...c, deletionStatus: "pending_erasure", deletionRequestedAt: new Date().toISOString(), deletionRequestedBy: appUser?.uid }
      : c));
    toast.success(`${child.firstName} marked for erasure`);
  };

  const permanentlyEraseChild = async (child: Child, confirmName: string) => {
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken();
    const res = await fetch(`/api/children/${child.id}/deletion`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setChildren(prev => prev.filter(c => c.id !== child.id));
    toast.success("Child data permanently erased");
  };

  const handleChildAdded = (child: Child) => {
    setChildren(prev => [child, ...prev]);
    setStats(prev => prev ? { ...prev, totalChildren: prev.totalChildren + 1 } : prev);
    // Optimistically mark the "firstChild" onboarding step done, same pattern
    // as the stats update above. Other steps (classes, invites, billing) are
    // set inside SettingsTab/BillingTab today and aren't wired back to this
    // state yet — they'll show correctly on next visit to this page, since
    // getOnboardingStatus() always re-derives from real data rather than a
    // stored pointer. Follow-up: thread the same optimistic-update callback
    // pattern through those actions too.
    setOnboarding(prev => {
      if (!prev) return prev;
      const steps = prev.steps.map(s => s.key === "firstChild" ? { ...s, done: true } : s);
      const completedCount = steps.filter(s => s.done).length;
      return {
        steps,
        completedCount,
        totalCount: steps.length,
        isComplete: completedCount === steps.length,
        nextIncomplete: steps.find(s => !s.done) ?? null,
      };
    });
  };

  const activeSchool = school ?? ownerSchool;

  if (loading || !appUser) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  return (
    <div className="app-shell app-shell--wide">
      {/* Header */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Owner cockpit</p>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{activeSchool?.name ?? "School setup"}</h2>
        </div>
        <button onClick={handleSignOut}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
          <LogOut size={18} />
        </button>
      </div>

      <div className="page-content" style={{ padding: "16px 20px" }}>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && stats && onboarding && !onboarding.isComplete && (
          <OnboardingChecklist
            schoolName={activeSchool?.name ?? "your school"}
            status={onboarding}
            onStepClick={(targetTab) => setTab(targetTab)}
          />
        )}
        {tab === "overview" && stats && onboarding?.isComplete && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <AttendanceCard
              checkedInToday={stats.checkedInToday}
              totalChildren={stats.totalChildren}
            />
            <AttendanceReport
              classes={classes}
              children={children}
              dailyUpdates={todayUpdates}
            />
            <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { label: "Add child", Icon: Baby },
                { label: "Invite teacher", Icon: UserPlus },
                { label: "Invite parent", Icon: Users },
              ].map(({ label, Icon }) => (
                <button
                  key={label}
                  className="btn btn-secondary"
                  style={{ flexDirection: "column", padding: "14px 8px", fontSize: 12 }}
                  onClick={() => setTab("settings")}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
            <FinancialStats
              stats={stats}
              invoices={invoices}
              children={children}
              parents={parents}
              schoolName={activeSchool?.name ?? ""}
            />
            {activeSchool && (activeSchool.branches?.length ?? 0) > 0 && (
              <div className="card">
                <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Branches</h4>
                {activeSchool.branches.map(b => (
                  <div key={b.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: "1px solid var(--border)",
                  }}>
                    <span style={{ fontSize: 14 }}>{b.name}</span>
                    <span className="pill pill-green">Active</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BILLING TAB ── */}
        {tab === "billing" && activeSchool && (
          <BillingTab
            invoices={invoices}
            children={children}
            parents={parents}
            school={activeSchool}
            invoiceCursor={invoiceCursor}
            hasMoreInvoices={hasMoreInvoices}
            loadingInvoices={loadingInvoices}
            onLoadMore={loadMoreInvoices}
            onInvoiceUpdate={updated => setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i))}
            onInvoiceCreated={inv => setInvoices(prev => [inv, ...prev])}
          />
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && activeSchool && (
          <SettingsTab
            school={activeSchool}
            enrolledChildren={children}
            teachers={teachers}
            onChildAdded={handleChildAdded}
            onRequestErasure={requestChildErasure}
            onPermanentErasure={permanentlyEraseChild}
            onSignOut={handleSignOut}
          />
        )}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav bottom-nav--wide">
        {([
          { id: "overview", Icon: BarChart2, label: "Overview" },
          { id: "billing", Icon: CreditCard, label: "Billing" },
          { id: "settings", Icon: Settings, label: "Settings" },
        ] as const).map(({ id, Icon, label }) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

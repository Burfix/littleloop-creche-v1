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
  updateUser,
} from "@/lib/db";
import { getSchoolLaunchStatus } from "@/lib/school-launch";
import { registerForPushNotifications } from "@/lib/notifications";
import type { AppUser, Child, ClassRoom, CockpitStats, DailyUpdate, Invoice, School, SchoolLaunchStatus } from "@/lib/types";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import toast from "react-hot-toast";
import { BarChart2, CreditCard, Settings, LogOut, UserPlus, Baby, Users } from "lucide-react";
import { AttendanceCard } from "./components/AttendanceCard";
import { AttendanceReport } from "./components/AttendanceReport";
import { FinancialStats } from "./components/FinancialStats";
import { BillingTab } from "./components/BillingTab";
import { SettingsTab } from "./components/SettingsTab";
import { PageHeader } from "./components/PageHeader";
import { NotificationBell } from "./components/NotificationBell";
import { SchoolLaunchWorkspace } from "./components/launch/SchoolLaunchWorkspace";
import { SuccessPanel } from "./components/launch/SuccessPanel";
import { LoadingSkeleton } from "./components/launch/LoadingSkeleton";
import { InlineErrorState } from "./components/InlineErrorState";

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
  const [launchStatus, setLaunchStatus] = useState<SchoolLaunchStatus | null>(null);
  const [launchStatusLoading, setLaunchStatusLoading] = useState(true);
  const [hasSeenLaunchSuccess, setHasSeenLaunchSuccess] = useState(false);
  const [invoiceCursor, setInvoiceCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreInvoices, setHasMoreInvoices] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "owner") { router.replace("/"); return; }
    if (schoolLoading) return;

    let cancelled = false;
    const schoolId = school?.id ?? appUser.schoolId;

    async function loadDashboard() {
      if (!schoolId) { if (!cancelled) setLoading(false); return; }

      if (!cancelled) setLoadError(null);
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
        const [childPage, launchStatusResult] = await Promise.all([
          getChildrenForSchoolPage(schoolId, { includePendingErasure: true }),
          getSchoolLaunchStatus(schoolId, resolvedSchool, appUser),
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
        setLaunchStatus(launchStatusResult);
        setInvoiceCursor(invoicePage.nextCursor);
        setHasMoreInvoices(invoicePage.hasMore);
      } catch (err) {
        console.error("Failed to load owner dashboard", { schoolId, err });
        if (!cancelled) setLoadError("We couldn't load your cockpit. Your data is safe, this is a connection issue.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLaunchStatusLoading(false);
        }
      }
    }

    void loadDashboard();

    // Register for push notifications — silent if browser doesn't support
    // it or permission is declined (see lib/notifications.ts). Mirrors
    // app/parent/page.tsx; owners never had this call before, which meant
    // /api/notifications/send had nothing to send to even when a staff
    // action tried to reach them.
    registerForPushNotifications(appUser.uid);

    return () => { cancelled = true; };
  }, [appUser, school, schoolLoading, router, reloadToken]);

  const handleRetryLoad = () => {
    setLoading(true);
    setLaunchStatusLoading(true);
    setLoadError(null);
    setReloadToken(t => t + 1);
  };

  // appUser comes from a one-time getDoc in auth-context, not a live
  // listener (see lib/auth-context.tsx) — it won't reactively update after
  // our own updateUser() write below. Seed local state from it once it's
  // available; the acknowledgment handler then flips local state directly
  // so the transition still feels instant.
  useEffect(() => {
    void Promise.resolve().then(() => {
      if (appUser?.hasSeenLaunchSuccess) setHasSeenLaunchSuccess(true);
    });
  }, [appUser]);

  // Fire-and-forget, same philosophy as hasSeenOnboardingWelcome in
  // app/onboarding/page.tsx: if this write fails, the owner just sees the
  // success screen once more next login — not worth blocking navigation.
  const acknowledgeLaunchSuccess = () => {
    setHasSeenLaunchSuccess(true);
    if (appUser) void updateUser(appUser.uid, { hasSeenLaunchSuccess: true });
  };

  // Re-derives the full launch status from scratch rather than optimistically
  // patching the nested stage/task tree — Firestore's getCountFromServer is
  // cheap, and this guarantees the workspace can never drift from reality
  // (same philosophy as the old markStepDone, taken one step further).
  const refreshLaunchStatus = async () => {
    const schoolId = school?.id ?? appUser?.schoolId;
    if (!schoolId) return;
    try {
      const resolvedSchool = school?.id === schoolId ? school : (ownerSchool ?? await getSchool(schoolId));
      const next = await getSchoolLaunchStatus(schoolId, resolvedSchool, appUser);
      setLaunchStatus(next);
    } catch (err) {
      // Non-fatal — the workspace just shows slightly stale data until the
      // next full page load re-derives it. Still surfaced so the owner
      // knows a refresh attempt didn't land, rather than silently
      // continuing to show pre-action data with no signal anything failed.
      console.error("Failed to refresh launch status", { schoolId, err });
      toast.error("Couldn't refresh your School Launch. Showing your last known status.");
    }
  };

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
    void refreshLaunchStatus();
  };

  // ClassesSection reports its full class list on every load and every
  // change (create/update/delete), so this both keeps this page's `classes`
  // state fresh (previously it only reflected the initial page load) and
  // refreshes the launch workspace the moment a class exists.
  const handleClassesChanged = (updatedClasses: ClassRoom[]) => {
    setClasses(updatedClasses);
    if (updatedClasses.length > 0) {
      void refreshLaunchStatus();
    }
  };

  const handleInvited = () => {
    void refreshLaunchStatus();
  };

  const activeSchool = school ?? ownerSchool;

  if (loading || !appUser) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  if (loadError) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", padding: "32px 24px" }}>
        <InlineErrorState message={loadError} onRetry={handleRetryLoad} />
      </div>
    );
  }

  return (
    <div className="app-shell app-shell--wide">
      {/* Header */}
      <PageHeader
        eyebrow="Owner cockpit"
        title={activeSchool?.name ?? "School setup"}
        actions={
          <>
            <NotificationBell schoolId={activeSchool?.id ?? appUser.schoolId ?? ""} />
            <button onClick={handleSignOut}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
              <LogOut size={18} />
            </button>
          </>
        }
      />

      <div className="page-content" style={{ padding: "16px 20px" }}>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && launchStatusLoading && <LoadingSkeleton />}
        {tab === "overview" && !launchStatusLoading && stats && launchStatus && !launchStatus.isComplete && (
          <SchoolLaunchWorkspace
            schoolName={activeSchool?.name ?? "your school"}
            status={launchStatus}
            schoolId={activeSchool?.id ?? appUser.schoolId ?? ""}
            onRefresh={() => void refreshLaunchStatus()}
          />
        )}
        {tab === "overview" && !launchStatusLoading && stats && launchStatus?.isComplete && !hasSeenLaunchSuccess && (
          <SuccessPanel
            schoolName={activeSchool?.name ?? "your school"}
            childCount={stats.totalChildren}
            teacherCount={teachers.length}
            parentCount={parents.length}
            billingActive={invoices.length > 0}
            onOpenCockpit={acknowledgeLaunchSuccess}
            onViewSummary={() => {
              acknowledgeLaunchSuccess();
              router.push("/owner/launch-summary");
            }}
          />
        )}
        {tab === "overview" && !launchStatusLoading && stats && launchStatus?.isComplete && hasSeenLaunchSuccess && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <AttendanceCard
              checkedInToday={stats.checkedInToday}
              totalChildren={stats.totalChildren}
            />
            <AttendanceReport
              classes={classes}
              childRecords={children}
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
              childRecords={children}
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
            childRecords={children}
            parents={parents}
            school={activeSchool}
            invoiceCursor={invoiceCursor}
            hasMoreInvoices={hasMoreInvoices}
            loadingInvoices={loadingInvoices}
            onLoadMore={loadMoreInvoices}
            onInvoiceUpdate={updated => setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i))}
            onInvoiceCreated={inv => {
              setInvoices(prev => [inv, ...prev]);
              void refreshLaunchStatus();
            }}
            onRequestInvite={() => setTab("settings")}
          />
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && activeSchool && (
          <SettingsTab
            school={activeSchool}
            enrolledChildren={children}
            teachers={teachers}
            onChildAdded={handleChildAdded}
            onClassesChanged={handleClassesChanged}
            onInvited={handleInvited}
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

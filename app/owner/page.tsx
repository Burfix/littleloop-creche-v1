"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import {
  getChildrenForSchoolPage,
  getCockpitStats,
  getInvoicesForSchoolPage,
} from "@/lib/db";
import type { Child, CockpitStats, Invoice } from "@/lib/types";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import toast from "react-hot-toast";
import { BarChart2, CreditCard, Settings, LogOut } from "lucide-react";
import { AttendanceCard } from "./components/AttendanceCard";
import { FinancialStats } from "./components/FinancialStats";
import { BillingTab } from "./components/BillingTab";
import { SettingsTab } from "./components/SettingsTab";

type Tab = "overview" | "billing" | "settings";

// TODO(phase-3): set to true once WhatsApp/email Cloud Function is wired up
const REMINDERS_ENABLED = false;

export default function OwnerDashboard() {
  const { appUser, firebaseUser, signOut } = useAuth();
  const { school, loading: schoolLoading } = useSchool();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<CockpitStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
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
        const [s, invoicePage] = await Promise.all([
          getCockpitStats(schoolId),
          getInvoicesForSchoolPage(schoolId),
        ]);
        const childPage = await getChildrenForSchoolPage(schoolId, { includePendingErasure: true });

        if (cancelled) return;
        setStats(s);
        setInvoices(invoicePage.items);
        setChildren(childPage.items);
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

  if (loading || !appUser) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Owner cockpit</p>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{school?.name}</h2>
        </div>
        <button onClick={handleSignOut}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
          <LogOut size={18} />
        </button>
      </div>

      <div className="page-content" style={{ padding: "16px 20px" }}>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && stats && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <AttendanceCard
              checkedInToday={stats.checkedInToday}
              totalChildren={stats.totalChildren}
            />
            <FinancialStats stats={stats} remindersEnabled={REMINDERS_ENABLED} />
            {school && school.branches.length > 0 && (
              <div className="card">
                <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Branches</h4>
                {school.branches.map(b => (
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
        {tab === "billing" && (
          <BillingTab
            invoices={invoices}
            invoiceCursor={invoiceCursor}
            hasMoreInvoices={hasMoreInvoices}
            loadingInvoices={loadingInvoices}
            onLoadMore={loadMoreInvoices}
            onInvoiceUpdate={updated => setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i))}
          />
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && school && (
          <SettingsTab
            school={school}
            children={children}
            onRequestErasure={requestChildErasure}
            onPermanentErasure={permanentlyEraseChild}
            onSignOut={handleSignOut}
          />
        )}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
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

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import {
  getChildrenForSchoolPage, getCockpitStats, getInvoicesForSchoolPage,
  getAdmissionsForSchool, updateAdmissionStatus,
  updateInvoiceStatus,
} from "@/lib/db";
import type { Admission, AppUser, Child, CockpitStats, Invoice, MedicalRecord, JournalEntry, DevelopmentDomain, WaitlistEntry, HrProfile, LeaveRequest, LeaveType, ContractType } from "@/lib/types";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { BarChart2, Bell, BookOpen, ClipboardList, CreditCard, FileText, List, Settings, LogOut, Stethoscope, TrendingUp, UserCheck } from "lucide-react";

type Tab = "overview" | "admissions" | "waitlist" | "medical" | "journal" | "billing" | "analytics" | "hr" | "reports" | "settings";

export default function OwnerDashboard() {
  const { appUser, firebaseUser, signOut } = useAuth();
  const { school } = useSchool();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [medChildren, setMedChildren] = useState<Child[]>([]);
  const [medLoading, setMedLoading] = useState(false);
  const [stats, setStats] = useState<CockpitStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [invoiceCursor, setInvoiceCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreInvoices, setHasMoreInvoices] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loadingAdmissions, setLoadingAdmissions] = useState(false);
  const { loading: schoolLoading } = useSchool();

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "owner") { router.replace("/"); return; }
    if (schoolLoading) return;

    let cancelled = false;
    const schoolId = school?.id ?? appUser.schoolId;

    async function loadDashboard() {
      if (!schoolId) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const [s, invoicePage] = await Promise.all([
          getCockpitStats(schoolId),
          getInvoicesForSchoolPage(schoolId),
        ]);
        const childPage = await getChildrenForSchoolPage(schoolId, {
          includePendingErasure: true,
        });

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

    return () => {
      cancelled = true;
    };
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

  const sendReminders = async () => {
    const outstanding = invoices.filter(i => i.status === "outstanding" || i.status === "overdue");
    toast.success(`Reminders queued for ${outstanding.length} families`);
    // In production: call a Cloud Function or API route to send WhatsApp/email
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const requestChildErasure = async (child: Child) => {
    if (!firebaseUser) return;

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/children/${child.id}/deletion`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setChildren(prev => prev.map(c => c.id === child.id
        ? {
            ...c,
            deletionStatus: "pending_erasure",
            deletionRequestedAt: new Date().toISOString(),
            deletionRequestedBy: appUser?.uid,
          }
        : c));
      toast.success(`${child.firstName} marked for erasure`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not request erasure");
    }
  };

  const permanentlyEraseChild = async (child: Child, confirmName: string) => {
    if (!firebaseUser) return;

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/children/${child.id}/deletion`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setChildren(prev => prev.filter(c => c.id !== child.id));
      toast.success("Child data permanently erased");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not erase child data");
    }
  };

  const collectedFormatted = stats ? `R${(stats.collectedMTD / 100).toLocaleString()}` : "—";
  const outstandingFormatted = stats ? `R${(stats.outstandingMTD / 100).toLocaleString()}` : "—";
  const attendanceRate = stats ? Math.round((stats.checkedInToday / Math.max(stats.totalChildren, 1)) * 100) : 0;

  const currentMonth = format(new Date(), "MMMM yyyy");
  const monthInvoices = invoices.filter(i => i.month === new Date().toISOString().slice(0, 7));

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
            {/* Today attendance */}
            <div className="card" style={{ background: "var(--brand)", color: "white", border: "none" }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, opacity: 0.8 }}>Today — {format(new Date(), "d MMMM")}</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{stats.checkedInToday}</span>
                <span style={{ fontSize: 20, opacity: 0.7, marginBottom: 4 }}>/ {stats.totalChildren} children</span>
              </div>
              <div style={{ marginTop: 12, background: "rgba(255,255,255,0.2)", borderRadius: 99, height: 6 }}>
                <div style={{
                  width: `${attendanceRate}%`, height: "100%",
                  background: "white", borderRadius: 99, transition: "width 1s ease",
                }} />
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.8 }}>{attendanceRate}% attendance rate</p>
            </div>

            {/* Financials */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="card">
                <div className="stat-label">{currentMonth} collected</div>
                <div className="stat-value" style={{ color: "var(--success)", marginTop: 4 }}>{collectedFormatted}</div>
              </div>
              <div className="card">
                <div className="stat-label">Outstanding</div>
                <div className="stat-value" style={{
                  color: stats.outstandingMTD > 0 ? "var(--warning)" : "var(--text)",
                  marginTop: 4,
                }}>{outstandingFormatted}</div>
                {stats.outstandingFamilies > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {stats.outstandingFamilies} {stats.outstandingFamilies === 1 ? "family" : "families"}
                  </div>
                )}
              </div>
            </div>

            {/* Capacity & staff */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="card">
                <div className="stat-label">Total capacity</div>
                <div className="stat-value" style={{ marginTop: 4 }}>{stats.totalCapacity}</div>
              </div>
              <div className="card">
                <div className="stat-label">Staff</div>
                <div className="stat-value" style={{ marginTop: 4 }}>{stats.staffCount}</div>
              </div>
            </div>

            {/* Alerts */}
            {(stats.photoConsentPending > 0 || stats.outstandingFamilies > 0) && (
              <div className="card" style={{ borderLeft: "3px solid var(--warning)", background: "#fffbeb" }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14, color: "#92400e" }}>
                  Actions needed
                </p>
                {stats.photoConsentPending > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13 }}>Photo consent pending</span>
                    <span className="pill pill-amber">{stats.photoConsentPending} forms</span>
                  </div>
                )}
                {stats.outstandingFamilies > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13 }}>Outstanding payments</span>
                    <span className="pill pill-red">{stats.outstandingFamilies} families</span>
                  </div>
                )}
                <button className="btn btn-secondary" style={{ width: "100%", fontSize: 13, marginTop: 4 }}
                  onClick={sendReminders}>
                  <Bell size={14} />
                  Send fee reminders
                </button>
              </div>
            )}

            {/* Branches */}
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

        {/* ── ADMISSIONS TAB ── */}
        {tab === "waitlist" && school && (
          <WaitlistPanel schoolId={school.id} schoolSlug={school.slug} firebaseUser={firebaseUser} />
        )}

        {tab === "admissions" && (
          <AdmissionsPanel
            schoolId={school?.id ?? appUser.schoolId ?? ""}
            firebaseUser={firebaseUser}
            admissions={admissions}
            setAdmissions={setAdmissions}
            loading={loadingAdmissions}
            setLoading={setLoadingAdmissions}
          />
        )}

        {tab === "medical" && (
          <MedicalPanel schoolId={school?.id ?? ""} />
        )}

        {tab === "journal" && (
          <OwnerJournalPanel schoolId={school?.id ?? ""} />
        )}

        {tab === "billing" && school && (
          <BillingPanel schoolId={school.id} schoolName={school.name} firebaseUser={firebaseUser} />
        )}

        {tab === "reports" && school && (
          <ReportsPanel schoolId={school.id} firebaseUser={firebaseUser} />
        )}

        {tab === "hr" && school && (
          <HrPanel schoolId={school.id} firebaseUser={firebaseUser} />
        )}

        {tab === "analytics" && school && (
          <AnalyticsPanel schoolId={school.id} firebaseUser={firebaseUser} />
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && school && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>School settings</h3>
            <div className="card">
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>
                  School name
                </label>
                <p style={{ margin: 0, fontSize: 15 }}>{school.name}</p>
              </div>
              <div className="divider" />
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Domain slug
                </label>
                <p style={{ margin: 0, fontSize: 15 }}>{school.slug}.littleloop.app</p>
              </div>
              <div className="divider" />
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Plan
                </label>
                <span className="pill pill-blue" style={{ textTransform: "capitalize" }}>{school.plan}</span>
              </div>
            </div>

            <div className="card">
              <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Branches</h4>
              {school.branches.map(b => (
                <div key={b.id} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14,
                }}>
                  <span>{b.name}</span>
                  {b.address && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{b.address}</span>}
                </div>
              ))}
            </div>

            <div className="card">
              <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>Invite staff or parents</h4>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
                They get a setup link to create their own password.
              </p>
              <InviteForm schoolId={school.id} schoolSlug={school.slug} />
            </div>

            <PrivacyErasurePanel
              childRecords={children}
              onRequestErasure={requestChildErasure}
              onPermanentErasure={permanentlyEraseChild}
            />

            <button className="btn btn-danger" style={{ width: "100%" }} onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {([
          { id: "overview", Icon: BarChart2, label: "Overview" },
          { id: "admissions", Icon: ClipboardList, label: "Admissions" },
          { id: "waitlist", Icon: List, label: "Waitlist" },
          { id: "medical", Icon: Stethoscope, label: "Medical" },
          { id: "journal", Icon: BookOpen, label: "Journal" },
          { id: "billing", Icon: CreditCard, label: "Billing" },
          { id: "analytics", Icon: TrendingUp, label: "Analytics" },
          { id: "hr", Icon: UserCheck, label: "HR" },
          { id: "reports", Icon: FileText, label: "Reports" },
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

function PrivacyErasurePanel({
  childRecords,
  onRequestErasure,
  onPermanentErasure,
}: {
  childRecords: Child[];
  onRequestErasure: (child: Child) => Promise<void>;
  onPermanentErasure: (child: Child, confirmName: string) => Promise<void>;
}) {
  const [confirmingChildId, setConfirmingChildId] = React.useState<string | null>(null);
  const [confirmName, setConfirmName] = React.useState("");
  const [savingChildId, setSavingChildId] = React.useState<string | null>(null);

  const handleRequest = async (child: Child) => {
    setSavingChildId(child.id);
    try {
      await onRequestErasure(child);
    } finally {
      setSavingChildId(null);
    }
  };

  const handlePermanentErasure = async (child: Child) => {
    setSavingChildId(child.id);
    try {
      await onPermanentErasure(child, confirmName.trim());
      setConfirmingChildId(null);
      setConfirmName("");
    } finally {
      setSavingChildId(null);
    }
  };

  return (
    <div className="card" style={{ borderLeft: "3px solid var(--danger)" }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>POPIA data erasure</h4>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
        Soft-delete first, then permanently erase child-linked updates, moments, invoices and messages after confirmation.
      </p>

      {childRecords.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No children found for this school.</p>
      ) : childRecords.map(child => {
        const fullName = `${child.firstName} ${child.lastName}`.trim();
        const isPending = child.deletionStatus === "pending_erasure";
        const isSaving = savingChildId === child.id;
        const isConfirming = confirmingChildId === child.id;

        return (
          <div
            key={child.id}
            style={{
              padding: "10px 0",
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{fullName}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  {isPending ? "Pending permanent erasure" : "Active child record"}
                </p>
              </div>
              <span className={`pill ${isPending ? "pill-red" : "pill-gray"}`}>
                {isPending ? "Pending" : "Active"}
              </span>
            </div>

            {!isPending ? (
              <button
                className="btn btn-secondary"
                style={{ width: "100%", fontSize: 13 }}
                disabled={isSaving}
                onClick={() => handleRequest(child)}
              >
                {isSaving ? <span className="spinner" /> : "Request erasure"}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {isConfirming && (
                  <input
                    className="input"
                    placeholder={`Type ${fullName} to confirm`}
                    value={confirmName}
                    onChange={event => setConfirmName(event.target.value)}
                  />
                )}
                <button
                  className="btn btn-danger"
                  style={{ width: "100%", fontSize: 13 }}
                  disabled={isSaving}
                  onClick={() => {
                    if (!isConfirming) {
                      setConfirmingChildId(child.id);
                      setConfirmName("");
                      return;
                    }
                    void handlePermanentErasure(child);
                  }}
                >
                  {isSaving ? <span className="spinner" /> : "Permanently erase data"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Inline invite component for owner dashboard
function InviteForm({ schoolId, schoolSlug }: { schoolId: string; schoolSlug: string }) {
  const [form, setForm] = React.useState({ email: "", displayName: "", role: "teacher", phone: "" });
  const [saving, setSaving] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);

  const handleInvite = async () => {
    if (!form.email || !form.displayName) { toast.error("Name and email required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, schoolId, schoolSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLink("sent");
      toast.success("Invite email sent!");
      setForm({ email: "", displayName: "", role: "teacher", phone: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
        <option value="teacher">Teacher</option>
        <option value="parent">Parent</option>
        <option value="owner">Owner</option>
      </select>
      <input className="input" placeholder="Full name" value={form.displayName}
        onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
      <input className="input" type="email" placeholder="Email address" value={form.email}
        onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
      <input className="input" type="tel" placeholder="Phone (WhatsApp) +27 xx xxx xxxx" value={form.phone}
        onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
      <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleInvite} disabled={saving}>
        {saving ? <span className="spinner" /> : "Generate invite link"}
      </button>
      {link && (
        <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#166534" }}>✓ Invite email sent</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#166534" }}>
            They&apos;ll get an email to set their password and access their dashboard.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Admissions Panel ─────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  reviewing: "Reviewing",
  approved: "Approved",
  declined: "Declined",
  enrolled: "Enrolled",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--amber)",
  reviewing: "var(--brand)",
  approved: "var(--green)",
  declined: "var(--red)",
  enrolled: "var(--green)",
};

function AdmissionsPanel({
  schoolId,
  firebaseUser,
  admissions,
  setAdmissions,
  loading,
  setLoading,
}: {
  schoolId: string;
  firebaseUser: import("firebase/auth").User | null;
  admissions: Admission[];
  setAdmissions: React.Dispatch<React.SetStateAction<Admission[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [selected, setSelected] = React.useState<Admission | null>(null);
  const [actioning, setActioning] = React.useState(false);
  const [internalNotes, setInternalNotes] = React.useState("");

  React.useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    getAdmissionsForSchool(schoolId)
      .then(setAdmissions)
      .finally(() => setLoading(false));
  }, [schoolId, setAdmissions, setLoading]);

  const getToken = async () => {
    if (!firebaseUser) throw new Error("Not authenticated");
    return firebaseUser.getIdToken();
  };

  const action = async (admissionId: string, act: "approve" | "decline" | "reviewing") => {
    setActioning(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admissions/${admissionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: act, internalNotes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Action failed");
      }
      const data = await res.json();
      setAdmissions(prev =>
        prev.map(a => a.id === admissionId ? { ...a, status: data.status, childId: data.childId } : a)
      );
      if (selected?.id === admissionId) {
        setSelected(prev => prev ? { ...prev, status: data.status } : null);
      }
      toast.success(
        act === "approve" ? "Approved — parent invite sent" :
        act === "decline" ? "Application declined" :
        "Marked as reviewing"
      );
      if (act !== "reviewing") setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /></div>;
  }

  // ── Detail view ──
  if (selected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <button
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)", fontSize: 14, fontWeight: 600, padding: 0, textAlign: "left" }}
          onClick={() => setSelected(null)}
        >
          ← Back
        </button>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ margin: "0 0 2px", fontSize: 17 }}>
                {selected.childFirstName} {selected.childLastName}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                DOB: {selected.childDateOfBirth}
                {selected.desiredStartDate ? ` · Start: ${selected.desiredStartDate}` : ""}
              </p>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
              background: `${STATUS_COLOR[selected.status]}22`,
              color: STATUS_COLOR[selected.status],
            }}>
              {STATUS_LABEL[selected.status]}
            </span>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>GUARDIAN</p>
            <p style={{ margin: "0 0 2px", fontSize: 14 }}>{selected.parentName}</p>
            <p style={{ margin: "0 0 2px", fontSize: 13, color: "var(--text-muted)" }}>{selected.parentEmail}</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{selected.parentPhone}</p>
          </div>

          {selected.notes && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>FROM APPLICANT</p>
              <p style={{ margin: 0, fontSize: 13 }}>{selected.notes}</p>
            </div>
          )}

          {selected.status === "pending" || selected.status === "reviewing" ? (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                className="input"
                rows={2}
                placeholder="Internal notes (optional)…"
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                style={{ resize: "none", fontSize: 13 }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => action(selected.id, "approve")}
                  disabled={actioning}
                >
                  {actioning ? <span className="spinner" /> : "✓ Approve & invite"}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, color: "var(--red)" }}
                  onClick={() => action(selected.id, "decline")}
                  disabled={actioning}
                >
                  Decline
                </button>
              </div>
            </div>
          ) : (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                {selected.status === "approved"
                  ? "Parent has been sent a setup email."
                  : "This application has been declined."}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ──
  const pending = admissions.filter(a => a.status === "pending" || a.status === "reviewing");
  const actioned = admissions.filter(a => a.status === "approved" || a.status === "declined" || a.status === "enrolled");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Share link */}
      <div className="card" style={{ background: "var(--brand-light)" }}>
        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14, color: "var(--brand)" }}>
          Application link
        </p>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-muted)" }}>
          Share this link with prospective parents
        </p>
        <div style={{
          background: "var(--surface)", borderRadius: 8,
          padding: "8px 12px", fontSize: 12, fontFamily: "monospace",
          color: "var(--text)", wordBreak: "break-all",
          border: "1px solid var(--border)",
        }}>
          {typeof window !== "undefined" ? `${window.location.origin}/apply` : "/apply"}
        </div>
        <button
          className="btn btn-secondary"
          style={{ marginTop: 10, fontSize: 13, width: "100%" }}
          onClick={() => {
            const url = `${window.location.origin}/apply`;
            navigator.clipboard?.writeText(url);
            toast.success("Link copied!");
          }}
        >
          Copy link
        </button>
      </div>

      {/* Pending */}
      <div>
        <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 15 }}>
          Needs review ({pending.length})
        </p>
        {pending.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No pending applications.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map(a => (
              <div
                key={a.id}
                className="card"
                style={{ cursor: "pointer" }}
                onClick={() => { setSelected(a); setInternalNotes(a.internalNotes ?? ""); action(a.id, "reviewing"); }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 15 }}>
                      {a.childFirstName} {a.childLastName}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                      {a.parentName} · {format(new Date(a.createdAt), "d MMM yyyy")}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                    background: `${STATUS_COLOR[a.status]}22`,
                    color: STATUS_COLOR[a.status],
                  }}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actioned */}
      {actioned.length > 0 && (
        <div>
          <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 15 }}>
            Actioned ({actioned.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {actioned.map(a => (
              <div
                key={a.id}
                className="card"
                style={{ opacity: 0.7, cursor: "pointer" }}
                onClick={() => setSelected(a)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14 }}>
                      {a.childFirstName} {a.childLastName}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                      {a.parentName}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                    background: `${STATUS_COLOR[a.status]}22`,
                    color: STATUS_COLOR[a.status],
                  }}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Medical Panel ────────────────────────────────────────────────────────────

function MedicalPanel({ schoolId }: { schoolId: string }) {
  const { firebaseUser } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable form state
  const [allergies, setAllergies] = useState<MedicalRecord["allergies"]>([]);
  const [medications, setMedications] = useState<MedicalRecord["medications"]>([]);
  const [conditions, setConditions] = useState<MedicalRecord["conditions"]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<MedicalRecord["emergencyContacts"]>([]);
  const [dietary, setDietary] = useState<MedicalRecord["dietary"]>({
    vegetarian: false, vegan: false, halal: false, kosher: false, glutenFree: false, dairyFree: false,
  });
  const [bloodType, setBloodType] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorPractice, setDoctorPractice] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");
  const [medicalAidProvider, setMedicalAidProvider] = useState("");
  const [medicalAidNumber, setMedicalAidNumber] = useState("");
  const [medicalAidDependantCode, setMedicalAidDependantCode] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!schoolId) return;
    import("@/lib/db").then(({ getChildrenForSchool }) => {
      getChildrenForSchool(schoolId).then(kids => {
        setChildren(kids);
        setLoading(false);
      });
    });
  }, [schoolId]);

  async function loadRecord(child: Child) {
    setSelectedChild(child);
    setRecordLoading(true);
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(`/api/children/${child.id}/medical`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const { data } = await res.json();
      const rec: MedicalRecord | null = data;
      setRecord(rec);
      // Populate form
      setAllergies(rec?.allergies ?? []);
      setMedications(rec?.medications ?? []);
      setConditions(rec?.conditions ?? []);
      setEmergencyContacts(rec?.emergencyContacts ?? []);
      setDietary(rec?.dietary ?? { vegetarian: false, vegan: false, halal: false, kosher: false, glutenFree: false, dairyFree: false });
      setBloodType(rec?.bloodType ?? "");
      setDoctorName(rec?.doctorName ?? "");
      setDoctorPractice(rec?.doctorPractice ?? "");
      setDoctorPhone(rec?.doctorPhone ?? "");
      setMedicalAidProvider(rec?.medicalAidProvider ?? "");
      setMedicalAidNumber(rec?.medicalAidNumber ?? "");
      setMedicalAidDependantCode(rec?.medicalAidDependantCode ?? "");
      setNotes(rec?.notes ?? "");
    } catch {
      toast.error("Could not load medical record");
    } finally {
      setRecordLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedChild) return;
    setSaving(true);
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(`/api/children/${selectedChild.id}/medical`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          allergies, medications, conditions, emergencyContacts,
          dietary, bloodType, doctorName, doctorPractice, doctorPhone,
          medicalAidProvider, medicalAidNumber, medicalAidDependantCode, notes,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Medical record saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  const SEVERITY_OPTIONS = ["mild", "moderate", "severe", "anaphylactic"] as const;
  const BLOOD_TYPES = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Unknown"];

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)", color: "var(--text)" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 };
  const sectionStyle: React.CSSProperties = { borderRadius: 12, border: "1px solid var(--border)", padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 12 };

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading children…</div>;

  // ── Child list view ──
  if (!selectedChild) {
    return (
      <div style={{ padding: "0 0 32px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>Medical Records</h2>
        {children.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No enrolled children.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => loadRecord(child)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: "var(--primary)", flexShrink: 0 }}>
                  {child.firstName[0]}{child.lastName[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{child.firstName} {child.lastName}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Tap to view / edit medical record</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Record edit view ──
  if (recordLoading) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => setSelectedChild(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontSize: 13, fontWeight: 600, padding: 0 }}>
          ← Back
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{selectedChild.firstName} {selectedChild.lastName} — Medical</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Allergies */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ ...labelStyle, marginBottom: 0 }}>Allergies</p>
            <button onClick={() => setAllergies(a => [...a, { name: "", severity: "mild" }])} style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>+ Add</button>
          </div>
          {allergies.map((a, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 8, background: "var(--surface-2)" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 2 }} placeholder="Name (e.g. Peanuts)" value={a.name} onChange={e => { const n = [...allergies]; n[i] = { ...n[i], name: e.target.value }; setAllergies(n); }} />
                <select style={{ ...inputStyle, flex: 1 }} value={a.severity} onChange={e => { const n = [...allergies]; n[i] = { ...n[i], severity: e.target.value as typeof a.severity }; setAllergies(n); }}>
                  {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setAllergies(a => a.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 18, padding: "0 4px" }}>×</button>
              </div>
              <input style={inputStyle} placeholder="Reaction (e.g. hives, swelling)" value={a.reaction ?? ""} onChange={e => { const n = [...allergies]; n[i] = { ...n[i], reaction: e.target.value }; setAllergies(n); }} />
              <input style={inputStyle} placeholder="Treatment (e.g. Administer EpiPen, call ambulance)" value={a.treatment ?? ""} onChange={e => { const n = [...allergies]; n[i] = { ...n[i], treatment: e.target.value }; setAllergies(n); }} />
            </div>
          ))}
          {allergies.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No allergies recorded.</p>}
        </div>

        {/* Medications */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ ...labelStyle, marginBottom: 0 }}>Medications</p>
            <button onClick={() => setMedications(m => [...m, { name: "", dose: "", frequency: "" }])} style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>+ Add</button>
          </div>
          {medications.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 8, background: "var(--surface-2)" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 2 }} placeholder="Medication name" value={m.name} onChange={e => { const n = [...medications]; n[i] = { ...n[i], name: e.target.value }; setMedications(n); }} />
                <button onClick={() => setMedications(m => m.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 18, padding: "0 4px" }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Dose (e.g. 2 puffs)" value={m.dose} onChange={e => { const n = [...medications]; n[i] = { ...n[i], dose: e.target.value }; setMedications(n); }} />
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Frequency (e.g. as needed)" value={m.frequency} onChange={e => { const n = [...medications]; n[i] = { ...n[i], frequency: e.target.value }; setMedications(n); }} />
              </div>
              <input style={inputStyle} placeholder="Special instructions" value={m.instructions ?? ""} onChange={e => { const n = [...medications]; n[i] = { ...n[i], instructions: e.target.value }; setMedications(n); }} />
            </div>
          ))}
          {medications.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No medications recorded.</p>}
        </div>

        {/* Conditions */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ ...labelStyle, marginBottom: 0 }}>Medical Conditions</p>
            <button onClick={() => setConditions(c => [...c, { name: "" }])} style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>+ Add</button>
          </div>
          {conditions.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle, flex: 2 }} placeholder="Condition (e.g. Asthma, ADHD)" value={c.name} onChange={e => { const n = [...conditions]; n[i] = { ...n[i], name: e.target.value }; setConditions(n); }} />
              <input style={{ ...inputStyle, flex: 3 }} placeholder="Notes" value={c.notes ?? ""} onChange={e => { const n = [...conditions]; n[i] = { ...n[i], notes: e.target.value }; setConditions(n); }} />
              <button onClick={() => setConditions(c => c.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 18, padding: "0 4px" }}>×</button>
            </div>
          ))}
          {conditions.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No conditions recorded.</p>}
        </div>

        {/* Dietary */}
        <div style={sectionStyle}>
          <p style={labelStyle}>Dietary Requirements</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {(["vegetarian", "vegan", "halal", "kosher", "glutenFree", "dairyFree"] as const).map(key => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={dietary[key]} onChange={e => setDietary(d => ({ ...d, [key]: e.target.checked }))} />
                {key === "glutenFree" ? "Gluten-free" : key === "dairyFree" ? "Dairy-free" : key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
            ))}
          </div>
          <div>
            <label style={labelStyle}>Other dietary notes</label>
            <input style={inputStyle} placeholder="e.g. No pork products" value={dietary.other ?? ""} onChange={e => setDietary(d => ({ ...d, other: e.target.value }))} />
          </div>
        </div>

        {/* Emergency Contacts */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ ...labelStyle, marginBottom: 0 }}>Emergency Contacts</p>
            <button onClick={() => setEmergencyContacts(c => [...c, { name: "", relationship: "", phone: "", canPickup: false }])} style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>+ Add</button>
          </div>
          {emergencyContacts.map((ec, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 8, background: "var(--surface-2)" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 2 }} placeholder="Name" value={ec.name} onChange={e => { const n = [...emergencyContacts]; n[i] = { ...n[i], name: e.target.value }; setEmergencyContacts(n); }} />
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Relationship" value={ec.relationship} onChange={e => { const n = [...emergencyContacts]; n[i] = { ...n[i], relationship: e.target.value }; setEmergencyContacts(n); }} />
                <button onClick={() => setEmergencyContacts(c => c.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 18, padding: "0 4px" }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Phone number" value={ec.phone} onChange={e => { const n = [...emergencyContacts]; n[i] = { ...n[i], phone: e.target.value }; setEmergencyContacts(n); }} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={ec.canPickup} onChange={e => { const n = [...emergencyContacts]; n[i] = { ...n[i], canPickup: e.target.checked }; setEmergencyContacts(n); }} />
                  Authorised pickup
                </label>
              </div>
            </div>
          ))}
          {emergencyContacts.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No emergency contacts added.</p>}
        </div>

        {/* Doctor & Medical Aid */}
        <div style={sectionStyle}>
          <p style={labelStyle}>Doctor</p>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Name</label><input style={inputStyle} value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr Smith" /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Practice</label><input style={inputStyle} value={doctorPractice} onChange={e => setDoctorPractice(e.target.value)} placeholder="City Medical" /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Phone</label><input style={inputStyle} value={doctorPhone} onChange={e => setDoctorPhone(e.target.value)} placeholder="011 000 0000" /></div>
          </div>
          <p style={{ ...labelStyle, marginTop: 4 }}>Medical Aid</p>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Provider</label><input style={inputStyle} value={medicalAidProvider} onChange={e => setMedicalAidProvider(e.target.value)} placeholder="Discovery" /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Member No.</label><input style={inputStyle} value={medicalAidNumber} onChange={e => setMedicalAidNumber(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Dependant Code</label><input style={inputStyle} value={medicalAidDependantCode} onChange={e => setMedicalAidDependantCode(e.target.value)} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Blood Type</label>
              <select style={inputStyle} value={bloodType} onChange={e => setBloodType(e.target.value)}>
                <option value="">Unknown</option>
                {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* General Notes */}
        <div style={sectionStyle}>
          <label style={labelStyle}>General Notes</label>
          <textarea style={{ ...inputStyle, resize: "none" }} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any other information staff should know…" />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: "14px 0", borderRadius: 12, background: "var(--primary)", color: "#fff", border: "none", fontWeight: 700, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Save Medical Record"}
        </button>

      </div>
    </div>
  );
}

// ─── Owner Journal Panel ──────────────────────────────────────────────────────

function OwnerJournalPanel({ schoolId }: { schoolId: string }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DevelopmentDomain | "all">("all");

  useEffect(() => {
    if (!schoolId) return;
    import("@/lib/db").then(({ getJournalEntriesForSchool }) =>
      getJournalEntriesForSchool(schoolId)
    ).then(e => { setEntries(e); setLoading(false); });
  }, [schoolId]);

  const domainLabels: Record<DevelopmentDomain, string> = {
    physical: "🏃 Physical", cognitive: "🧠 Cognitive", language: "💬 Language",
    social: "🤝 Social", emotional: "💛 Emotional", creative: "🎨 Creative",
  };

  const filtered = filter === "all" ? entries : entries.filter(e => e.domains.includes(filter));

  // Domain frequency count for insight chips
  const domainCounts: Record<string, number> = {};
  entries.forEach(e => e.domains.forEach(d => { domainCounts[d] = (domainCounts[d] ?? 0) + 1; }));

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Learning Journals</h2>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{entries.length} entries</span>
      </div>

      {/* Domain breakdown */}
      {entries.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => setFilter("all")}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: filter === "all" ? "2px solid var(--primary)" : "1px solid var(--border)", background: filter === "all" ? "var(--primary-light)" : "var(--surface-2)", color: filter === "all" ? "var(--primary)" : "var(--text-muted)" }}
          >
            All ({entries.length})
          </button>
          {(Object.keys(domainCounts) as DevelopmentDomain[]).map(d => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: filter === d ? "2px solid var(--primary)" : "1px solid var(--border)", background: filter === d ? "var(--primary-light)" : "var(--surface-2)", color: filter === d ? "var(--primary)" : "var(--text-muted)" }}
            >
              {domainLabels[d]} ({domainCounts[d]})
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No journal entries yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(entry => (
            <div key={entry.id} style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 14, background: "var(--surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{entry.title}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{entry.childName}</p>
                </div>
                <span style={{ fontSize: 11, color: entry.sharedWithParent ? "#16a34a" : "var(--text-muted)", background: entry.sharedWithParent ? "#dcfce7" : "var(--surface-2)", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>
                  {entry.sharedWithParent ? "Shared" : "Draft"}
                </span>
              </div>
              <p style={{ margin: "6px 0 8px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>{entry.observation}</p>
              {entry.domains.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                  {entry.domains.map(d => (
                    <span key={d} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--primary-light)", color: "var(--primary)", fontWeight: 600 }}>{domainLabels[d]}</span>
                  ))}
                </div>
              )}
              {entry.photoUrls.length > 0 && (
                <div style={{ display: "flex", gap: 4 }}>
                  {entry.photoUrls.slice(0, 3).map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
                  ))}
                  {entry.photoUrls.length > 3 && <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>+{entry.photoUrls.length - 3}</span>}
                </div>
              )}
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                {new Date(entry.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })} · {entry.authorName}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Billing Panel ────────────────────────────────────────────────────────────

import type { User } from "firebase/auth";

function BillingPanel({
  schoolId, schoolName, firebaseUser,
}: { schoolId: string; schoolName: string; firebaseUser: User | null }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Invoice["status"] | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Create form state
  const [cfChildId, setCfChildId] = useState("");
  const [cfMonth, setCfMonth] = useState(new Date().toISOString().slice(0, 7));
  const [cfAmount, setCfAmount] = useState("");
  const [cfDueDate, setCfDueDate] = useState("");
  const [cfDesc, setCfDesc] = useState("");
  const [cfSaving, setCfSaving] = useState(false);

  // Bulk form state
  const [bfMonth, setBfMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bfAmount, setBfAmount] = useState("");
  const [bfDueDate, setBfDueDate] = useState("");
  const [bfDesc, setBfDesc] = useState("");
  const [bfSaving, setBfSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      import("@/lib/db").then(({ getInvoicesForSchool }) => getInvoicesForSchool(schoolId)),
      import("@/lib/db").then(({ getChildrenForSchool }) => getChildrenForSchool(schoolId)),
    ]).then(([invs, kids]) => {
      // Auto-detect overdue client-side
      const today = new Date().toISOString().split("T")[0];
      const updated = invs.map(inv =>
        inv.status === "outstanding" && inv.dueDate < today
          ? { ...inv, status: "overdue" as const }
          : inv
      );
      setInvoices(updated);
      setChildren(kids);
      setLoading(false);
    });
  }, [schoolId]);

  async function getToken() { return firebaseUser?.getIdToken() ?? ""; }

  async function handleCreate() {
    if (!cfChildId || !cfMonth || !cfAmount || !cfDueDate) return;
    setCfSaving(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          childId: cfChildId, month: cfMonth,
          amountCents: Math.round(parseFloat(cfAmount) * 100),
          dueDate: cfDueDate, description: cfDesc,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { invoiceId } = await res.json();
      const child = children.find(c => c.id === cfChildId);
      const newInv: Invoice = {
        id: invoiceId, schoolId, branchId: child?.branchId ?? "",
        parentId: child?.parentIds?.[0] ?? "", childId: cfChildId,
        childName: child ? `${child.firstName} ${child.lastName}` : cfChildId,
        month: cfMonth, description: cfDesc || `Tuition — ${cfMonth}`,
        amountCents: Math.round(parseFloat(cfAmount) * 100),
        dueDate: cfDueDate, status: "outstanding",
        lineItems: [], createdAt: new Date().toISOString(),
      };
      setInvoices(prev => [newInv, ...prev]);
      toast.success("Invoice created");
      setShowCreate(false);
      setCfChildId(""); setCfMonth(new Date().toISOString().slice(0, 7));
      setCfAmount(""); setCfDueDate(""); setCfDesc("");
    } catch { toast.error("Failed to create invoice"); }
    finally { setCfSaving(false); }
  }

  async function handleBulk() {
    if (!bfMonth || !bfAmount || !bfDueDate) return;
    setBfSaving(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/invoices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          month: bfMonth,
          amountCents: Math.round(parseFloat(bfAmount) * 100),
          dueDate: bfDueDate, description: bfDesc,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { created, skipped } = await res.json();
      toast.success(`${created} invoices created${skipped ? `, ${skipped} skipped (already exist)` : ""}`);
      setShowBulk(false);
      // Reload
      const { getInvoicesForSchool } = await import("@/lib/db");
      const today = new Date().toISOString().split("T")[0];
      const invs = (await getInvoicesForSchool(schoolId)).map(inv =>
        inv.status === "outstanding" && inv.dueDate < today ? { ...inv, status: "overdue" as const } : inv
      );
      setInvoices(invs);
    } catch { toast.error("Failed to generate invoices"); }
    finally { setBfSaving(false); }
  }

  async function handleConfirmPaid(inv: Invoice) {
    setConfirming(inv.id);
    try {
      const { updateInvoiceStatus } = await import("@/lib/db");
      await updateInvoiceStatus(inv.id, "paid");
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: "paid" } : i));
      toast.success("Marked as paid");
    } catch { toast.error("Failed"); }
    finally { setConfirming(null); }
  }

  async function handleRemind(inv: Invoice) {
    setSending(inv.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/invoices/${inv.id}/remind`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Reminder sent");
    } catch { toast.error("Failed to send reminder"); }
    finally { setSending(null); }
  }

  const filtered = statusFilter === "all" ? invoices : invoices.filter(i => i.status === statusFilter);

  // Counts
  const counts = { all: invoices.length, outstanding: 0, overdue: 0, paid: 0, draft: 0 };
  invoices.forEach(i => { counts[i.status] = (counts[i.status] ?? 0) + 1; });

  // Revenue
  const totalOutstanding = invoices
    .filter(i => ["outstanding","overdue"].includes(i.status))
    .reduce((s, i) => s + i.amountCents, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amountCents, 0);

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)", color: "var(--text)" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 };

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 32 }}>

      {/* Revenue summary */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, borderRadius: 12, border: "1px solid var(--border)", padding: 14, background: "var(--surface)", textAlign: "center" }}>
          <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Outstanding</p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#d97706" }}>R{(totalOutstanding / 100).toLocaleString("en-ZA")}</p>
        </div>
        <div style={{ flex: 1, borderRadius: 12, border: "1px solid var(--border)", padding: 14, background: "var(--surface)", textAlign: "center" }}>
          <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Collected</p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#16a34a" }}>R{(totalPaid / 100).toLocaleString("en-ZA")}</p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { setShowCreate(true); setShowBulk(false); }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Create Invoice
        </button>
        <button onClick={() => { setShowBulk(true); setShowCreate(false); }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "var(--text)" }}>
          ⚡ Bulk Generate
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ borderRadius: 14, border: "2px solid var(--primary)", padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>New Invoice</p>
            <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20 }}>×</button>
          </div>
          <div>
            <label style={labelStyle}>Child</label>
            <select style={inputStyle} value={cfChildId} onChange={e => setCfChildId(e.target.value)}>
              <option value="">Select child…</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Month</label><input style={inputStyle} type="month" value={cfMonth} onChange={e => setCfMonth(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Due Date</label><input style={inputStyle} type="date" value={cfDueDate} onChange={e => setCfDueDate(e.target.value)} /></div>
          </div>
          <div><label style={labelStyle}>Amount (R)</label><input style={inputStyle} type="number" min="0" step="0.01" placeholder="2500.00" value={cfAmount} onChange={e => setCfAmount(e.target.value)} /></div>
          <div><label style={labelStyle}>Description (optional)</label><input style={inputStyle} placeholder="Monthly tuition" value={cfDesc} onChange={e => setCfDesc(e.target.value)} /></div>
          <button onClick={handleCreate} disabled={cfSaving || !cfChildId || !cfAmount || !cfDueDate} style={{ padding: "12px 0", borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: (cfSaving || !cfChildId || !cfAmount || !cfDueDate) ? 0.6 : 1 }}>
            {cfSaving ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      )}

      {/* Bulk form */}
      {showBulk && (
        <div style={{ borderRadius: 14, border: "2px solid #d97706", padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 15 }}>Bulk Generate</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Creates one invoice per enrolled child. Skips existing.</p>
            </div>
            <button onClick={() => setShowBulk(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Month</label><input style={inputStyle} type="month" value={bfMonth} onChange={e => setBfMonth(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Due Date</label><input style={inputStyle} type="date" value={bfDueDate} onChange={e => setBfDueDate(e.target.value)} /></div>
          </div>
          <div><label style={labelStyle}>Amount per child (R)</label><input style={inputStyle} type="number" min="0" step="0.01" placeholder="2500.00" value={bfAmount} onChange={e => setBfAmount(e.target.value)} /></div>
          <div><label style={labelStyle}>Description (optional)</label><input style={inputStyle} placeholder="Monthly tuition" value={bfDesc} onChange={e => setBfDesc(e.target.value)} /></div>
          <button onClick={handleBulk} disabled={bfSaving || !bfAmount || !bfDueDate} style={{ padding: "12px 0", borderRadius: 10, background: "#d97706", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: (bfSaving || !bfAmount || !bfDueDate) ? 0.6 : 1 }}>
            {bfSaving ? "Generating…" : `Generate for all ${children.length} children`}
          </button>
        </div>
      )}

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["all", "outstanding", "overdue", "paid"] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: statusFilter === s ? "2px solid var(--primary)" : "1px solid var(--border)", background: statusFilter === s ? "var(--primary-light)" : "var(--surface-2)", color: statusFilter === s ? "var(--primary)" : "var(--text-muted)" }}>
            {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No invoices.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(inv => {
            const isOverdue = inv.status === "overdue";
            const borderColor = isOverdue ? "#dc2626" : inv.status === "paid" ? "#16a34a" : "var(--border)";
            return (
              <div key={inv.id} style={{ borderRadius: 12, border: `1px solid ${borderColor}`, padding: 14, background: "var(--surface)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14 }}>{inv.childName}</p>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>R{(inv.amountCents / 100).toLocaleString("en-ZA")}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      {inv.description ?? `Tuition — ${inv.month}`} · Due {new Date(inv.dueDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    background: isOverdue ? "#fee2e2" : inv.status === "paid" ? "#dcfce7" : "#fef3c7",
                    color: isOverdue ? "#dc2626" : inv.status === "paid" ? "#16a34a" : "#d97706",
                  }}>
                    {inv.status.toUpperCase()}
                  </span>
                </div>

                {/* Proof uploaded — pending verification */}
                {inv.proofUrl && inv.status !== "paid" && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <button onClick={() => handleConfirmPaid(inv)} disabled={confirming === inv.id} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "#16a34a", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      {confirming === inv.id ? "Confirming…" : "✓ Confirm Paid"}
                    </button>
                    <a href={inv.proofUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", textDecoration: "none" }}>
                      View Proof
                    </a>
                  </div>
                )}

                {/* Actions for unpaid */}
                {inv.status !== "paid" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {!inv.proofUrl && (
                      <button onClick={() => handleConfirmPaid(inv)} disabled={confirming === inv.id} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontWeight: 600, fontSize: 12, cursor: "pointer", color: "var(--text)" }}>
                        {confirming === inv.id ? "…" : "Mark Paid"}
                      </button>
                    )}
                    <button onClick={() => handleRemind(inv)} disabled={sending === inv.id} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontWeight: 600, fontSize: 12, cursor: "pointer", color: "var(--text)" }}>
                      {sending === inv.id ? "Sending…" : "🔔 Remind"}
                    </button>
                  </div>
                )}

                {inv.status === "paid" && inv.paidAt && (
                  <p style={{ margin: 0, fontSize: 12, color: "#16a34a" }}>✓ Paid {new Date(inv.paidAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────

interface AnalyticsData {
  attendanceTrend: { date: string; rate: number; checkedIn: number; total: number }[];
  revenueTrend: { month: string; collectedCents: number; outstandingCents: number; overdueCents: number }[];
  domainCounts: Record<string, number>;
  journalCount: number;
  admissionsFunnel: Record<string, number>;
  occupancy: { enrolled: number; capacity: number; rate: number };
  collection: { collectedCents: number; outstandingCents: number; overdueCents: number; rate: number };
}

function AnalyticsPanel({ schoolId, firebaseUser }: { schoolId: string; firebaseUser: User | null }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !firebaseUser) return;
    firebaseUser.getIdToken().then(token =>
      fetch("/api/analytics", { headers: { Authorization: `Bearer ${token}` } })
    ).then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [schoolId, firebaseUser]);

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading analytics…</div>;
  if (error || !data) return <div style={{ padding: 24, color: "#dc2626" }}>Failed to load analytics.</div>;

  const domainLabels: Record<string, string> = {
    physical: "🏃 Physical", cognitive: "🧠 Cognitive", language: "💬 Language",
    social: "🤝 Social", emotional: "💛 Emotional", creative: "🎨 Creative",
  };
  const DOMAIN_COLORS: Record<string, string> = {
    physical: "#3b82f6", cognitive: "#8b5cf6", language: "#10b981",
    social: "#f59e0b", emotional: "#ec4899", creative: "#f97316",
  };

  // SVG bar chart helpers
  const BAR_W = 8;
  const BAR_GAP = 3;
  const CHART_H = 80;

  function BarChart({ values, colors, labels, formatVal }: {
    values: number[][], colors: string[], labels: string[], formatVal?: (v: number) => string
  }) {
    const maxVal = Math.max(...values.flat(), 1);
    const totalBars = values[0].length;
    const svgW = totalBars * (BAR_W * values.length + BAR_GAP * (values.length - 1) + 4);
    return (
      <svg viewBox={`0 0 ${svgW} ${CHART_H + 16}`} style={{ width: "100%", height: CHART_H + 16 }}>
        {values[0].map((_, i) => (
          values.map((series, si) => {
            const barH = Math.max(2, (series[i] / maxVal) * CHART_H);
            const x = i * (BAR_W * values.length + BAR_GAP * (values.length - 1) + 4) + si * (BAR_W + BAR_GAP);
            return (
              <g key={`${i}-${si}`}>
                <rect x={x} y={CHART_H - barH} width={BAR_W} height={barH} rx={2} fill={colors[si]} opacity={0.85} />
              </g>
            );
          })
        ))}
      </svg>
    );
  }

  // Attendance: last 14 days for readability
  const attLast14 = data.attendanceTrend.slice(-14);
  const attMax = 100;

  // Revenue: last 6 months
  const revMax = Math.max(...data.revenueTrend.map(r => r.collectedCents + r.outstandingCents + r.overdueCents), 1);

  const sectionStyle: React.CSSProperties = { borderRadius: 14, border: "1px solid var(--border)", padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 12 };
  const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, margin: 0 };
  const metaStyle: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", margin: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Analytics</h2>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Occupancy", value: `${data.occupancy.rate}%`, sub: `${data.occupancy.enrolled}/${data.occupancy.capacity} spots`, color: data.occupancy.rate >= 80 ? "#16a34a" : "#d97706" },
          { label: "Collection", value: `${data.collection.rate}%`, sub: `R${(data.collection.collectedCents / 100).toLocaleString("en-ZA")} paid`, color: data.collection.rate >= 80 ? "#16a34a" : "#dc2626" },
          { label: "Journals", value: String(data.journalCount), sub: "total entries", color: "var(--primary)" },
        ].map(kpi => (
          <div key={kpi.label} style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 12, background: "var(--surface)", textAlign: "center" }}>
            <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</p>
            <p style={{ margin: "0 0 2px", fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Attendance trend */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={sectionTitle}>Attendance — Last 14 Days</p>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
            avg {Math.round(attLast14.reduce((s, d) => s + d.rate, 0) / (attLast14.length || 1))}%
          </span>
        </div>
        <svg viewBox={`0 0 ${attLast14.length * 16} ${CHART_H + 16}`} style={{ width: "100%", height: CHART_H + 16 }}>
          {attLast14.map((d, i) => {
            const barH = Math.max(2, (d.rate / 100) * CHART_H);
            const x = i * 16;
            const color = d.rate >= 80 ? "#16a34a" : d.rate >= 50 ? "#d97706" : "#dc2626";
            return (
              <g key={d.date}>
                <rect x={x + 1} y={CHART_H - barH} width={12} height={barH} rx={3} fill={color} opacity={0.8} />
                {i % 7 === 0 && (
                  <text x={x + 6} y={CHART_H + 12} fontSize={8} fill="var(--text-muted)" textAnchor="middle">
                    {new Date(d.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div style={{ display: "flex", gap: 12 }}>
          {[["#16a34a", "≥80%"], ["#d97706", "50–79%"], ["#dc2626", "<50%"]].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* Revenue trend */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Revenue — Last 6 Months</p>
        <svg viewBox={`0 0 ${data.revenueTrend.length * 40} ${CHART_H + 20}`} style={{ width: "100%", height: CHART_H + 20 }}>
          {data.revenueTrend.map((r, i) => {
            const totalH = CHART_H;
            const collH = Math.max(0, (r.collectedCents / revMax) * totalH);
            const outH = Math.max(0, (r.outstandingCents / revMax) * totalH);
            const ovdH = Math.max(0, (r.overdueCents / revMax) * totalH);
            const x = i * 40 + 2;
            const W = 34;
            const label = r.month.slice(5); // "MM"
            return (
              <g key={r.month}>
                <rect x={x} y={totalH - collH} width={W} height={Math.max(2, collH)} rx={3} fill="#16a34a" opacity={0.85} />
                <rect x={x} y={totalH - collH - outH} width={W} height={Math.max(0, outH)} rx={3} fill="#d97706" opacity={0.7} />
                <rect x={x} y={totalH - collH - outH - ovdH} width={W} height={Math.max(0, ovdH)} rx={3} fill="#dc2626" opacity={0.7} />
                <text x={x + W / 2} y={CHART_H + 14} fontSize={9} fill="var(--text-muted)" textAnchor="middle">{label}</text>
              </g>
            );
          })}
        </svg>
        <div style={{ display: "flex", gap: 14 }}>
          {[["#16a34a", "Paid"], ["#d97706", "Outstanding"], ["#dc2626", "Overdue"]].map(([c, l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* Journal domain coverage */}
      {Object.keys(data.domainCounts).length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitle}>Journal Domain Coverage</p>
          {Object.entries(data.domainCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([domain, count]) => {
              const maxCount = Math.max(...Object.values(data.domainCounts));
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={domain}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{domainLabels[domain] ?? domain}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{count}</span>
                  </div>
                  <div style={{ background: "var(--surface-2)", borderRadius: 99, height: 6 }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: DOMAIN_COLORS[domain] ?? "var(--primary)", transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          {Object.keys(domainLabels).filter(d => !data.domainCounts[d]).length > 0 && (
            <p style={{ ...metaStyle, marginTop: 4 }}>
              ⚠️ No entries yet: {Object.keys(domainLabels).filter(d => !data.domainCounts[d]).map(d => domainLabels[d]).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Admissions funnel */}
      <div style={sectionStyle}>
        <p style={sectionTitle}>Admissions Pipeline</p>
        <div style={{ display: "flex", gap: 6 }}>
          {(["pending","reviewing","approved","enrolled","declined"] as const).map(s => {
            const colors: Record<string, [string, string]> = {
              pending: ["#fef3c7","#d97706"], reviewing: ["#dbeafe","#3b82f6"],
              approved: ["#dcfce7","#16a34a"], enrolled: ["#f0fdf4","#15803d"],
              declined: ["#fee2e2","#dc2626"],
            };
            const [bg, fg] = colors[s];
            return (
              <div key={s} style={{ flex: 1, textAlign: "center", background: bg, borderRadius: 10, padding: "10px 4px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: fg }}>{data.admissionsFunnel[s] ?? 0}</p>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: fg, textTransform: "uppercase" }}>{s}</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

// ─── Waitlist Panel ───────────────────────────────────────────────────────────

function WaitlistPanel({ schoolId, schoolSlug, firebaseUser }: {
  schoolId: string; schoolSlug: string; firebaseUser: User | null;
}) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WaitlistEntry["status"] | "all">("waiting");
  const [selected, setSelected] = useState<WaitlistEntry | null>(null);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);
  const [copied, setCopied] = useState(false);

  const waitlistUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/waitlist`;

  useEffect(() => {
    if (!schoolId || !firebaseUser) return;
    firebaseUser.getIdToken().then(token =>
      fetch(`/api/waitlist/school/${schoolId}`, { headers: { Authorization: `Bearer ${token}` } })
    ).then(r => r.json())
      .then(({ entries: e }) => { setEntries(e ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [schoolId, firebaseUser]);

  async function action(entryId: string, act: string, internalNotes?: string) {
    setActing(true);
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(`/api/waitlist/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: act, internalNotes }),
      });
      if (!res.ok) throw new Error("Action failed");
      const result = await res.json();

      setEntries(prev => prev.map(e =>
        e.id === entryId
          ? { ...e, status: act === "offer" ? "offered" : act === "decline" ? "declined" : act === "convert" ? "converted" : e.status, internalNotes: internalNotes ?? e.internalNotes }
          : e
      ));

      if (act === "convert" && result.admissionId) {
        toast.success("Converted to admission — find them in the Admissions tab");
      } else if (act === "offer") {
        toast.success("Place offered");
      } else if (act === "decline") {
        toast.success("Entry declined");
      } else {
        toast.success("Notes saved");
      }
      setSelected(null);
    } catch { toast.error("Action failed"); }
    finally { setActing(false); }
  }

  const filtered = filter === "all" ? entries : entries.filter(e => e.status === filter);
  const counts: Record<string, number> = { all: entries.length, waiting: 0, offered: 0, declined: 0, converted: 0 };
  entries.forEach(e => { counts[e.status] = (counts[e.status] ?? 0) + 1; });

  const statusStyle = (s: string): React.CSSProperties => {
    const map: Record<string, [string, string]> = {
      waiting: ["#fef3c7", "#d97706"], offered: ["#dbeafe", "#3b82f6"],
      declined: ["#fee2e2", "#dc2626"], converted: ["#dcfce7", "#16a34a"],
    };
    const [bg, fg] = map[s] ?? ["var(--surface-2)", "var(--text-muted)"];
    return { background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 };
  };

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;

  // ── Detail view ──
  if (selected) {
    const entry = entries.find(e => e.id === selected.id) ?? selected;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 32 }}>
        <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontSize: 13, fontWeight: 600, padding: 0, textAlign: "left" }}>← Back</button>

        <div style={{ borderRadius: 14, border: "1px solid var(--border)", padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: 17 }}>{entry.childFirstName} {entry.childLastName}</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>DOB: {entry.childDateOfBirth || "—"}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span style={statusStyle(entry.status)}>{entry.status.toUpperCase()}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Position #{entry.position}</span>
            </div>
          </div>

          {[["Parent", entry.parentName], ["Email", entry.parentEmail], ["Phone", entry.parentPhone],
            ["Desired start", entry.desiredStartDate || "—"]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          {entry.notes && (
            <div style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8, fontSize: 13 }}>
              <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>APPLICANT NOTES</p>
              {entry.notes}
            </div>
          )}
        </div>

        <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 14, background: "var(--surface)" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>INTERNAL NOTES</label>
          <textarea
            rows={3}
            defaultValue={entry.internalNotes ?? ""}
            onChange={e => setNotes(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface-2)", color: "var(--text)", resize: "none" }}
            placeholder="Notes visible to staff only…"
          />
          <button onClick={() => action(entry.id, "notes", notes)} disabled={acting} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text)" }}>
            Save notes
          </button>
        </div>

        {entry.status === "waiting" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => action(entry.id, "offer", notes || entry.internalNotes)} disabled={acting} style={{ flex: 2, padding: "12px 0", borderRadius: 12, background: "var(--primary)", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {acting ? "…" : "🎉 Offer a Place"}
            </button>
            <button onClick={() => action(entry.id, "decline", notes || entry.internalNotes)} disabled={acting} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid #dc2626", background: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#dc2626" }}>
              Decline
            </button>
          </div>
        )}
        {entry.status === "offered" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => action(entry.id, "convert", notes || entry.internalNotes)} disabled={acting} style={{ flex: 2, padding: "12px 0", borderRadius: 12, background: "#16a34a", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {acting ? "…" : "✓ Convert to Admission"}
            </button>
            <button onClick={() => action(entry.id, "decline")} disabled={acting} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid var(--border)", background: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--text-muted)" }}>
              Withdraw
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Waiting List</h2>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{counts.waiting} waiting</span>
      </div>

      {/* Share link */}
      <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 12, background: "var(--surface)", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>WAITLIST LINK</p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text)", wordBreak: "break-all" }}>{waitlistUrl}</p>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(waitlistUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text)", whiteSpace: "nowrap" }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["waiting", "offered", "converted", "declined", "all"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: filter === s ? "2px solid var(--primary)" : "1px solid var(--border)", background: filter === s ? "var(--primary-light)" : "var(--surface-2)", color: filter === s ? "var(--primary)" : "var(--text-muted)" }}>
            {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
          <p style={{ fontSize: 32 }}>📋</p>
          <p style={{ fontSize: 14 }}>No {filter === "all" ? "" : filter} entries.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered
            .sort((a, b) => a.position - b.position)
            .map(entry => (
              <button key={entry.id} onClick={() => { setSelected(entry); setNotes(entry.internalNotes ?? ""); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "var(--primary)", flexShrink: 0 }}>
                  #{entry.position}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14 }}>{entry.childFirstName} {entry.childLastName}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.parentName} · {entry.parentEmail}</p>
                </div>
                <span style={statusStyle(entry.status)}>{entry.status}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── HR Panel ─────────────────────────────────────────────────────────────────

function HrPanel({ schoolId, firebaseUser }: { schoolId: string; firebaseUser: User | null }) {
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"staff" | "leave">("staff");
  const [selectedStaff, setSelectedStaff] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<HrProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);

  // Profile form state
  const [employeeId, setEmployeeId] = useState("");
  const [contractType, setContractType] = useState<ContractType>("permanent");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelation, setEcRelation] = useState("");
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [newQual, setNewQual] = useState("");
  const [profileNotes, setProfileNotes] = useState("");

  async function getToken() { return firebaseUser?.getIdToken() ?? ""; }

  useEffect(() => {
    if (!schoolId || !firebaseUser) return;
    Promise.all([
      import("@/lib/db").then(({ getStaffForSchool }) => getStaffForSchool(schoolId)),
      import("@/lib/db").then(({ getLeaveRequestsForSchool }) => getLeaveRequestsForSchool(schoolId)),
    ]).then(([s, l]) => { setStaff(s); setLeaveRequests(l); setLoading(false); });
  }, [schoolId, firebaseUser]);

  async function loadProfile(member: AppUser) {
    setSelectedStaff(member);
    setProfileLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/hr/profile?staffUid=${member.uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { data } = await res.json();
      setProfile(data);
      setEmployeeId(data?.employeeId ?? "");
      setContractType(data?.contractType ?? "permanent");
      setStartDate(data?.startDate ?? "");
      setEndDate(data?.endDate ?? "");
      setIdNumber(data?.idNumber ?? "");
      setEcName(data?.emergencyContactName ?? "");
      setEcPhone(data?.emergencyContactPhone ?? "");
      setEcRelation(data?.emergencyContactRelation ?? "");
      setQualifications(data?.qualifications ?? []);
      setProfileNotes(data?.notes ?? "");
    } catch { toast.error("Failed to load profile"); }
    finally { setProfileLoading(false); }
  }

  async function saveProfile() {
    if (!selectedStaff) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/hr/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          staffUid: selectedStaff.uid,
          employeeId, contractType, startDate, endDate,
          idNumber, emergencyContactName: ecName, emergencyContactPhone: ecPhone,
          emergencyContactRelation: ecRelation, qualifications, notes: profileNotes,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Profile saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  async function reviewLeave(requestId: string, status: "approved" | "declined", note?: string) {
    setReviewing(requestId);
    try {
      const token = await getToken();
      const res = await fetch(`/api/hr/leave/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, reviewNote: note ?? "" }),
      });
      if (!res.ok) throw new Error("Failed");
      setLeaveRequests(prev => prev.map(r =>
        r.id === requestId ? { ...r, status } : r
      ));
      toast.success(status === "approved" ? "Leave approved" : "Leave declined");
    } catch { toast.error("Action failed"); }
    finally { setReviewing(null); }
  }

  const CONTRACT_LABELS: Record<ContractType, string> = {
    permanent: "Permanent", contract: "Fixed-term", "part-time": "Part-time", intern: "Intern",
  };
  const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
    annual: "Annual Leave", sick: "Sick Leave", family: "Family Responsibility",
    unpaid: "Unpaid Leave", other: "Other",
  };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)", color: "var(--text)" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 };
  const sectionStyle: React.CSSProperties = { borderRadius: 12, border: "1px solid var(--border)", padding: 14, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 12 };

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;

  // ── Staff profile edit view ──
  if (selectedStaff) {
    if (profileLoading) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading profile…</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 32 }}>
        <button onClick={() => setSelectedStaff(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontSize: 13, fontWeight: 600, padding: 0, textAlign: "left" }}>← Back</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "var(--primary)" }}>
            {(selectedStaff.displayName ?? selectedStaff.email ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 16 }}>{selectedStaff.displayName ?? selectedStaff.email}</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", textTransform: "capitalize" }}>{selectedStaff.role}</p>
          </div>
        </div>

        {/* Employment */}
        <div style={sectionStyle}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Employment</p>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Employee ID</label><input style={inputStyle} value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="EMP-001" /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Contract Type</label>
              <select style={inputStyle} value={contractType} onChange={e => setContractType(e.target.value as ContractType)}>
                {(Object.entries(CONTRACT_LABELS) as [ContractType, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Start Date</label><input style={inputStyle} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            {["contract", "intern"].includes(contractType) && (
              <div style={{ flex: 1 }}><label style={labelStyle}>End Date</label><input style={inputStyle} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            )}
          </div>
          <div><label style={labelStyle}>ID / Passport Number</label><input style={inputStyle} value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="SA ID or passport" /></div>
        </div>

        {/* Emergency contact */}
        <div style={sectionStyle}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Emergency Contact</p>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 2 }}><label style={labelStyle}>Name</label><input style={inputStyle} value={ecName} onChange={e => setEcName(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Relationship</label><input style={inputStyle} value={ecRelation} onChange={e => setEcRelation(e.target.value)} placeholder="Spouse" /></div>
          </div>
          <div><label style={labelStyle}>Phone</label><input style={inputStyle} type="tel" value={ecPhone} onChange={e => setEcPhone(e.target.value)} /></div>
        </div>

        {/* Qualifications */}
        <div style={sectionStyle}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Qualifications</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} value={newQual} onChange={e => setNewQual(e.target.value)} placeholder="e.g. ECD Level 4, First Aid" onKeyDown={e => { if (e.key === "Enter" && newQual.trim()) { setQualifications(q => [...q, newQual.trim()]); setNewQual(""); } }} />
            <button onClick={() => { if (newQual.trim()) { setQualifications(q => [...q, newQual.trim()]); setNewQual(""); } }} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Add</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {qualifications.map((q, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 20, fontSize: 12, padding: "3px 10px" }}>
                {q}
                <button onClick={() => setQualifications(qs => qs.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
            {qualifications.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No qualifications recorded.</p>}
          </div>
        </div>

        {/* Notes */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...inputStyle, resize: "none" }} rows={3} value={profileNotes} onChange={e => setProfileNotes(e.target.value)} placeholder="Any additional notes about this staff member…" />
        </div>

        <button onClick={saveProfile} disabled={saving} style={{ padding: "13px 0", borderRadius: 12, background: "var(--primary)", color: "#fff", border: "none", fontWeight: 700, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save HR Profile"}
        </button>
      </div>
    );
  }

  // ── Main view ──
  const pendingLeave = leaveRequests.filter(r => r.status === "pending");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>HR & Staff</h2>
        {pendingLeave.length > 0 && (
          <span style={{ background: "#fee2e2", color: "#dc2626", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{pendingLeave.length} leave pending</span>
        )}
      </div>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 0, borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
        {(["staff", "leave"] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "9px 0", border: "none", background: view === v ? "var(--primary)" : "var(--surface)", color: view === v ? "#fff" : "var(--text-muted)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {v === "staff" ? `Staff (${staff.length})` : `Leave Requests (${leaveRequests.length})`}
          </button>
        ))}
      </div>

      {/* Staff list */}
      {view === "staff" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {staff.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No staff members found. Invite them from the Settings tab.</p>
          ) : staff.map(member => (
            <button key={member.uid} onClick={() => loadProfile(member)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "var(--primary)", flexShrink: 0 }}>
                {(member.displayName ?? member.email ?? "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14 }}>{member.displayName ?? member.email}</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", textTransform: "capitalize" }}>{member.role}</p>
              </div>
              <span style={{ fontSize: 12, color: "var(--primary)" }}>View →</span>
            </button>
          ))}
        </div>
      )}

      {/* Leave requests */}
      {view === "leave" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {leaveRequests.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No leave requests yet.</p>
          ) : leaveRequests.map(req => {
            const statusColors: Record<string, [string, string]> = {
              pending: ["#fef3c7", "#d97706"], approved: ["#dcfce7", "#16a34a"], declined: ["#fee2e2", "#dc2626"],
            };
            const [bg, fg] = statusColors[req.status] ?? ["var(--surface-2)", "var(--text-muted)"];
            return (
              <div key={req.id} style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 14, background: "var(--surface)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14 }}>{req.staffName}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>{LEAVE_TYPE_LABELS[req.type]} · {req.days} day{req.days !== 1 ? "s" : ""}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(req.startDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – {new Date(req.endDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: bg, color: fg }}>{req.status.toUpperCase()}</span>
                </div>
                {req.reason && <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>"{req.reason}"</p>}
                {req.status === "pending" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => reviewLeave(req.id, "approved")} disabled={reviewing === req.id} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "#16a34a", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      {reviewing === req.id ? "…" : "✓ Approve"}
                    </button>
                    <button onClick={() => reviewLeave(req.id, "declined")} disabled={reviewing === req.id} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #dc2626", background: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#dc2626" }}>
                      Decline
                    </button>
                  </div>
                )}
                {req.reviewNote && <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Note: {req.reviewNote}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Reports Panel ────────────────────────────────────────────────────────────

function ReportsPanel({ schoolId, firebaseUser }: { schoolId: string; firebaseUser: User | null }) {
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  async function getToken() { return firebaseUser?.getIdToken() ?? ""; }

  useEffect(() => {
    if (!schoolId || !firebaseUser) return;
    import("@/lib/db").then(({ getChildrenForSchool }) => getChildrenForSchool(schoolId))
      .then(c => { setChildren(c); setLoading(false); });
  }, [schoolId, firebaseUser]);

  async function downloadReport(url: string, filename: string, key: string) {
    setGenerating(key);
    try {
      const token = await getToken();
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Report downloaded");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate report");
    } finally {
      setGenerating(null);
    }
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 14, border: "1px solid var(--border)", padding: 18,
    background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10,
  };
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: "11px 0", borderRadius: 10, background: disabled ? "var(--surface-2)" : "var(--primary)",
    color: disabled ? "var(--text-muted)" : "#fff", border: "none",
    fontWeight: 700, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.7 : 1,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Reports</h2>

      {/* Month picker */}
      <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 14, background: "var(--surface)", display: "flex", alignItems: "center", gap: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Report Month</label>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14, background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}
        />
      </div>

      {/* Attendance Report */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📅</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Attendance Report</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Monthly attendance rates per learner — days present, absent, and overall rate.
            </p>
          </div>
        </div>
        <button
          style={btnStyle(generating === "attendance")}
          disabled={generating === "attendance"}
          onClick={() => downloadReport(
            `/api/reports/attendance?month=${month}`,
            `attendance-${month}.pdf`,
            "attendance"
          )}
        >
          {generating === "attendance" ? "Generating…" : "⬇ Download Attendance PDF"}
        </button>
      </div>

      {/* Billing Report */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>💰</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Billing Report</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Monthly revenue summary — collected, outstanding, and overdue per child.
            </p>
          </div>
        </div>
        <button
          style={btnStyle(generating === "billing")}
          disabled={generating === "billing"}
          onClick={() => downloadReport(
            `/api/reports/billing?month=${month}`,
            `billing-${month}.pdf`,
            "billing"
          )}
        >
          {generating === "billing" ? "Generating…" : "⬇ Download Billing PDF"}
        </button>
      </div>

      {/* Child Profile Reports */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>👤</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Child Profile Reports</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Full profile including medical info, allergies, medications, and emergency contacts.
            </p>
          </div>
        </div>
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Loading children…</p>
        ) : children.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No children enrolled.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
            {children.map(child => {
              const key = `child-${child.id}`;
              return (
                <div key={child.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{child.firstName} {child.lastName}</span>
                  <button
                    onClick={() => downloadReport(
                      `/api/reports/child/${child.id}`,
                      `profile-${child.firstName}-${child.lastName}.pdf`.toLowerCase().replace(/\s+/g, "-"),
                      key
                    )}
                    disabled={generating === key}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: generating === key ? "var(--surface)" : "var(--primary)", color: generating === key ? "var(--text-muted)" : "#fff", fontWeight: 700, fontSize: 12, cursor: generating === key ? "not-allowed" : "pointer" }}
                  >
                    {generating === key ? "…" : "⬇ PDF"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

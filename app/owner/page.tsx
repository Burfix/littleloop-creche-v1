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
import type { Admission, Child, CockpitStats, Invoice } from "@/lib/types";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { BarChart2, Bell, ClipboardList, CreditCard, Settings, LogOut } from "lucide-react";

type Tab = "overview" | "admissions" | "billing" | "settings";

export default function OwnerDashboard() {
  const { appUser, firebaseUser, signOut } = useAuth();
  const { school } = useSchool();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
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

        {tab === "billing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{currentMonth}</h3>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: "8px 12px" }}>
                Export PDF
              </button>
            </div>

            {monthInvoices.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No invoices this month yet.</p>
            ) : monthInvoices.map(inv => (
              <div key={inv.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14 }}>
                      {inv.childId}
                    </p>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                      R{(inv.amountCents / 100).toLocaleString()}
                    </p>
                  </div>
                  <span className={`pill ${
                    inv.status === "paid" ? "pill-green" :
                    inv.status === "overdue" ? "pill-red" : "pill-amber"
                  }`}>
                    {inv.status}
                  </span>
                </div>

                {inv.proofUrl && inv.status !== "paid" && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-muted)" }}>
                      Proof uploaded — verify payment
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: 13, padding: "8px" }}
                        onClick={async () => {
                          await updateInvoiceStatus(inv.id, "paid");
                          setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: "paid" } : i));
                          toast.success("Marked as paid");
                        }}
                      >
                        Confirm paid
                      </button>
                      <a href={inv.proofUrl} target="_blank" rel="noopener noreferrer"
                        className="btn btn-secondary" style={{ flex: 1, fontSize: 13, padding: "8px" }}>
                        View proof
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {hasMoreInvoices && (
              <button
                className="btn btn-secondary"
                style={{ width: "100%", fontSize: 13 }}
                onClick={loadMoreInvoices}
                disabled={loadingInvoices}
              >
                {loadingInvoices ? <span className="spinner" /> : "Load more invoices"}
              </button>
            )}
          </div>
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

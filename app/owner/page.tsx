"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import {
  getCockpitStats, getInvoicesForSchool,
  updateInvoiceStatus,
} from "@/lib/db";
import type { CockpitStats, Invoice } from "@/lib/types";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { BarChart2, CreditCard, Settings, LogOut, Bell } from "lucide-react";

type Tab = "overview" | "billing" | "settings";

export default function OwnerDashboard() {
  const { appUser, signOut } = useAuth();
  const { school } = useSchool();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<CockpitStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "owner") { router.replace("/"); return; }
    if (!school) return;

    Promise.all([
      getCockpitStats(school.id),
      getInvoicesForSchool(school.id),
    ]).then(([s, inv]) => {
      setStats(s);
      setInvoices(inv);
      setLoading(false);
    });
  }, [appUser, school, router]);

  const sendReminders = async () => {
    const outstanding = invoices.filter(i => i.status === "outstanding" || i.status === "overdue");
    toast.success(`Reminders queued for ${outstanding.length} families`);
    // In production: call a Cloud Function or API route to send WhatsApp/email
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
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

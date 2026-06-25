"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getAllSchools } from "@/lib/db";
import type { School } from "@/lib/types";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Plus, LogOut, Globe, Users, Copy, Check, Mail } from "lucide-react";

type Tab = "schools" | "invite";

export default function AdminDashboard() {
  const { appUser, signOut } = useAuth();
  const router = useRouter();

  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("schools");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [setupLink, setSetupLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [schoolForm, setSchoolForm] = useState({
    name: "", slug: "", ownerName: "", ownerEmail: "", phone: "", address: "",
  });

  const [inviteForm, setInviteForm] = useState({
    email: "", displayName: "", role: "teacher", schoolId: "", schoolSlug: "",
  });
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "superadmin") { router.replace("/"); return; }
    getAllSchools().then(s => { setSchools(s); setLoading(false); });
  }, [appUser, router]);

  const handleCreateSchool = async () => {
    if (!schoolForm.name || !schoolForm.slug || !schoolForm.ownerEmail || !schoolForm.ownerName) {
      toast.error("Name, slug, owner name and owner email are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...schoolForm,
          slug: schoolForm.slug.toLowerCase().replace(/\s+/g, "-"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSetupLink(data.setupLink);
      toast.success(`${schoolForm.name} created!`);
      getAllSchools().then(setSchools);
      setSchoolForm({ name: "", slug: "", ownerName: "", ownerEmail: "", phone: "", address: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create school");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.displayName || (inviteForm.role !== "superadmin" && !inviteForm.schoolId)) {
      toast.error(inviteForm.role === "superadmin" ? "Email and name required" : "Email, name and school are required");
      return;
    }
    setSaving(true);
    try {
      const selectedSchool = schools.find(s => s.id === inviteForm.schoolId);
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inviteForm,
          schoolSlug: selectedSchool?.slug ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setInviteLink(data.setupLink);
      toast.success(data.message);
      setInviteForm({ email: "", displayName: "", role: "teacher", schoolId: "", schoolSlug: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !appUser) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <div style={{
        padding: "16px 20px 0",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>SuperAdmin</p>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>LittleLoop Network</h2>
          </div>
          <button onClick={() => { signOut(); router.replace("/login"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <LogOut size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {(["schools", "invite"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "10px 0", border: "none", background: "none",
              borderBottom: tab === t ? "2px solid var(--brand)" : "2px solid transparent",
              color: tab === t ? "var(--brand)" : "var(--text-muted)",
              fontWeight: tab === t ? 600 : 400, fontSize: 14, cursor: "pointer",
              textTransform: "capitalize",
            }}>
              {t === "schools" ? "Schools" : "Invite User"}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ padding: "16px 20px" }}>

        {/* ── SCHOOLS TAB ── */}
        {tab === "schools" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="card">
                <div className="stat-label">Schools</div>
                <div className="stat-value" style={{ color: "var(--brand)", marginTop: 4 }}>{schools.length}</div>
              </div>
              <div className="card">
                <div className="stat-label">Total branches</div>
                <div className="stat-value" style={{ marginTop: 4 }}>
                  {schools.reduce((sum, s) => sum + (s.branches?.length ?? 0), 0)}
                </div>
              </div>
            </div>

            {/* Add school button */}
            <button className="btn btn-primary" style={{ width: "100%" }}
              onClick={() => { setShowAdd(true); setSetupLink(null); }}>
              <Plus size={16} /> Add school
            </button>

            {/* Setup link result */}
            {setupLink && (
              <div className="card" style={{ borderLeft: "3px solid var(--success)", background: "#f0fdf4" }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14, color: "#166534" }}>
                  ✓ School created — share this link with the owner
                </p>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#166534", wordBreak: "break-all" }}>
                  {setupLink}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13, padding: "8px" }}
                    onClick={() => copyLink(setupLink)}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                  <a href={`mailto:?subject=Your LittleLoop access&body=Here is your setup link: ${setupLink}`}
                    className="btn btn-secondary" style={{ flex: 1, fontSize: 13, padding: "8px", textDecoration: "none", textAlign: "center" }}>
                    <Mail size={14} /> Email link
                  </a>
                </div>
              </div>
            )}

            {/* Schools list */}
            <h3 style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700 }}>All schools</h3>
            {schools.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏫</div>
                <p style={{ fontSize: 14 }}>No schools yet. Add the first one.</p>
              </div>
            ) : schools.map(school => (
              <div key={school.id} className="card" style={{ cursor: "pointer" }}
                onClick={() => { setInviteForm(p => ({ ...p, schoolId: school.id, schoolSlug: school.slug })); setTab("invite"); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15 }}>{school.name}</p>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                      <Globe size={11} style={{ color: "var(--text-muted)" }} />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{school.slug}.littleloop.app</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Users size={11} style={{ color: "var(--text-muted)" }} />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {school.branches?.length ?? 0} branches
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <span className={`pill ${school.plan === "enterprise" ? "pill-blue" : school.plan === "growth" ? "pill-green" : "pill-gray"}`}
                      style={{ textTransform: "capitalize" }}>
                      {school.plan}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {format(new Date(school.createdAt), "d MMM yyyy")}
                    </span>
                  </div>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--brand)" }}>
                  Tap to invite users →
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── INVITE TAB ── */}
        {tab === "invite" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Invite a user</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              They'll receive a setup link to create their password and access their dashboard immediately.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {inviteForm.role !== "superadmin" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  School
                </label>
                <select
                  className="input"
                  value={inviteForm.schoolId}
                  onChange={e => {
                    const s = schools.find(sc => sc.id === e.target.value);
                    setInviteForm(p => ({ ...p, schoolId: e.target.value, schoolSlug: s?.slug ?? "" }));
                  }}
                >
                  <option value="">Select a school...</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Role
                </label>
                <select
                  className="input"
                  value={inviteForm.role}
                  onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                >
                  <option value="superadmin">Super Admin</option>
                  <option value="owner">Owner</option>
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Full name
                </label>
                <input className="input" placeholder="e.g. Sarah Johnson"
                  value={inviteForm.displayName}
                  onChange={e => setInviteForm(p => ({ ...p, displayName: e.target.value }))} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Email address
                </label>
                <input className="input" type="email" placeholder="e.g. sarah@school.co.za"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} />
              </div>

              <button className="btn btn-primary" style={{ width: "100%", marginTop: 4 }}
                onClick={handleInvite} disabled={saving}>
                {saving ? <span className="spinner" /> : <>
                  <Mail size={16} /> Generate invite link
                </>}
              </button>
            </div>

            {/* Invite link result */}
            {inviteLink && (
              <div className="card" style={{ borderLeft: "3px solid var(--success)", background: "#f0fdf4" }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14, color: "#166534" }}>
                  ✓ Invite ready — share this link
                </p>
                <p style={{ margin: "0 0 10px", fontSize: 11, color: "#166534", wordBreak: "break-all" }}>
                  {inviteLink}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13, padding: "8px" }}
                    onClick={() => copyLink(inviteLink)}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                  <a href={`mailto:${inviteForm.email}?subject=You've been invited to LittleLoop&body=Hi ${inviteForm.displayName},%0A%0AYou've been added to LittleLoop. Click the link below to set your password and get started:%0A%0A${inviteLink}%0A%0AWelcome!`}
                    className="btn btn-primary" style={{ flex: 1, fontSize: 13, padding: "8px", textDecoration: "none", textAlign: "center" }}>
                    <Mail size={14} /> Email them
                  </a>
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                  Link expires in 1 hour. Generate a new one if needed.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add school modal */}
      {showAdd && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "flex-end", zIndex: 100,
        }} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={{
            background: "white", borderRadius: "20px 20px 0 0",
            padding: "24px 24px 40px", width: "100%", maxWidth: 430, margin: "0 auto",
            maxHeight: "90dvh", overflowY: "auto",
          }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>Add new school</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)" }}>
              The owner will get a setup link to access their dashboard.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>School name *</label>
                <input className="input" placeholder="e.g. Pebblestones Preschool"
                  value={schoolForm.name}
                  onChange={e => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                    setSchoolForm(p => ({ ...p, name, slug }));
                  }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>URL slug *</label>
                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 10px", background: "var(--surface-2)", border: "1.5px solid var(--border)", borderRight: "none", borderRadius: "10px 0 0 10px", whiteSpace: "nowrap" }}>
                    littleloop.app/
                  </span>
                  <input className="input" style={{ borderRadius: "0 10px 10px 0" }}
                    placeholder="pebblestones"
                    value={schoolForm.slug}
                    onChange={e => setSchoolForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
                </div>
              </div>

              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>OWNER DETAILS</p>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Owner full name *</label>
                <input className="input" placeholder="e.g. Jane Smith"
                  value={schoolForm.ownerName}
                  onChange={e => setSchoolForm(p => ({ ...p, ownerName: e.target.value }))} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Owner email *</label>
                <input className="input" type="email" placeholder="owner@school.co.za"
                  value={schoolForm.ownerEmail}
                  onChange={e => setSchoolForm(p => ({ ...p, ownerEmail: e.target.value }))} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Phone</label>
                <input className="input" placeholder="+27 xx xxx xxxx"
                  value={schoolForm.phone}
                  onChange={e => setSchoolForm(p => ({ ...p, phone: e.target.value }))} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Address</label>
                <input className="input" placeholder="Street, City"
                  value={schoolForm.address}
                  onChange={e => setSchoolForm(p => ({ ...p, address: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={async () => {
                await handleCreateSchool();
                setShowAdd(false);
              }} disabled={saving}>
                {saving ? <span className="spinner" /> : "Create + get link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

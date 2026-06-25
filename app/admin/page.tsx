"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getAllSchools, createSchool } from "@/lib/db";
import type { School } from "@/lib/types";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Plus, LogOut, Globe, Users } from "lucide-react";

export default function AdminDashboard() {
  const { appUser, signOut } = useAuth();
  const router = useRouter();

  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", email: "", phone: "", address: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "superadmin") { router.replace("/"); return; }
    getAllSchools().then(s => { setSchools(s); setLoading(false); });
  }, [appUser, router]);

  const handleCreate = async () => {
    if (!form.name || !form.slug) { toast.error("Name and slug required"); return; }
    setSaving(true);
    try {
      const id = await createSchool({
        name: form.name,
        slug: form.slug.toLowerCase().replace(/\s+/g, "-"),
        email: form.email,
        phone: form.phone,
        address: form.address,
        branches: [],
        plan: "starter",
      });
      setSchools(prev => [...prev, {
        id, ...form, branches: [], plan: "starter", createdAt: new Date().toISOString(),
      }]);
      setForm({ name: "", slug: "", email: "", phone: "", address: "" });
      setShowAdd(false);
      toast.success(`${form.name} created!`);
    } catch {
      toast.error("Failed to create school");
    } finally {
      setSaving(false);
    }
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
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>SuperAdmin</p>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>LittleLoop Network</h2>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-primary"
            style={{ padding: "8px 14px", fontSize: 13 }}
            onClick={() => setShowAdd(true)}
          >
            <Plus size={15} /> Add school
          </button>
          <button onClick={() => { signOut(); router.replace("/login"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="page-content" style={{ padding: "16px 20px" }}>

        {/* Network stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div className="card">
            <div className="stat-label">Schools</div>
            <div className="stat-value" style={{ color: "var(--brand)", marginTop: 4 }}>{schools.length}</div>
          </div>
          <div className="card">
            <div className="stat-label">Total branches</div>
            <div className="stat-value" style={{ marginTop: 4 }}>
              {schools.reduce((sum, s) => sum + s.branches.length, 0)}
            </div>
          </div>
        </div>

        {/* Add school modal */}
        {showAdd && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "flex-end", zIndex: 100,
          }}>
            <div style={{
              background: "white", borderRadius: "20px 20px 0 0",
              padding: 24, width: "100%", maxWidth: 430, margin: "0 auto",
            }}>
              <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700 }}>New school</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input className="input" placeholder="School name*" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                <input className="input" placeholder="URL slug* (e.g. pebblestones)" value={form.slug}
                  onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} />
                <input className="input" placeholder="Owner email" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                <input className="input" placeholder="Phone" value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                <input className="input" placeholder="Address" value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate} disabled={saving}>
                  {saving ? <span className="spinner" /> : "Create school"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schools list */}
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>All schools</h3>
        {schools.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏫</div>
            <p style={{ fontSize: 14 }}>No schools yet. Add the first one.</p>
          </div>
        ) : schools.map(school => (
          <div key={school.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15 }}>{school.name}</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <Globe size={12} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {school.slug}.littleloop.app
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Users size={12} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {school.branches.length} {school.branches.length === 1 ? "branch" : "branches"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <span className={`pill ${
                  school.plan === "enterprise" ? "pill-blue" :
                  school.plan === "growth" ? "pill-green" : "pill-gray"
                }`} style={{ textTransform: "capitalize" }}>
                  {school.plan}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {format(new Date(school.createdAt), "d MMM yyyy")}
                </span>
              </div>
            </div>

            {school.email && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                {school.email}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

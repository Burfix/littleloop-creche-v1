"use client";

import React from "react";
import toast from "react-hot-toast";
import type { User } from "firebase/auth";

interface SchoolForm {
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  address: string;
}

interface AddSchoolModalProps {
  firebaseUser: User;
  /** Called after the school is successfully created so the parent can refetch the list */
  onCreated: () => void;
  onClose: () => void;
}

export function AddSchoolModal({ firebaseUser, onCreated, onClose }: AddSchoolModalProps) {
  const [form, setForm] = React.useState<SchoolForm>({
    name: "", slug: "", ownerName: "", ownerEmail: "", phone: "", address: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const handleCreate = async () => {
    if (!form.name || !form.slug || !form.ownerEmail || !form.ownerName) {
      toast.error("Name, slug, owner name and owner email are required");
      return;
    }
    setSaving(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, slug: form.slug.toLowerCase().replace(/\s+/g, "-") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSent(true);
      toast.success(`${form.name} created! Setup email sent to ${form.ownerEmail}`);
      onCreated();
      setForm({ name: "", slug: "", ownerName: "", ownerEmail: "", phone: "", address: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create school");
    } finally {
      setSaving(false);
    }
  };

  if (sent) {
    return (
      <ModalShell onClose={onClose}>
        <div className="card" style={{ borderLeft: "3px solid var(--success)", background: "#f0fdf4" }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#166534" }}>
            ✓ School created. Setup email sent to owner.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#166534" }}>
            They&apos;ll receive an email to set their password and access their dashboard.
          </p>
        </div>
        <button className="btn btn-secondary" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>
          Close
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>Add new school</h3>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)" }}>
        The owner will get a setup link to access their dashboard.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>School name *</label>
          <input className="input" placeholder="e.g. Pebblestones Preschool"
            value={form.name}
            onChange={e => {
              const name = e.target.value;
              const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
              setForm(p => ({ ...p, name, slug }));
            }} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>URL slug *</label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 10px", background: "var(--surface-2)", border: "1.5px solid var(--border)", borderRight: "none", borderRadius: "10px 0 0 10px", whiteSpace: "nowrap" }}>
              littleloop.app/
            </span>
            <input className="input" style={{ borderRadius: "0 10px 10px 0" }}
              placeholder="pebblestones"
              value={form.slug}
              onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
          </div>
        </div>

        <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>OWNER DETAILS</p>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Owner full name *</label>
          <input className="input" placeholder="e.g. Jane Smith"
            value={form.ownerName}
            onChange={e => setForm(p => ({ ...p, ownerName: e.target.value }))} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Owner email *</label>
          <input className="input" type="email" placeholder="owner@school.co.za"
            value={form.ownerEmail}
            onChange={e => setForm(p => ({ ...p, ownerEmail: e.target.value }))} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Phone</label>
          <input className="input" placeholder="+27 xx xxx xxxx"
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Address</label>
          <input className="input" placeholder="Street, City"
            value={form.address}
            onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate} disabled={saving}>
          {saving ? <span className="spinner" /> : "Create + get link"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "white", borderRadius: "20px 20px 0 0",
        padding: "24px 24px 40px", width: "100%", maxWidth: 430, margin: "0 auto",
        maxHeight: "90dvh", overflowY: "auto",
      }}>
        {children}
      </div>
    </div>
  );
}

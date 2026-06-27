"use client";

import React from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import type { Child } from "@/lib/types";

interface InviteFormProps {
  schoolId: string;
  schoolSlug: string;
  childRecords: Child[];
}

export function InviteForm({ schoolId, schoolSlug, childRecords }: InviteFormProps) {
  const { firebaseUser } = useAuth();
  const [form, setForm] = React.useState({ email: "", displayName: "", role: "teacher", phone: "", childIds: [] as string[] });
  const [saving, setSaving] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const activeChildren = childRecords.filter(child => child.deletionStatus !== "pending_erasure");

  const handleInvite = async () => {
    if (!form.email || !form.displayName) { toast.error("Name and email required"); return; }
    if (form.role === "parent" && form.childIds.length === 0) {
      toast.error("Choose at least one child for this parent");
      return;
    }
    setSaving(true);
    try {
      const token = await firebaseUser?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, schoolId, schoolSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
      toast.success("Invite email sent!");
      setForm({ email: "", displayName: "", role: "teacher", phone: "", childIds: [] });
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
      </select>
      <input
        className="input"
        placeholder="Full name"
        value={form.displayName}
        onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
      />
      <input
        className="input"
        type="email"
        placeholder="Email address"
        value={form.email}
        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
      />
      <input
        className="input"
        type="tel"
        placeholder="Phone (WhatsApp) +27 xx xxx xxxx"
        value={form.phone}
        onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
      />
      {form.role === "parent" && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Assign children
          </label>
          {activeChildren.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No active children available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeChildren.map(child => {
                const checked = form.childIds.includes(child.id);
                return (
                  <label key={child.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", border: "1px solid var(--border)",
                    borderRadius: 10, fontSize: 14, cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => setForm(p => ({
                        ...p,
                        childIds: e.target.checked
                          ? [...p.childIds, child.id]
                          : p.childIds.filter(id => id !== child.id),
                      }))}
                    />
                    <span>{child.firstName} {child.lastName}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
      <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleInvite} disabled={saving}>
        {saving ? <span className="spinner" /> : "Generate invite link"}
      </button>
      {sent && (
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

"use client";

import React from "react";
import toast from "react-hot-toast";

interface InviteFormProps {
  schoolId: string;
  schoolSlug: string;
}

export function InviteForm({ schoolId, schoolSlug }: InviteFormProps) {
  const [form, setForm] = React.useState({ email: "", displayName: "", role: "teacher", phone: "" });
  const [saving, setSaving] = React.useState(false);
  const [sent, setSent] = React.useState(false);

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
      setSent(true);
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

"use client";

import React from "react";
import { Mail } from "lucide-react";
import toast from "react-hot-toast";
import type { School } from "@/lib/types";
import type { User } from "firebase/auth";

interface InviteForm {
  email: string;
  displayName: string;
  role: string;
  schoolId: string;
  schoolSlug: string;
  phone: string;
}

interface InviteTabProps {
  schools: School[];
  firebaseUser: User;
  initialSchoolId?: string;
  initialSchoolSlug?: string;
}

export function InviteTab({ schools, firebaseUser, initialSchoolId = "", initialSchoolSlug = "" }: InviteTabProps) {
  const [form, setForm] = React.useState<InviteForm>({
    email: "", displayName: "", role: "teacher",
    schoolId: initialSchoolId, schoolSlug: initialSchoolSlug, phone: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const handleInvite = async () => {
    const needsSchool = form.role !== "superadmin" && !form.schoolId;
    if (!form.email || !form.displayName || needsSchool) {
      toast.error(form.role === "superadmin" ? "Email and name required" : "Email, name and school are required");
      return;
    }
    setSaving(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSent(true);
      toast.success(data.message);
      setForm({ email: "", displayName: "", role: "teacher", schoolId: "", schoolSlug: "", phone: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Invite a user</h3>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
        They&apos;ll receive a setup link to create their password and access their dashboard immediately.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {form.role !== "superadmin" && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>School</label>
            <select className="input" value={form.schoolId} onChange={e => {
              const s = schools.find(sc => sc.id === e.target.value);
              setForm(p => ({ ...p, schoolId: e.target.value, schoolSlug: s?.slug ?? "" }));
            }}>
              <option value="">Select a school...</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Role</label>
          <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
            <option value="superadmin">Super Admin</option>
            <option value="owner">Owner</option>
            <option value="teacher">Teacher</option>
            <option value="parent">Parent</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Full name</label>
          <input className="input" placeholder="e.g. Sarah Johnson"
            value={form.displayName}
            onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Email address</label>
          <input className="input" type="email" placeholder="e.g. sarah@school.co.za"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Phone (WhatsApp)</label>
          <input className="input" type="tel" placeholder="+27 xx xxx xxxx"
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </div>

        <button className="btn btn-primary" style={{ width: "100%", marginTop: 4 }}
          onClick={handleInvite} disabled={saving}>
          {saving ? <span className="spinner" /> : <><Mail size={16} /> Generate invite link</>}
        </button>
      </div>

      {sent && (
        <div className="card" style={{ borderLeft: "3px solid var(--success)", background: "#f0fdf4" }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#166534" }}>✓ Invite email sent</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#166534" }}>
            They&apos;ll receive an email to set their password and access their dashboard immediately.
          </p>
        </div>
      )}
    </div>
  );
}

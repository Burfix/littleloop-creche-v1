"use client";

import React from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import type { Child } from "@/lib/types";

interface AddChildFormProps {
  schoolId: string;
  onChildAdded: (child: Child) => void;
}

export function AddChildForm({ schoolId, onChildAdded }: AddChildFormProps) {
  const { firebaseUser } = useAuth();
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    allergies: "",
    notes: "",
    photoConsent: true,
  });
  const [saving, setSaving] = React.useState(false);

  const addChild = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) {
      toast.error("First name, last name and date of birth are required");
      return;
    }

    setSaving(true);
    try {
      const token = await firebaseUser?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const res = await fetch("/api/owner/children", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, schoolId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onChildAdded(data.child);
      setForm({
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        allergies: "",
        notes: "",
        photoConsent: true,
      });
      toast.success(`${data.child.firstName} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add child");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input
          className="input"
          placeholder="First name"
          value={form.firstName}
          onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Last name"
          value={form.lastName}
          onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
        />
      </div>
      <input
        className="input"
        type="date"
        value={form.dateOfBirth}
        onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))}
      />
      <input
        className="input"
        placeholder="Allergies"
        value={form.allergies}
        onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))}
      />
      <textarea
        className="input"
        placeholder="Notes"
        value={form.notes}
        onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
        rows={3}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={form.photoConsent}
          onChange={e => setForm(p => ({ ...p, photoConsent: e.target.checked }))}
        />
        Photo consent granted
      </label>
      <button className="btn btn-primary" style={{ width: "100%" }} onClick={addChild} disabled={saving}>
        {saving ? <span className="spinner" /> : "Add child"}
      </button>
    </div>
  );
}

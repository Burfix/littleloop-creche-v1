"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { User } from "firebase/auth";
import type { ImplementationSpecialist } from "@/lib/types";
import { updateSpecialist, type AdminActor } from "@/lib/school-launch-admin";

interface SpecialistEditorFormProps {
  schoolId: string;
  specialist?: ImplementationSpecialist;
  actor: AdminActor;
  firebaseUser: User | null;
  onSaved: () => void;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export function SpecialistEditorForm({ schoolId, specialist, actor, firebaseUser, onSaved }: SpecialistEditorFormProps) {
  const [name, setName] = useState(specialist?.name ?? "");
  const [role, setRole] = useState(specialist?.role ?? "Implementation Specialist");
  const [email, setEmail] = useState(specialist?.email ?? "");
  const [phone, setPhone] = useState(specialist?.phone ?? "");
  const [supportHours, setSupportHours] = useState(specialist?.supportHours ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Specialist name is required"); return; }
    setSaving(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await updateSpecialist(schoolId, {
        id: specialist?.id ?? crypto.randomUUID(),
        name: name.trim(),
        role: role.trim() || "Implementation Specialist",
        initials: initials(name),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        supportHours: supportHours.trim() || undefined,
      }, actor, idToken);
      toast.success("Specialist updated");
      onSaved();
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async () => {
    setSaving(true);
    try {
      await updateSpecialist(schoolId, undefined, actor);
      toast.success("Specialist unassigned");
      onSaved();
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Implementation specialist</h4>
      <input className="input" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
      <input className="input" placeholder="Role (e.g. Implementation Specialist)" value={role} onChange={e => setRole(e.target.value)} />
      <input className="input" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="input" placeholder="Phone (for WhatsApp)" value={phone} onChange={e => setPhone(e.target.value)} />
      <input className="input" placeholder="Support hours (e.g. Mon-Fri, 8am-5pm)" value={supportHours} onChange={e => setSupportHours(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner" /> : "Save"}
        </button>
        {specialist && (
          <button className="btn btn-secondary" onClick={handleUnassign} disabled={saving}>
            Unassign
          </button>
        )}
      </div>
    </div>
  );
}

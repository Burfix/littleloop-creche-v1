"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import type { User } from "firebase/auth";
import type { LaunchSession, LaunchSessionStatus, LaunchSessionType } from "@/lib/types";
import { upsertLaunchSession, removeLaunchSession, type AdminActor } from "@/lib/school-launch-admin";

interface SessionsManagerProps {
  schoolId: string;
  sessions: LaunchSession[];
  actor: AdminActor;
  firebaseUser: User | null;
  onSaved: () => void;
}

const SESSION_TYPES: { value: LaunchSessionType; label: string }[] = [
  { value: "school_setup_call", label: "School setup call" },
  { value: "data_review", label: "Data review" },
  { value: "teacher_training", label: "Teacher training" },
  { value: "billing_review", label: "Billing review" },
  { value: "go_live_check", label: "Go-live check" },
];

const SESSION_STATUSES: LaunchSessionStatus[] = ["not_scheduled", "scheduled", "completed", "cancelled", "rescheduled"];

function blankForm(): Omit<LaunchSession, "id"> {
  return {
    type: "school_setup_call",
    title: "School setup call",
    status: "not_scheduled",
    scheduledAt: "",
    durationMinutes: 30,
    meetingLink: "",
    participants: [],
    notes: "",
  };
}

export function SessionsManager({ schoolId, sessions, actor, firebaseUser, onSaved }: SessionsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [participantsText, setParticipantsText] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (session: LaunchSession) => {
    setEditingId(session.id);
    setShowNewForm(false);
    setForm({
      type: session.type,
      title: session.title,
      status: session.status,
      scheduledAt: session.scheduledAt ? session.scheduledAt.slice(0, 16) : "",
      durationMinutes: session.durationMinutes ?? 30,
      meetingLink: session.meetingLink ?? "",
      participants: session.participants ?? [],
      notes: session.notes ?? "",
    });
    setParticipantsText((session.participants ?? []).join(", "));
  };

  const startNew = () => {
    setEditingId(null);
    setShowNewForm(true);
    setForm(blankForm());
    setParticipantsText("");
  };

  const cancelForm = () => {
    setEditingId(null);
    setShowNewForm(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Session title is required"); return; }
    setSaving(true);
    try {
      const idToken = await firebaseUser?.getIdToken();
      await upsertLaunchSession(schoolId, {
        id: editingId ?? undefined,
        type: form.type,
        title: form.title.trim(),
        status: form.status,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        durationMinutes: form.durationMinutes || undefined,
        meetingLink: (form.meetingLink ?? "").trim() || undefined,
        participants: participantsText.split(",").map(p => p.trim()).filter(Boolean),
        notes: (form.notes ?? "").trim() || undefined,
      }, actor, idToken);
      toast.success(editingId ? "Session updated" : "Session scheduled");
      cancelForm();
      onSaved();
    } catch {
      toast.error("Couldn't save — please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (sessionId: string) => {
    setSaving(true);
    try {
      await removeLaunchSession(schoolId, sessionId, actor);
      toast.success("Session removed");
      onSaved();
    } catch {
      toast.error("Couldn't remove — please try again");
    } finally {
      setSaving(false);
    }
  };

  const formOpen = showNewForm || editingId !== null;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Launch sessions</h4>
        {!formOpen && (
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 10px" }} onClick={startNew}>
            <Plus size={14} /> Add session
          </button>
        )}
      </div>

      {sessions.length === 0 && !formOpen && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No sessions scheduled yet.</p>
      )}

      {sessions.map(session => (
        <div key={session.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{session.title}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
              {session.status}{session.scheduledAt ? ` · ${new Date(session.scheduledAt).toLocaleString("en-ZA")}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => startEdit(session)} disabled={saving}>
              Edit
            </button>
            <button
              className="btn btn-danger"
              style={{ fontSize: 12, padding: "6px 10px" }}
              onClick={() => handleRemove(session.id)}
              disabled={saving}
              aria-label={`Remove ${session.title}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      {formOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
          <select className="input" value={form.type} onChange={e => {
            const type = e.target.value as LaunchSessionType;
            const label = SESSION_TYPES.find(t => t.value === type)?.label ?? form.title;
            setForm(f => ({ ...f, type, title: label }));
          }}>
            {SESSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input className="input" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LaunchSessionStatus }))}>
            {SESSION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="input" type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
          <input className="input" type="number" min="0" placeholder="Duration (minutes)" value={form.durationMinutes ?? ""} onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) || undefined }))} />
          <input className="input" placeholder="Meeting link" value={form.meetingLink ?? ""} onChange={e => setForm(f => ({ ...f, meetingLink: e.target.value }))} />
          <input className="input" placeholder="Participants (comma-separated)" value={participantsText} onChange={e => setParticipantsText(e.target.value)} />
          <textarea className="input" placeholder="Notes" value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" /> : editingId ? "Save changes" : "Schedule session"}
            </button>
            <button className="btn btn-secondary" onClick={cancelForm} disabled={saving}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

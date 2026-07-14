"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Rocket } from "lucide-react";
import type { LaunchTaskStatus, SchoolLaunchStage, SchoolLaunchRecord } from "@/lib/types";
import { setTaskOverride, markSchoolGoLive, type AdminActor } from "@/lib/school-launch-admin";
import { StatusBadge } from "../../../owner/components/launch/StatusBadge";

interface TaskOverridesPanelProps {
  schoolId: string;
  stages: SchoolLaunchStage[];
  record: SchoolLaunchRecord;
  actor: AdminActor;
  onSaved: () => void;
}

const OVERRIDABLE_STATUSES: LaunchTaskStatus[] = ["not_started", "scheduled", "completed", "blocked"];

function findTask(stages: SchoolLaunchStage[], key: string) {
  return stages.flatMap(s => s.tasks).find(t => t.key === key);
}

function OverrideRow({ schoolId, taskKey, currentStatus, currentNotes, actor, onSaved }: {
  schoolId: string; taskKey: string; currentStatus: LaunchTaskStatus; currentNotes?: string; actor: AdminActor; onSaved: () => void;
}) {
  const [status, setStatus] = useState<LaunchTaskStatus>(currentStatus);
  const [blockingReason, setBlockingReason] = useState("");
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setTaskOverride(schoolId, taskKey, {
        status,
        completedAt: status === "completed" ? new Date().toISOString() : undefined,
        completedBy: status === "completed" ? actor.uid : undefined,
        blockingReason: status === "blocked" ? (blockingReason.trim() || undefined) : undefined,
        notes: notes.trim() || undefined,
      }, actor);
      toast.success("Saved");
      onSaved();
    } catch {
      toast.error("Couldn't save — please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await setTaskOverride(schoolId, taskKey, null, actor);
      toast.success("Override cleared — back to automatic status");
      onSaved();
    } catch {
      toast.error("Couldn't save — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Current status</span>
        <StatusBadge status={currentStatus} />
      </div>
      <select className="input" value={status} onChange={e => setStatus(e.target.value as LaunchTaskStatus)}>
        {OVERRIDABLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {status === "blocked" && (
        <input className="input" placeholder="Why is this blocked? (shown to the school)" value={blockingReason} onChange={e => setBlockingReason(e.target.value)} />
      )}
      <input className="input" placeholder="Internal notes (staff only)" value={notes} onChange={e => setNotes(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner" /> : "Save"}
        </button>
        <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={handleClear} disabled={saving}>
          Clear override
        </button>
      </div>
    </div>
  );
}

// The three tasks with no derivable signal at all — everything else in
// STAGE_TEMPLATES (lib/school-launch.ts) computes itself from real data
// (child/teacher/parent/invoice counts, upload status). These three exist
// purely because LittleLoop staff, not the school, are the ones who know
// whether training happened, whether the school is truly ready, and
// whether it's actually live.
export function TaskOverridesPanel({ schoolId, stages, record, actor, onSaved }: TaskOverridesPanelProps) {
  const training = findTask(stages, "completeTeacherTraining");
  const readiness = findTask(stages, "finalReadinessConfirmation");
  const [goingLive, setGoingLive] = useState(false);

  const handleGoLive = async () => {
    if (!confirm("Mark this school as live? This flips the school over to its normal operational dashboard.")) return;
    setGoingLive(true);
    try {
      await markSchoolGoLive(schoolId, actor);
      toast.success("School marked as live 🎉");
      onSaved();
    } catch {
      toast.error("Couldn't save — please try again");
    } finally {
      setGoingLive(false);
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700 }}>Manual milestones</h4>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-muted)" }}>
        These three steps have no automatic signal — only staff can mark them.
      </p>

      {training && (
        <>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>{training.title}</p>
          <OverrideRow schoolId={schoolId} taskKey="completeTeacherTraining" currentStatus={training.status} currentNotes={training.notes} actor={actor} onSaved={onSaved} />
        </>
      )}

      {readiness && (
        <>
          <p style={{ margin: "10px 0 4px", fontSize: 13, fontWeight: 600 }}>{readiness.title}</p>
          <OverrideRow schoolId={schoolId} taskKey="finalReadinessConfirmation" currentStatus={readiness.status} currentNotes={readiness.notes} actor={actor} onSaved={onSaved} />
        </>
      )}

      <div style={{ marginTop: 10 }}>
        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600 }}>Go live</p>
        {record.launchedAt ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--success)" }}>
            Live since {new Date(record.launchedAt).toLocaleDateString("en-ZA")}
          </p>
        ) : (
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleGoLive} disabled={goingLive}>
            {goingLive ? <span className="spinner" /> : <><Rocket size={16} /> Mark school as live</>}
          </button>
        )}
      </div>
    </div>
  );
}

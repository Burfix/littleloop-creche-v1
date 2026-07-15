"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { updateTargetGoLiveDate, type AdminActor } from "@/lib/school-launch-admin";

interface TargetDateFormProps {
  schoolId: string;
  targetGoLiveDate?: string;
  actor: AdminActor;
  onSaved: () => void;
}

export function TargetDateForm({ schoolId, targetGoLiveDate, actor, onSaved }: TargetDateFormProps) {
  const [date, setDate] = useState(targetGoLiveDate ? targetGoLiveDate.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTargetGoLiveDate(schoolId, date ? new Date(date).toISOString() : undefined, actor);
      toast.success("Target launch date updated");
      onSaved();
    } catch (err) {
      console.error("Failed to save target go-live date", { schoolId, err });
      toast.error("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Target launch date</h4>
      <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
        {saving ? <span className="spinner" /> : "Save date"}
      </button>
    </div>
  );
}

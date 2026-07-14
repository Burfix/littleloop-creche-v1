"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppUser, LaunchAuditLogEntry, School, SchoolLaunchRecord, SchoolLaunchStatus } from "@/lib/types";
import { getSchoolLaunchRecord, getSchoolLaunchStatus } from "@/lib/school-launch";
import { actorFromAppUser, getAuditLogForSchool } from "@/lib/school-launch-admin";
import { ProgressBar } from "../../../owner/components/launch/ProgressBar";
import { AdminStageOverview } from "./AdminStageOverview";
import { SpecialistEditorForm } from "./SpecialistEditorForm";
import { PaymentEditorForm } from "./PaymentEditorForm";
import { TargetDateForm } from "./TargetDateForm";
import { SessionsManager } from "./SessionsManager";
import { UploadReviewList } from "./UploadReviewList";
import { TaskOverridesPanel } from "./TaskOverridesPanel";
import { AuditLogList } from "./AuditLogList";

interface SchoolLaunchAdminPanelProps {
  school: School;
  appUser: AppUser;
}

// Composes every editor for one school's launch record. Re-fetches from
// scratch after any write (same "derive, don't optimistically patch"
// philosophy as the owner-side workspace) rather than trying to keep a
// nested status/record tree in sync by hand across nine different forms.
export function SchoolLaunchAdminPanel({ school, appUser }: SchoolLaunchAdminPanelProps) {
  const [status, setStatus] = useState<SchoolLaunchStatus | null>(null);
  const [record, setRecord] = useState<SchoolLaunchRecord | null>(null);
  const [auditLog, setAuditLog] = useState<LaunchAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);

  const actor = actorFromAppUser(appUser);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        getSchoolLaunchStatus(school.id, school, null),
        getSchoolLaunchRecord(school.id),
      ]);
      setStatus(s);
      setRecord(r);
    } finally {
      setLoading(false);
    }
  }, [school]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      setAuditLog(await getAuditLogForSchool(school.id));
    } finally {
      setAuditLoading(false);
    }
  }, [school]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void load();
      void loadAudit();
    });
  }, [load, loadAudit]);

  const handleSaved = () => {
    void load();
    void loadAudit();
  };

  if (loading || !status || !record) {
    return <div className="card" style={{ display: "flex", justifyContent: "center", padding: 24 }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--text-muted)" }}>Launch progress</p>
        <ProgressBar percent={status.progressPct} label={`${status.progressPct} percent complete`} />
        <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600 }}>
          {status.progressPct}% complete{status.isComplete ? " · Live" : ""}
        </p>
      </div>

      <AdminStageOverview stages={status.stages} />
      <SpecialistEditorForm schoolId={school.id} specialist={record.specialist} actor={actor} onSaved={handleSaved} />
      <PaymentEditorForm schoolId={school.id} payment={record.payment} actor={actor} onSaved={handleSaved} />
      <TargetDateForm schoolId={school.id} targetGoLiveDate={record.targetGoLiveDate} actor={actor} onSaved={handleSaved} />
      <SessionsManager schoolId={school.id} sessions={record.sessions} actor={actor} onSaved={handleSaved} />
      <UploadReviewList schoolId={school.id} reviewerUid={appUser.uid} uploads={status.uploads} actor={actor} onSaved={handleSaved} />
      <TaskOverridesPanel schoolId={school.id} stages={status.stages} record={record} actor={actor} onSaved={handleSaved} />
      <AuditLogList entries={auditLog} loading={auditLoading} />
    </div>
  );
}

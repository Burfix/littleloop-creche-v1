"use client";

import type { SchoolLaunchStage } from "@/lib/types";
import { StatusBadge } from "../../../owner/components/launch/StatusBadge";
import { ResponsibilityBadge } from "../../../owner/components/launch/ResponsibilityBadge";

interface AdminStageOverviewProps {
  stages: SchoolLaunchStage[];
}

// Read-only recap of every stage/task for staff — deliberately NOT the
// owner-facing LaunchStageCard/LaunchTaskCard/DataUploadWidget chain, since
// those render an upload button that calls createLaunchUpload() as the
// signed-in user, and firestore.rules only allows owners (not superadmin)
// to create launchUploads docs. Staff act through the dedicated editor
// panels below this (specialist/payment/sessions/overrides/upload review)
// instead of through owner-shaped controls.
export function AdminStageOverview({ stages }: AdminStageOverviewProps) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Launch journey</h4>
      {stages.map(stage => {
        const visibleTasks = stage.tasks.filter(t => t.status !== "not_applicable");
        if (visibleTasks.length === 0) return null;
        return (
          <div key={stage.key} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>{stage.title}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {visibleTasks.map(task => (
                <div key={task.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, minWidth: 0 }}>{task.title}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <ResponsibilityBadge responsibility={task.responsibility} />
                    <StatusBadge status={task.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

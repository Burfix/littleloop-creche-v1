"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CircleCheck } from "lucide-react";
import type { LaunchUpload, LaunchUploadKind, SchoolLaunchStage } from "@/lib/types";
import { TASK_KEY_TO_UPLOAD_KIND } from "@/lib/school-launch";
import { LaunchTaskCard } from "./LaunchTaskCard";

interface LaunchStageCardProps {
  stage: SchoolLaunchStage;
  isCurrent: boolean;
  isComplete: boolean;
  schoolId: string;
  uploads: Partial<Record<LaunchUploadKind, LaunchUpload>>;
  onUploaded: () => void;
}

// Progressive disclosure: the current stage starts expanded, everything
// else starts collapsed — completed stages read as a compact confirmation,
// future stages stay visible but subdued rather than hidden entirely.
export function LaunchStageCard({ stage, isCurrent, isComplete, schoolId, uploads, onUploaded }: LaunchStageCardProps) {
  const [expanded, setExpanded] = useState(isCurrent);

  const requiredTasks = stage.tasks.filter(t => t.required);
  const completedCount = requiredTasks.filter(t => t.status === "completed").length;
  const hasBlocker = stage.tasks.some(t => t.status === "blocked" || t.status === "needs_changes");
  const visibleTasks = stage.tasks.filter(t => t.status !== "not_applicable");

  return (
    <div
      className="card"
      style={{
        padding: 0,
        opacity: !isCurrent && !isComplete ? 0.65 : 1,
        border: isCurrent ? "1.5px solid var(--brand)" : undefined,
      }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10, padding: "14px 16px", background: "none", border: "none", cursor: "pointer",
          textAlign: "left", minHeight: 44,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {isComplete ? (
            <CircleCheck size={18} color="var(--success)" aria-hidden="true" />
          ) : (
            <span
              aria-hidden="true"
              style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${isCurrent ? "var(--brand)" : "var(--border)"}`,
                display: "inline-block",
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{stage.title}</p>
            {!expanded && <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{stage.description}</p>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {requiredTasks.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{completedCount}/{requiredTasks.length}</span>
          )}
          {hasBlocker && <span className="pill pill-red" style={{ fontSize: 10 }}>Blocked</span>}
          {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 12px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>{stage.description}</p>
          {visibleTasks.map(task => {
            const uploadKind = TASK_KEY_TO_UPLOAD_KIND[task.key];
            return (
              <LaunchTaskCard
                key={task.id}
                task={task}
                schoolId={schoolId}
                latestUpload={uploadKind ? uploads[uploadKind] : undefined}
                onUploaded={onUploaded}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

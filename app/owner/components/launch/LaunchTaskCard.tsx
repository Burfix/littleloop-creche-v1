"use client";

import { useRouter } from "next/navigation";
import type { LaunchTaskActionType, LaunchUpload, SchoolLaunchTask } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { ResponsibilityBadge } from "./ResponsibilityBadge";
import { DataUploadWidget } from "./DataUploadWidget";
import { TASK_KEY_TO_UPLOAD_KIND } from "@/lib/school-launch";

interface LaunchTaskCardProps {
  task: SchoolLaunchTask;
  schoolId: string;
  latestUpload?: LaunchUpload;
  onUploaded: () => void;
}

const ACTION_LABEL: Record<LaunchTaskActionType, string> = {
  manual_form: "Continue",
  upload: "Upload file",
  external_link: "Open",
  confirmation: "Mark done",
  none: "",
};

function formatDueDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function LaunchTaskCard({ task, schoolId, latestUpload, onUploaded }: LaunchTaskCardProps) {
  const router = useRouter();
  const isDone = task.status === "completed";
  const showBlockingDetail = task.status === "blocked" || task.status === "needs_changes";
  const uploadKind = TASK_KEY_TO_UPLOAD_KIND[task.key];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{task.title}</p>
          {task.description && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{task.description}</p>}
        </div>
        <ResponsibilityBadge responsibility={task.responsibility} />
      </div>

      {task.actionType !== "upload" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <StatusBadge status={task.status} detail={showBlockingDetail ? task.blockingReason : undefined} />
          {task.dueDate && !isDone && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Due {formatDueDate(task.dueDate)}</span>
          )}
        </div>
      )}

      {task.notes && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{task.notes}</p>
      )}

      {task.actionType === "upload" && uploadKind && !isDone && (
        <DataUploadWidget
          schoolId={schoolId}
          kind={uploadKind}
          actionLabel={task.title}
          helpText={task.description ?? "Upload a file and we'll take care of the rest."}
          latestUpload={latestUpload}
          onUploaded={onUploaded}
        />
      )}
      {task.actionType === "upload" && isDone && (
        <StatusBadge status="completed" detail={latestUpload ? `${latestUpload.fileName}, imported` : undefined} />
      )}

      {task.actionType !== "upload" && task.actionType !== "none" && task.actionHref && !isDone && (
        <button
          className="btn btn-secondary"
          style={{ fontSize: 13, padding: "8px 12px", alignSelf: "flex-start" }}
          onClick={() => router.push(task.actionHref!)}
        >
          {ACTION_LABEL[task.actionType] || "Continue"}
        </button>
      )}

      {task.secondaryActionHref && !isDone && (
        <button
          type="button"
          onClick={() => router.push(task.secondaryActionHref!)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)", fontSize: 12, fontWeight: 600, padding: 0, textAlign: "left", alignSelf: "flex-start" }}
        >
          {task.secondaryActionLabel ?? "Do this manually instead"}
        </button>
      )}
    </div>
  );
}

"use client";

import { Ban, CalendarCheck2, Circle, CircleCheck, CircleDashed, CircleSlash, Clock, Send, TriangleAlert } from "lucide-react";
import type { LaunchTaskStatus } from "@/lib/types";

// Status is never communicated by colour alone — every status pairs an
// icon with human copy. Avoid "Pending"/"Processing"/"Status 2" style
// labels; each of these reads like something a person would actually say.
const STATUS_CONFIG: Record<LaunchTaskStatus, { label: string; Icon: typeof Circle; color: string }> = {
  not_started: { label: "Not started yet", Icon: CircleDashed, color: "var(--text-muted)" },
  waiting_for_school: { label: "Waiting for you", Icon: Clock, color: "var(--brand)" },
  submitted: { label: "Submitted — awaiting review", Icon: Send, color: "var(--brand)" },
  under_review: { label: "LittleLoop is reviewing this", Icon: Clock, color: "var(--brand)" },
  needs_changes: { label: "Needs your attention", Icon: TriangleAlert, color: "var(--danger)" },
  scheduled: { label: "Scheduled", Icon: CalendarCheck2, color: "var(--brand)" },
  completed: { label: "Done", Icon: CircleCheck, color: "var(--success)" },
  blocked: { label: "Blocked", Icon: Ban, color: "var(--danger)" },
  not_applicable: { label: "Not needed right now", Icon: CircleSlash, color: "var(--text-muted)" },
};

interface StatusBadgeProps {
  status: LaunchTaskStatus;
  /** Overrides the default label with task-specific human copy, e.g. "Teacher training booked". */
  detail?: string;
}

export function StatusBadge({ status, detail }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: cfg.color }}>
      <Icon size={13} aria-hidden="true" />
      <span>{detail ?? cfg.label}</span>
    </span>
  );
}

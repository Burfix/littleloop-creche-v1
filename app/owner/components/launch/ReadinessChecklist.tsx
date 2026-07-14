"use client";

import { Circle, CircleCheck, TriangleAlert } from "lucide-react";
import type { LaunchReadiness } from "@/lib/school-launch";
import { SectionHeader } from "./SectionHeader";

interface ReadinessChecklistProps {
  readiness: LaunchReadiness;
}

function ReadinessRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
      {met
        ? <CircleCheck size={16} color="var(--success)" aria-hidden="true" />
        : <Circle size={16} color="var(--text-muted)" aria-hidden="true" />}
      <span style={{ fontSize: 13, color: met ? "inherit" : "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

// Consolidates what used to be a separate ad-hoc "blockers" panel — the
// blocker messages and the full required/recommended breakdown are the
// same underlying data (getLaunchReadiness), shown once here instead of
// twice in different places.
export function ReadinessChecklist({ readiness }: ReadinessChecklistProps) {
  const outstandingRequired = readiness.requiredForLaunch.filter(c => !c.met).length;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHeader
        title="Launch readiness"
        subtitle={
          readiness.isReadyForLaunch
            ? "Ready for launch"
            : `${outstandingRequired} item${outstandingRequired === 1 ? "" : "s"} still needed`
        }
      />

      {readiness.blockerMessages.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
            <TriangleAlert size={14} aria-hidden="true" />
            {readiness.blockerMessages.length} item{readiness.blockerMessages.length > 1 ? "s are" : " is"} holding back launch
          </p>
          {readiness.blockerMessages.map((msg, i) => (
            <p key={i} style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", paddingLeft: 22 }}>{msg}</p>
          ))}
        </div>
      )}

      <div>
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
          Required for launch
        </p>
        {readiness.requiredForLaunch.map(c => <ReadinessRow key={c.key} met={c.met} label={c.label} />)}
      </div>

      {readiness.recommendedAfterLaunch.length > 0 && (
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Recommended after launch
          </p>
          {readiness.recommendedAfterLaunch.map(c => <ReadinessRow key={c.key} met={c.met} label={c.label} />)}
        </div>
      )}
    </div>
  );
}

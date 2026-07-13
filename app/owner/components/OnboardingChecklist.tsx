"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type { OnboardingStatus } from "@/lib/onboarding";

interface OnboardingChecklistProps {
  schoolName: string;
  status: OnboardingStatus;
  onStepClick: (tab: "settings" | "billing") => void;
}

// This card replaces the zero-value overview cards (0/50 children, 0%
// attendance, R0 collected) that a brand-new owner would otherwise see —
// those numbers are accurate but meaningless before any real data exists.
// Once every step is complete, OwnerDashboard stops rendering this
// component entirely and falls through to the existing overview tab
// unchanged, so nothing about the post-setup experience changes.
export function OnboardingChecklist({ schoolName, status, onStepClick }: OnboardingChecklistProps) {
  const { steps, completedCount, totalCount, nextIncomplete } = status;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Set up {schoolName}</h3>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{completedCount} of {totalCount} done</span>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)" }}>
          Nothing here is one-shot — come back any time from Settings or Billing.
        </p>

        <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden", marginBottom: 20 }}>
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              borderRadius: 3,
              background: "var(--success)",
              transition: "width 300ms ease-out",
            }}
          />
        </div>

        <div>
          {steps.map((step, i) => (
            <div
              key={step.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 0",
                borderBottom: i < steps.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              {step.done ? (
                <CheckCircle2 size={20} color="var(--success)" />
              ) : (
                <Circle size={20} color={nextIncomplete?.key === step.key ? "var(--brand)" : "var(--text-muted)"} />
              )}
              <span
                style={{
                  fontSize: 14,
                  color: step.done ? "var(--text-muted)" : "inherit",
                  textDecoration: step.done ? "line-through" : "none",
                  fontWeight: !step.done && nextIncomplete?.key === step.key ? 600 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {nextIncomplete && (
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 16 }}
            onClick={() => onStepClick(nextIncomplete.href.tab)}
          >
            {nextIncomplete.label}
          </button>
        )}
      </div>
    </div>
  );
}

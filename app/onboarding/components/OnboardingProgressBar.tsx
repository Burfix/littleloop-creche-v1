"use client";

interface OnboardingProgressBarProps {
  /** 1-indexed: how many segments (including the current one) should read as filled. */
  step: number;
  totalSteps?: number;
  /** Shown next to "Step X of N", e.g. "School details" — also read by screen readers. */
  label?: string;
}

// Shared across every numbered onboarding form screen (School setup through
// Configure billing — five steps). Welcome and /onboarding/complete are
// deliberately NOT numbered here: Welcome is an intro, not a task, and
// /onboarding/complete is the destination after the last step rather than
// a step itself. Previously this defaulted to 7 segments and every screen
// (including Welcome) counted itself into the total, so the copy and the
// bar disagreed with each other and with reality — fixed to a single
// source of truth: 5 real steps, always passed explicitly.
export function OnboardingProgressBar({ step, totalSteps = 5, label }: OnboardingProgressBarProps) {
  const accessibleLabel = label ? `Step ${step} of ${totalSteps}: ${label}` : `Step ${step} of ${totalSteps}`;

  return (
    <div style={{ marginBottom: 40 }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }} aria-hidden="true">
        Step {step} of {totalSteps}{label ? ` · ${label}` : ""}
      </p>
      <div
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={accessibleLabel}
        style={{ display: "flex", gap: 6 }}
      >
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              background: i < step ? "var(--brand)" : "var(--border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

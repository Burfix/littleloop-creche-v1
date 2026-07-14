"use client";

interface ProgressBarProps {
  /** 0-100 */
  percent: number;
  label?: string;
}

// Generic percentage progress bar for the launch workspace — distinct from
// app/onboarding/components/OnboardingProgressBar, which renders fixed
// welcome-flow steps rather than a computed percentage.
export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${clamped}% complete`}
      style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}
    >
      <div
        style={{
          height: "100%",
          width: `${clamped}%`,
          borderRadius: 4,
          background: "var(--success)",
          transition: "width 300ms ease-out",
        }}
      />
    </div>
  );
}

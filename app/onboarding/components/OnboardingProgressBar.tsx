"use client";

interface OnboardingProgressBarProps {
  /** 1-indexed: how many segments (including the current one) should read as filled. */
  step: number;
  totalSteps?: number;
}

// Shared across every onboarding screen (Welcome through Configure billing)
// so the step count and styling live in one place instead of being copied
// into each screen. Success and the post-onboarding dashboard checklist
// intentionally don't use this — see LittleLoop-Onboarding-Redesign-Spec.docx.
export function OnboardingProgressBar({ step, totalSteps = 7 }: OnboardingProgressBarProps) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 40 }}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 2,
            background: i < step ? "var(--brand)" : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

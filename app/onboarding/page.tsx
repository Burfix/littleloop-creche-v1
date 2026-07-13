"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import { updateUser } from "@/lib/db";
import { Sprout } from "lucide-react";

// Screen 1 of the redesigned onboarding flow (see
// LittleLoop-Onboarding-Redesign-Spec.docx) — large single headline, one
// subhead, one primary CTA, no scrolling. app/page.tsx routes new owners
// here automatically the first time (owners with an already-complete
// school, or who've already seen this screen, skip straight to /owner).
export default function OnboardingWelcomePage() {
  const { appUser } = useAuth();
  const { school } = useSchool();
  const router = useRouter();

  const firstName = appUser?.displayName?.split(" ")[0] ?? "there";
  const schoolName = school?.name ?? "your school";

  const proceed = () => {
    // Fire-and-forget: if this write fails, the owner just sees Welcome
    // once more next login — not worth blocking navigation over.
    if (appUser) void updateUser(appUser.uid, { hasSeenOnboardingWelcome: true });
    router.push("/owner");
  };

  return (
    <div className="app-shell" style={{ justifyContent: "center", padding: "32px 24px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 40 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              background: i === 0 ? "var(--brand)" : "var(--border)",
            }}
          />
        ))}
      </div>

      <div
        style={{
          width: 48, height: 48, borderRadius: 14,
          background: "var(--brand-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <Sprout size={24} color="var(--success)" />
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, margin: "0 0 8px" }}>
        Welcome, {firstName}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
        Let&apos;s get {schoolName} live. Six short steps, about 8 minutes.
      </p>

      <div style={{ marginTop: "auto", paddingTop: 40 }}>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={proceed}>
          Get started
        </button>
        <button
          style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, marginTop: 8, padding: "10px 0" }}
          onClick={proceed}
        >
          I&apos;ll do this later
        </button>
      </div>
    </div>
  );
}

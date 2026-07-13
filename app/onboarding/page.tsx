"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import { Sprout } from "lucide-react";

// Screen 1 of the redesigned onboarding flow (see
// LittleLoop-Onboarding-Redesign-Spec.docx). This is a proof-of-concept for
// the new visual pattern only — large single headline, one subhead, one
// primary CTA, no scrolling. It is not yet wired into the sign-in redirect
// (app/page.tsx still sends every owner straight to /owner); a new owner
// only reaches this screen by navigating here directly today. Once the
// remaining step screens exist, app/page.tsx's redirect map should send
// owners with an incomplete OnboardingStatus here first.
export default function OnboardingWelcomePage() {
  const { appUser } = useAuth();
  const { school } = useSchool();
  const router = useRouter();

  const firstName = appUser?.displayName?.split(" ")[0] ?? "there";
  const schoolName = school?.name ?? "your school";

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
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => router.push("/owner")}>
          Get started
        </button>
        <button
          style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, marginTop: 8, padding: "10px 0" }}
          onClick={() => router.push("/owner")}
        >
          I&apos;ll do this later
        </button>
      </div>
    </div>
  );
}

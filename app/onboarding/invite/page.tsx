"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSchool, getChildrenForSchoolPage } from "@/lib/db";
import type { Child, School } from "@/lib/types";
import { OnboardingProgressBar } from "../components/OnboardingProgressBar";
import { InviteForm } from "@/app/owner/components/InviteForm";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

// Screens 5-6 of the redesigned onboarding flow (see
// LittleLoop-Onboarding-Redesign-Spec.docx), combined into one screen —
// InviteForm already handles both roles via its own role selector, so
// splitting "invite teachers" and "invite parents" into two separate
// screens would mean navigating away and back for no real benefit. Reuses
// the existing component and /api/invite endpoint as-is.
export default function OnboardingInvitePage() {
  const { appUser } = useAuth();
  const router = useRouter();

  const [school, setSchool] = useState<School | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitedCount, setInvitedCount] = useState(0);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }

    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (!appUser.schoolId) { if (!cancelled) { setLoading(false); router.replace("/owner"); } return; }
      try {
        const [s, childPage] = await Promise.all([
          getSchool(appUser.schoolId),
          getChildrenForSchoolPage(appUser.schoolId, { includePendingErasure: true }),
        ]);
        if (cancelled) return;
        setSchool(s);
        setChildren(childPage.items);
      } catch {
        if (!cancelled) toast.error("Could not load school details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [appUser, router]);

  useEffect(() => {
    // Defensive: a resolved schoolId that fails to load (deleted/corrupt
    // doc) shouldn't strand the owner on an infinite spinner.
    if (!loading && appUser?.schoolId && !school) {
      router.replace("/owner");
    }
  }, [loading, appUser, school, router]);

  if (loading || !appUser || !school) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  return (
    <div className="app-shell" style={{ padding: "32px 24px" }}>
      <OnboardingProgressBar step={4} label="Teachers and parents" />

      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
        Invite your team
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
        Teachers and parents get an email to set their password and access their dashboard.
      </p>

      <div className="card">
        <InviteForm
          schoolId={school.id}
          schoolSlug={school.slug}
          childRecords={children}
          onInvited={() => setInvitedCount(c => c + 1)}
        />
      </div>

      {invitedCount > 0 && (
        <p style={{ fontSize: 12, color: "var(--success)", margin: "12px 0 0", textAlign: "center" }}>
          {invitedCount} invite{invitedCount > 1 ? "s" : ""} sent
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => router.push("/onboarding/billing")}>
          Continue
        </button>
        <button
          style={{
            width: "100%", background: "none", border: "none", color: "var(--text-muted)",
            fontSize: 13, marginTop: 8, padding: "10px 0",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}
          onClick={() => router.push("/onboarding/classes")}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, padding: "6px 0" }}
          onClick={() => router.push("/owner")}
        >
          I&apos;ll do this later
        </button>
      </div>
    </div>
  );
}

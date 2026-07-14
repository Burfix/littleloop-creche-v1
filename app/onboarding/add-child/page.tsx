"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { Child } from "@/lib/types";
import { OnboardingProgressBar } from "../components/OnboardingProgressBar";
import { AddChildForm } from "@/app/owner/components/AddChildForm";
import { ArrowLeft, CircleCheck, Plus } from "lucide-react";

// Screen 3 of the redesigned onboarding flow (see
// LittleLoop-Onboarding-Redesign-Spec.docx) — reached from School setup's
// "Continue". Reuses the existing AddChildForm component as-is (same
// /api/owner/children endpoint, same validation) rather than duplicating
// the form logic here; this screen only adds the onboarding chrome
// (progress bar, success state, skip/back) around it.
export default function AddChildPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [added, setAdded] = useState<Child | null>(null);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    // No school on this account yet — nothing for this screen to attach a
    // child to. Bounce to the dashboard rather than showing a dead-end form.
    if (!appUser.schoolId) { router.replace("/owner"); }
  }, [appUser, router]);

  if (!appUser?.schoolId) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  const schoolId = appUser.schoolId;

  return (
    <div className="app-shell" style={{ padding: "32px 24px" }}>
      <OnboardingProgressBar step={2} label="Children" />

      {!added ? (
        <>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
            Add your first child
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
            You can add the rest later. This just gets your first record in.
          </p>

          <AddChildForm schoolId={schoolId} onChildAdded={setAdded} />

          <div style={{ marginTop: 24 }}>
            <button
              style={{
                width: "100%", background: "none", border: "none", color: "var(--text-muted)",
                fontSize: 13, padding: "10px 0",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}
              onClick={() => router.push("/onboarding/school-setup")}
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
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 24 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 14,
              background: "var(--brand-light)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <CircleCheck size={24} color="var(--success)" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
            {added.firstName} is added
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 28px", maxWidth: 280 }}>
            You can add more children any time from Settings.
          </p>

          <button
            className="btn btn-secondary"
            style={{ width: "100%", marginBottom: 10 }}
            onClick={() => setAdded(null)}
          >
            <Plus size={16} /> Add another child
          </button>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={() => router.push("/onboarding/classes")}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSchool, getTeachersForSchool } from "@/lib/db";
import type { AppUser, ClassRoom, School } from "@/lib/types";
import { OnboardingProgressBar } from "../components/OnboardingProgressBar";
import { ClassesSection } from "@/app/owner/components/ClassesSection";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

// Screen 4 of the redesigned onboarding flow (see
// LittleLoop-Onboarding-Redesign-Spec.docx) — reached from Add first
// child's "Continue". Reuses the existing ClassesSection component as-is
// (same createClass/updateClass/deleteClass calls) rather than duplicating
// class-management logic here; this screen only adds the onboarding
// chrome (progress bar, continue/skip/back) around it. Teachers will
// almost always be empty at this point — that's fine, ClassesSection
// already handles the no-teachers-yet state.
export default function OnboardingClassesPage() {
  const { appUser } = useAuth();
  const router = useRouter();

  const [school, setSchool] = useState<School | null>(null);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }

    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (!appUser.schoolId) { if (!cancelled) { setLoading(false); router.replace("/owner"); } return; }
      try {
        const [s, t] = await Promise.all([
          getSchool(appUser.schoolId),
          getTeachersForSchool(appUser.schoolId),
        ]);
        if (cancelled) return;
        setSchool(s);
        setTeachers(t);
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
      <OnboardingProgressBar step={3} label="Classes" />

      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
        Create your first class
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
        Classes group children by age so you can track attendance and daily updates together.
      </p>

      <div className="card">
        <ClassesSection school={school} teachers={teachers} onClassesChange={setClasses} />
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          onClick={() => router.push("/onboarding/invite")}
        >
          Continue
        </button>
        <button
          style={{
            width: "100%", background: "none", border: "none", color: "var(--text-muted)",
            fontSize: 13, marginTop: 8, padding: "10px 0",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}
          onClick={() => router.push("/onboarding/add-child")}
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import { getSchool } from "@/lib/db";
import { getSchoolLaunchStatus, UNASSIGNED_SPECIALIST } from "@/lib/school-launch";
import type { SchoolLaunchStatus } from "@/lib/types";
import { PageHeader } from "../components/PageHeader";
import { InlineErrorState } from "../components/InlineErrorState";
import { LoadingSkeleton } from "../components/launch/LoadingSkeleton";
import { LaunchStageCard } from "../components/launch/LaunchStageCard";
import { PaymentSummaryCard } from "../components/launch/PaymentSummaryCard";
import { ImplementationSpecialistCard } from "../components/launch/ImplementationSpecialistCard";

// Read-only recap of a school's School Launch Package journey, kept
// reachable from Settings after activation (per spec: "Do not permanently
// remove access to the launch summary"). Reuses LaunchStageCard rather than
// building a second rendering of the same stage/task data — every stage
// starts collapsed here since there's no "current" stage once launched.
export default function LaunchSummaryPage() {
  const { appUser } = useAuth();
  const { school, loading: schoolLoading } = useSchool();
  const router = useRouter();

  const [status, setStatus] = useState<SchoolLaunchStatus | null>(null);
  const [schoolName, setSchoolName] = useState<string>("your school");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "owner") { router.replace("/"); return; }
    if (schoolLoading) return;

    let cancelled = false;
    const schoolId = school?.id ?? appUser.schoolId;

    async function load() {
      if (!schoolId) { if (!cancelled) setLoading(false); return; }
      if (!cancelled) setLoadError(false);
      try {
        const resolvedSchool = school?.id === schoolId ? school : await getSchool(schoolId);
        const result = await getSchoolLaunchStatus(schoolId, resolvedSchool, appUser);
        if (cancelled) return;
        setStatus(result);
        setSchoolName(resolvedSchool?.name ?? "your school");
      } catch (err) {
        console.error("Failed to load School Launch summary", { schoolId, err });
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [appUser, school, schoolLoading, router, reloadToken]);

  const handleRetry = () => {
    setLoading(true);
    setLoadError(false);
    setReloadToken(t => t + 1);
  };

  const schoolId = school?.id ?? appUser?.schoolId ?? "";

  return (
    <div className="app-shell app-shell--wide">
      <PageHeader
        eyebrow="Settings"
        title="School Launch Summary"
        actions={
          <button
            onClick={() => router.push("/owner")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      <div className="page-content" style={{ padding: "16px 20px" }}>
        {loading && <LoadingSkeleton />}

        {!loading && loadError && (
          <InlineErrorState
            message="We couldn't load your School Launch summary."
            detail="Your setup data is safe. This is a connection issue."
            onRetry={handleRetry}
          />
        )}

        {!loading && !loadError && !status && (
          <div className="card">
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
              No launch record found for {schoolName}.
            </p>
          </div>
        )}

        {!loading && !loadError && status && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card">
              <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-muted)" }}>
                {schoolName} completed its School Launch Package.
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                This is a read-only recap of how your school was set up. Nothing here needs further action.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <ImplementationSpecialistCard specialist={status.specialist ?? UNASSIGNED_SPECIALIST} />
              <PaymentSummaryCard payment={status.payment} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {status.stages.map(stage => {
                const requiredTasks = stage.tasks.filter(t => t.required);
                const isStageComplete = requiredTasks.length > 0 && requiredTasks.every(t => t.status === "completed");
                return (
                  <LaunchStageCard
                    key={stage.key}
                    stage={stage}
                    isCurrent={false}
                    isComplete={isStageComplete}
                    schoolId={schoolId}
                    uploads={status.uploads}
                    onUploaded={() => { /* read-only recap — uploads aren't expected here, no-op */ }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

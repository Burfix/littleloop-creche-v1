"use client";

import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import type { SchoolLaunchStatus } from "@/lib/types";
import { UNASSIGNED_SPECIALIST, getLaunchReadiness } from "@/lib/school-launch";
import { ProgressBar } from "./ProgressBar";
import { ImplementationSpecialistCard } from "./ImplementationSpecialistCard";
import { LaunchSessionCard } from "./LaunchSessionCard";
import { PaymentSummaryCard } from "./PaymentSummaryCard";
import { LaunchStageCard } from "./LaunchStageCard";
import { ReadinessChecklist } from "./ReadinessChecklist";

interface SchoolLaunchWorkspaceProps {
  schoolName: string;
  status: SchoolLaunchStatus;
  schoolId: string;
  onRefresh: () => void;
}

const PAYMENT_STATUS_LABEL: Record<SchoolLaunchStatus["payment"]["status"], string> = {
  unpaid: "Awaiting payment",
  invoiced: "Invoiced",
  paid: "Paid",
  waived: "Waived",
};

function formatTargetDate(iso?: string): string {
  if (!iso) return "Not yet set";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

// Replaces OnboardingChecklist on the Overview tab while a school isn't
// fully launched. Once status.isComplete flips true, app/owner/page.tsx
// stops rendering this entirely and falls through to the unchanged,
// existing operational dashboard — see the "isComplete" branch there.
export function SchoolLaunchWorkspace({ schoolName, status, schoolId, onRefresh }: SchoolLaunchWorkspaceProps) {
  const router = useRouter();
  const specialist = status.specialist ?? UNASSIGNED_SPECIALIST;
  const readiness = getLaunchReadiness(status);

  // Primary CTA targets the first actionable, required, incomplete task in
  // the current stage. Stages whose next step is LittleLoop-owned (team
  // training confirmation, final readiness, go-live) have no actionable
  // task at all, so no CTA renders — correct, there's nothing to click.
  const primaryTask = status.currentStage?.tasks.find(
    t => t.required && t.status !== "completed" && t.status !== "not_applicable"
  );

  const handlePrimaryCta = () => {
    if (!primaryTask) return;
    if (primaryTask.actionHref) {
      router.push(primaryTask.actionHref);
      return;
    }
    // Upload-type tasks act inline on the stage card itself (already
    // auto-expanded as the current stage) rather than navigating away.
    document.getElementById(`launch-stage-${status.currentStage!.key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
            Let&apos;s get {schoolName} ready to launch
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            You&apos;re not doing this alone — LittleLoop is preparing your school with you.
          </p>
        </div>

        <div>
          <ProgressBar percent={status.progressPct} label={`${status.progressPct} percent of launch complete`} />
          <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600 }}>{status.progressPct}% complete</p>
        </div>

        <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <dt style={{ color: "var(--text-muted)" }}>Target launch</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{formatTargetDate(status.targetGoLiveDate)}</dd>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <dt style={{ color: "var(--text-muted)" }}>{status.payment.packageName}</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{PAYMENT_STATUS_LABEL[status.payment.status]}</dd>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <dt style={{ color: "var(--text-muted)" }}>Your specialist</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{specialist.name}</dd>
          </div>
          {status.nextSession && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <dt style={{ color: "var(--text-muted)" }}>Next session</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{status.nextSession.title}</dd>
            </div>
          )}
        </dl>

        {primaryTask && (
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={handlePrimaryCta}>
            <Rocket size={16} aria-hidden="true" /> Continue setup
          </button>
        )}
      </div>

      {/* Launch readiness — required/recommended breakdown, blockers surfaced at the top */}
      <ReadinessChecklist readiness={readiness} />

      {/* Launch team & package — stacks on mobile, grid on wider screens */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <ImplementationSpecialistCard specialist={specialist} />
        <LaunchSessionCard session={status.nextSession} />
        <PaymentSummaryCard payment={status.payment} />
      </div>

      {/* Stage journey */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Your launch journey</h2>
        {status.stages.map(stage => {
          const requiredTasks = stage.tasks.filter(t => t.required);
          const isStageComplete = requiredTasks.length > 0 && requiredTasks.every(t => t.status === "completed");
          return (
            <div key={stage.key} id={`launch-stage-${stage.key}`}>
              <LaunchStageCard
                stage={stage}
                isCurrent={status.currentStage?.key === stage.key}
                isComplete={isStageComplete}
                schoolId={schoolId}
                uploads={status.uploads}
                onUploaded={onRefresh}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSchool } from "@/lib/db";
import { countWhere } from "@/lib/onboarding";
import type { School } from "@/lib/types";
import { CircleCheck, Rocket } from "lucide-react";

interface CompletionCounts {
  childCount: number;
  classCount: number;
  teacherCount: number;
  parentCount: number;
  invoiceCount: number;
}

function completionLine(done: boolean, doneText: string, startedText: string): string {
  return done ? doneText : startedText;
}

// Reached after the billing step (or its skip path) rather than routing
// straight into /owner. This screen exists because "initial setup" and
// "School Launch" are two different things: the owner has just finished
// submitting information through the wizard, but nothing has been
// reviewed, validated or configured by LittleLoop yet. Saying "you're
// live" here would be dishonest — the actual go-live moment is
// SuccessPanel (app/owner/components/launch/SuccessPanel.tsx), gated on
// an explicit launchedAt timestamp set by staff, not on this screen.
export default function OnboardingCompletePage() {
  const { appUser } = useAuth();
  const router = useRouter();

  const [school, setSchool] = useState<School | null>(null);
  const [counts, setCounts] = useState<CompletionCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "owner") { router.replace("/"); return; }
    if (!appUser.schoolId) { router.replace("/owner"); return; }

    let cancelled = false;
    const schoolId = appUser.schoolId;

    void Promise.resolve().then(async () => {
      try {
        const [resolvedSchool, childCount, classCount, teacherCount, parentCount, invoiceCount] = await Promise.all([
          getSchool(schoolId),
          countWhere("children", schoolId),
          countWhere("classes", schoolId),
          countWhere("users", schoolId, ["role", "teacher"]),
          countWhere("users", schoolId, ["role", "parent"]),
          countWhere("invoices", schoolId),
        ]);
        if (cancelled) return;
        setSchool(resolvedSchool);
        setCounts({ childCount, classCount, teacherCount, parentCount, invoiceCount });
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [appUser, router]);

  if (loading || !appUser || !counts) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  const schoolName = school?.name ?? "Your school";

  const items = [
    "School details confirmed",
    completionLine(counts.childCount > 0, "First child added", "Child information started"),
    completionLine(counts.classCount > 0, "Classes created", "Class setup started"),
    completionLine(counts.teacherCount > 0 || counts.parentCount > 0, "Teacher and parent invitations sent", "Teacher and parent invitations started"),
    completionLine(counts.invoiceCount > 0, "First invoice created", "Billing setup started"),
  ];

  const goToOwner = () => router.push("/owner");

  return (
    <div className="app-shell" style={{ padding: "32px 24px", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: 14,
            background: "var(--brand-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <CircleCheck size={24} color="var(--success)" aria-hidden="true" />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Initial setup complete</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px", maxWidth: 320 }}>
          {schoolName} is ready for the next stage of its School Launch.
        </p>

        <div className="card" style={{ width: "100%", textAlign: "left", marginBottom: 20 }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Completed
          </p>
          {items.map(item => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
              <CircleCheck size={15} color="var(--success)" aria-hidden="true" />
              <span style={{ fontSize: 13 }}>{item}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ width: "100%", textAlign: "left", marginBottom: 28 }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Next
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>
            LittleLoop will review your information, prepare your school and help your team get ready for go live.
          </p>
        </div>

        <button className="btn btn-primary" style={{ width: "100%", marginBottom: 10 }} onClick={goToOwner}>
          <Rocket size={16} aria-hidden="true" /> View School Launch
        </button>
        <button
          style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, padding: "10px 0" }}
          onClick={goToOwner}
        >
          Open Owner Cockpit
        </button>
      </div>
    </div>
  );
}

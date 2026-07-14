"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { User } from "firebase/auth";
import type { AppUser, School } from "@/lib/types";
import { getSchoolLaunchAdminSummaries, type SchoolLaunchAdminSummary } from "@/lib/school-launch-admin";
import { ProgressBar } from "../../../owner/components/launch/ProgressBar";
import { SchoolLaunchAdminPanel } from "./SchoolLaunchAdminPanel";

interface LaunchTabProps {
  schools: School[];
  appUser: AppUser;
  firebaseUser: User | null;
}

const PAYMENT_PILL: Record<SchoolLaunchAdminSummary["paymentStatus"], string> = {
  unpaid: "pill-gray",
  invoiced: "pill-amber",
  paid: "pill-green",
  waived: "pill-blue",
};

export function LaunchTab({ schools, appUser, firebaseUser }: LaunchTabProps) {
  const [summaries, setSummaries] = useState<Record<string, SchoolLaunchAdminSummary>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<School | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setLoading(true);
      const result = await getSchoolLaunchAdminSummaries(schools);
      if (!cancelled) { setSummaries(result); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [schools]);

  if (selected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          onClick={() => setSelected(null)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: 0, alignSelf: "flex-start" }}
        >
          <ChevronLeft size={14} /> All schools
        </button>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selected.name}</h3>
        <SchoolLaunchAdminPanel school={selected} appUser={appUser} firebaseUser={firebaseUser} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>School Launch Package</h3>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-muted)" }}>
        Manage each school&apos;s paid onboarding: specialist, payment, sessions, data review, and go-live.
      </p>

      {loading && <div className="card"><div className="spinner" /></div>}

      {!loading && schools.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No schools yet.</p>
      )}

      {!loading && schools.map(school => {
        const summary = summaries[school.id];
        return (
          <div key={school.id} className="card" style={{ cursor: "pointer" }} onClick={() => setSelected(school)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{school.name}</p>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {summary && <span className={`pill ${PAYMENT_PILL[summary.paymentStatus]}`}>{summary.paymentStatus}</span>}
                {!!summary?.pendingUploadCount && (
                  <span className="pill pill-amber">{summary.pendingUploadCount} to review</span>
                )}
                {!!summary?.blockerCount && (
                  <span className="pill pill-red">{summary.blockerCount} blocked</span>
                )}
              </div>
            </div>
            {summary && (
              <div style={{ marginTop: 8 }}>
                <ProgressBar percent={summary.progressPct} label={`${summary.progressPct} percent complete`} />
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  {summary.isComplete ? "Live" : `${summary.progressPct}% complete`}
                  {summary.specialistName ? ` · ${summary.specialistName}` : " · No specialist assigned"}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

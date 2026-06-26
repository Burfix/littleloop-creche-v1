"use client";

import { Bell } from "lucide-react";
import toast from "react-hot-toast";
import type { CockpitStats } from "@/lib/types";
import { format } from "date-fns";

interface FinancialStatsProps {
  stats: CockpitStats;
  remindersEnabled: boolean;
}

export function FinancialStats({ stats, remindersEnabled }: FinancialStatsProps) {
  const currentMonth = format(new Date(), "MMMM yyyy");
  const collectedFormatted = `R${(stats.collectedMTD / 100).toLocaleString()}`;
  const outstandingFormatted = `R${(stats.outstandingMTD / 100).toLocaleString()}`;

  return (
    <>
      {/* Revenue grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="stat-label">{currentMonth} collected</div>
          <div className="stat-value" style={{ color: "var(--success)", marginTop: 4 }}>
            {collectedFormatted}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value" style={{
            color: stats.outstandingMTD > 0 ? "var(--warning)" : "var(--text)",
            marginTop: 4,
          }}>
            {outstandingFormatted}
          </div>
          {stats.outstandingFamilies > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {stats.outstandingFamilies} {stats.outstandingFamilies === 1 ? "family" : "families"}
            </div>
          )}
        </div>
      </div>

      {/* Capacity / staff grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="stat-label">Total capacity</div>
          <div className="stat-value" style={{ marginTop: 4 }}>{stats.totalCapacity}</div>
        </div>
        <div className="card">
          <div className="stat-label">Staff</div>
          <div className="stat-value" style={{ marginTop: 4 }}>{stats.staffCount}</div>
        </div>
      </div>

      {/* Actions alert */}
      {(stats.photoConsentPending > 0 || stats.outstandingFamilies > 0) && (
        <div className="card" style={{ borderLeft: "3px solid var(--warning)", background: "#fffbeb" }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14, color: "#92400e" }}>
            Actions needed
          </p>
          {stats.photoConsentPending > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>Photo consent pending</span>
              <span className="pill pill-amber">{stats.photoConsentPending} forms</span>
            </div>
          )}
          {stats.outstandingFamilies > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>Outstanding payments</span>
              <span className="pill pill-red">{stats.outstandingFamilies} families</span>
            </div>
          )}
          <button
            className="btn btn-secondary"
            style={{ width: "100%", fontSize: 13, marginTop: 4 }}
            disabled={!remindersEnabled}
            title={remindersEnabled ? undefined : "Coming soon — WhatsApp/email reminders not yet wired up"}
            onClick={() => toast("Fee reminder sending is coming soon.", { icon: "🔔" })}
          >
            <Bell size={14} />
            Send fee reminders
          </button>
        </div>
      )}
    </>
  );
}

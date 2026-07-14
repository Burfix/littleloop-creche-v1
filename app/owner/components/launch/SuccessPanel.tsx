"use client";

import { Baby, CreditCard, PartyPopper, Users, UserPlus } from "lucide-react";

interface SuccessPanelProps {
  schoolName: string;
  childCount: number;
  teacherCount: number;
  parentCount: number;
  billingActive: boolean;
  onOpenCockpit: () => void;
  onViewSummary: () => void;
}

// Shown exactly once, right after a school's required launch tasks (all the
// way through Go live) are complete — gated by AppUser.hasSeenLaunchSuccess.
// After the owner acknowledges it, they land on the normal operational
// dashboard from then on; the same recap stays reachable afterward via
// Settings -> School Launch Summary (app/owner/launch-summary), so nothing
// here is a one-time-only view of the data.
export function SuccessPanel({ schoolName, childCount, teacherCount, parentCount, billingActive, onOpenCockpit, onViewSummary }: SuccessPanelProps) {
  const stats = [
    { label: `${childCount} child${childCount === 1 ? "" : "ren"} imported`, Icon: Baby },
    { label: `${teacherCount} teacher${teacherCount === 1 ? "" : "s"} invited`, Icon: UserPlus },
    { label: `${parentCount} parent${parentCount === 1 ? "" : "s"} connected`, Icon: Users },
    { label: billingActive ? "Billing activated" : "Billing ready to activate", Icon: CreditCard },
  ];

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16, padding: "32px 20px" }}>
      <div
        style={{
          width: 56, height: 56, borderRadius: 16,
          background: "var(--brand-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <PartyPopper size={28} color="var(--success)" aria-hidden="true" />
      </div>

      <div>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>Your school is ready</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
          {schoolName} is now live on LittleLoop.
        </p>
      </div>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
        {stats.map(({ label, Icon }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: "1px solid var(--border)" }}>
            <Icon size={16} color="var(--brand)" aria-hidden="true" />
            <span style={{ fontSize: 14 }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={onOpenCockpit}>
          Open Owner Cockpit
        </button>
        <button
          type="button"
          onClick={onViewSummary}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, padding: "8px 0" }}
        >
          View launch summary
        </button>
      </div>
    </div>
  );
}

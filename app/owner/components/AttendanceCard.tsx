"use client";

import { format } from "date-fns";

interface AttendanceCardProps {
  checkedInToday: number;
  totalChildren: number;
}

export function AttendanceCard({ checkedInToday, totalChildren }: AttendanceCardProps) {
  const attendanceRate = Math.round((checkedInToday / Math.max(totalChildren, 1)) * 100);

  return (
    <div className="card" style={{ background: "var(--brand)", color: "white", border: "none" }}>
      <p style={{ margin: "0 0 4px", fontSize: 12, opacity: 0.8 }}>
        Today — {format(new Date(), "d MMMM")}
      </p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{checkedInToday}</span>
        <span style={{ fontSize: 20, opacity: 0.7, marginBottom: 4 }}>/ {totalChildren} children</span>
      </div>
      <div style={{ marginTop: 12, background: "rgba(255,255,255,0.2)", borderRadius: 99, height: 6 }}>
        <div style={{
          width: `${attendanceRate}%`,
          height: "100%",
          background: "white",
          borderRadius: 99,
          transition: "width 1s ease",
        }} />
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.8 }}>{attendanceRate}% attendance rate</p>
    </div>
  );
}

"use client";

import { Plus, Globe, Users } from "lucide-react";
import { format } from "date-fns";
import type { School } from "@/lib/types";

interface SchoolsTabProps {
  schools: School[];
  setupSent: boolean;
  onAddSchool: () => void;
  onSelectSchool: (school: School) => void;
}

export function SchoolsTab({ schools, setupSent, onAddSchool, onSelectSchool }: SchoolsTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="stat-label">Schools</div>
          <div className="stat-value" style={{ color: "var(--brand)", marginTop: 4 }}>{schools.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Total branches</div>
          <div className="stat-value" style={{ marginTop: 4 }}>
            {schools.reduce((sum, s) => sum + (s.branches?.length ?? 0), 0)}
          </div>
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: "100%" }} onClick={onAddSchool}>
        <Plus size={16} /> Add school
      </button>

      {setupSent && (
        <div className="card" style={{ borderLeft: "3px solid var(--success)", background: "#f0fdf4" }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#166534" }}>
            ✓ School created — setup email sent to owner
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#166534" }}>
            They&apos;ll receive an email to set their password and access their dashboard.
          </p>
        </div>
      )}

      <h3 style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700 }}>All schools</h3>

      {schools.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏫</div>
          <p style={{ fontSize: 14 }}>No schools yet. Add the first one.</p>
        </div>
      ) : schools.map(school => (
        <div key={school.id} className="card" style={{ cursor: "pointer" }} onClick={() => onSelectSchool(school)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15 }}>{school.name}</p>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                <Globe size={11} style={{ color: "var(--text-muted)" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{school.slug}.littleloop.app</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Users size={11} style={{ color: "var(--text-muted)" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {school.branches?.length ?? 0} branches
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              <span className={`pill ${
                school.plan === "enterprise" ? "pill-blue" :
                school.plan === "growth" ? "pill-green" : "pill-gray"
              }`} style={{ textTransform: "capitalize" }}>
                {school.plan}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {format(new Date(school.createdAt), "d MMM yyyy")}
              </span>
            </div>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--brand)" }}>Tap to invite users →</p>
        </div>
      ))}
    </div>
  );
}

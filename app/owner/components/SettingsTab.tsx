"use client";

import type { Child, School } from "@/lib/types";
import { InviteForm } from "./InviteForm";
import { PrivacyErasurePanel } from "./PrivacyErasurePanel";

interface SettingsTabProps {
  school: School;
  children: Child[];
  onRequestErasure: (child: Child) => Promise<void>;
  onPermanentErasure: (child: Child, confirmName: string) => Promise<void>;
  onSignOut: () => void;
}

export function SettingsTab({
  school,
  children,
  onRequestErasure,
  onPermanentErasure,
  onSignOut,
}: SettingsTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>School settings</h3>

      <div className="card">
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>
            School name
          </label>
          <p style={{ margin: 0, fontSize: 15 }}>{school.name}</p>
        </div>
        <div className="divider" />
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>
            Domain slug
          </label>
          <p style={{ margin: 0, fontSize: 15 }}>{school.slug}.littleloop.app</p>
        </div>
        <div className="divider" />
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>
            Plan
          </label>
          <span className="pill pill-blue" style={{ textTransform: "capitalize" }}>{school.plan}</span>
        </div>
      </div>

      {school.branches.length > 0 && (
        <div className="card">
          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Branches</h4>
          {school.branches.map(b => (
            <div key={b.id} style={{
              display: "flex", justifyContent: "space-between",
              padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14,
            }}>
              <span>{b.name}</span>
              {b.address && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{b.address}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>Invite staff or parents</h4>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
          They get a setup link to create their own password.
        </p>
        <InviteForm schoolId={school.id} schoolSlug={school.slug} />
      </div>

      <PrivacyErasurePanel
        childRecords={children}
        onRequestErasure={onRequestErasure}
        onPermanentErasure={onPermanentErasure}
      />

      <button className="btn btn-danger" style={{ width: "100%" }} onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}

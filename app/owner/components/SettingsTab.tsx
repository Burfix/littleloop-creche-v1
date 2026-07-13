"use client";

import type { Child, ClassRoom, School, AppUser } from "@/lib/types";
import { AddChildForm } from "./AddChildForm";
import { InviteForm } from "./InviteForm";
import { PrivacyErasurePanel } from "./PrivacyErasurePanel";
import { ClassesSection } from "./ClassesSection";

interface SettingsTabProps {
  school: School;
  enrolledChildren: Child[];
  teachers: AppUser[];
  onChildAdded: (child: Child) => void;
  onClassesChanged?: (classes: ClassRoom[]) => void;
  onInvited?: (role: "teacher" | "parent") => void;
  onRequestErasure: (child: Child) => Promise<void>;
  onPermanentErasure: (child: Child, confirmName: string) => Promise<void>;
  onSignOut: () => void;
}

export function SettingsTab({
  school,
  enrolledChildren,
  teachers,
  onChildAdded,
  onClassesChanged,
  onInvited,
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

      {(school.branches?.length ?? 0) > 0 && (
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

      <section className="card">
        <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>Add a child</h4>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
          Create the child record first. A default branch and class will be created automatically if needed.
        </p>
        <AddChildForm schoolId={school.id} onChildAdded={onChildAdded} />
      </section>

      <section className="card">
        <ClassesSection school={school} teachers={teachers} onClassesChange={onClassesChanged} />
      </section>

      <section className="card">
        <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>Invite teachers and parents</h4>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
          Parents can be linked to one or more children during invite.
        </p>
        <InviteForm schoolId={school.id} schoolSlug={school.slug} childRecords={enrolledChildren} onInvited={onInvited} />
      </section>

      <PrivacyErasurePanel
        childRecords={enrolledChildren}
        onRequestErasure={onRequestErasure}
        onPermanentErasure={onPermanentErasure}
      />

      <button className="btn btn-danger" style={{ width: "100%" }} onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}

// Light-touch extraction of the owner cockpit's top bar so it can be reused
// (e.g. on /owner/launch-summary) without duplicating the markup. Not a
// redesign — same padding/border/layout as the original inline header in
// app/owner/page.tsx.
export function PageHeader({ eyebrow, title, actions }: PageHeaderProps) {
  return (
    <div
      style={{
        padding: "16px 20px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{eyebrow}</p>}
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </h2>
      </div>
      {actions && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

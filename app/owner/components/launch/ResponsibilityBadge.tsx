"use client";

import { Building2, Handshake, School as SchoolIcon } from "lucide-react";
import type { LaunchResponsibility } from "@/lib/types";

const CONFIG: Record<LaunchResponsibility, { label: string; Icon: typeof SchoolIcon; bg: string; color: string }> = {
  school: { label: "School action", Icon: SchoolIcon, bg: "var(--brand-light)", color: "var(--brand-dark)" },
  littleloop: { label: "LittleLoop action", Icon: Building2, bg: "var(--surface-2)", color: "var(--text-muted)" },
  shared: { label: "We'll do this together", Icon: Handshake, bg: "#fef3c7", color: "#92400e" },
};

export function ResponsibilityBadge({ responsibility }: { responsibility: LaunchResponsibility }) {
  const cfg = CONFIG[responsibility];
  const Icon = cfg.Icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
      background: cfg.bg, color: cfg.color,
    }}>
      <Icon size={12} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

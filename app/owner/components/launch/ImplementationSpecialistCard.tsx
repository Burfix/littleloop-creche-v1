"use client";

import NextImage from "next/image";
import { Mail, MessageCircle } from "lucide-react";
import type { ImplementationSpecialist } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

interface ImplementationSpecialistCardProps {
  specialist: ImplementationSpecialist;
}

function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "27");
  return `https://wa.me/${digits}`;
}

// Never hardcodes a real person — callers pass typed data, and
// UNASSIGNED_SPECIALIST (lib/school-launch.ts) is the safe fallback when no
// one has been assigned yet.
export function ImplementationSpecialistCard({ specialist }: ImplementationSpecialistCardProps) {
  const isUnassigned = specialist.id === "unassigned";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionHeader title="Your implementation specialist" />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          className="avatar"
          style={{
            background: isUnassigned ? "var(--surface-2)" : "var(--brand-light)",
            color: isUnassigned ? "var(--text-muted)" : "var(--brand-dark)",
            overflow: "hidden",
          }}
        >
          {specialist.avatarUrl
            ? <NextImage src={specialist.avatarUrl} alt="" width={40} height={40} unoptimized style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : specialist.initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{specialist.name}</p>
          <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{specialist.role}</p>
        </div>
      </div>

      {isUnassigned ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          We&apos;ll introduce you to your specialist shortly.
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          {specialist.phone && (
            <a
              href={whatsappLink(specialist.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: 13, padding: "8px", textDecoration: "none" }}
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {specialist.email && (
            <a
              href={`mailto:${specialist.email}`}
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: 13, padding: "8px", textDecoration: "none" }}
            >
              <Mail size={14} /> Email
            </a>
          )}
        </div>
      )}

      {specialist.supportHours && (
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Available {specialist.supportHours}</p>
      )}
    </div>
  );
}

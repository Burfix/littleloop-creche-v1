"use client";

import { CalendarClock, Users2 } from "lucide-react";
import type { LaunchSession } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

// No fake calendar integration — this only ever shows what's actually
// stored on the school's SchoolLaunchRecord (set by LittleLoop staff for
// now). Absent session -> a calm "not yet scheduled" state, never a
// pretend booking.

const SESSION_LABELS: Record<LaunchSession["type"], string> = {
  school_setup_call: "School setup call",
  data_review: "Data review",
  teacher_training: "Teacher training",
  billing_review: "Billing review",
  go_live_check: "Go-live check",
};

const STATUS_COPY: Record<LaunchSession["status"], string> = {
  not_scheduled: "Not yet scheduled",
  scheduled: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

function formatSessionDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`;
}

interface LaunchSessionCardProps {
  session?: LaunchSession;
}

export function LaunchSessionCard({ session }: LaunchSessionCardProps) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionHeader title="Next session" />
      {!session ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          No session scheduled yet — your specialist will reach out to book one.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <CalendarClock size={18} color="var(--brand)" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{session.title || SESSION_LABELS[session.type]}</p>
              {session.scheduledAt && (
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                  {formatSessionDate(session.scheduledAt)}
                  {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
                </p>
              )}
              <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>{STATUS_COPY[session.status]}</p>
            </div>
          </div>

          {session.participants && session.participants.length > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
              <Users2 size={12} aria-hidden="true" /> {session.participants.join(", ")}
            </p>
          )}

          {session.meetingLink && session.status === "scheduled" && (
            <a
              href={session.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: 13, padding: "8px", textDecoration: "none" }}
            >
              Join meeting link
            </a>
          )}
        </>
      )}
    </div>
  );
}

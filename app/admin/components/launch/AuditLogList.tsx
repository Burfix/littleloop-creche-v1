"use client";

import type { LaunchAuditLogEntry } from "@/lib/types";

interface AuditLogListProps {
  entries: LaunchAuditLogEntry[];
  loading: boolean;
}

// Immutable, staff-only trail of every write to this school's launch
// record (see firestore.rules launchAuditLog/{entryId} — no owner ever
// sees this). Read-only by design: this list has no actions of its own.
export function AuditLogList({ entries, loading }: AuditLogListProps) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Audit log</h4>
      {loading && <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>}
      {!loading && entries.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No staff changes recorded yet.</p>
      )}
      {!loading && entries.map(entry => (
        <div key={entry.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <p style={{ margin: 0, fontSize: 13 }}>{entry.summary}</p>
          <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
            {entry.actorName} · {new Date(entry.createdAt).toLocaleString("en-ZA")}
          </p>
        </div>
      ))}
    </div>
  );
}

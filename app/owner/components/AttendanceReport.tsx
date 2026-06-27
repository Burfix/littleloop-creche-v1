"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ClassRoom, Child, DailyUpdate } from "@/lib/types";

const MOOD_LABEL: Record<string, string> = {
  "😊": "Happy",
  "😐": "Okay",
  "😢": "Sad",
  "😴": "Tired",
  "🤒": "Unwell",
};

interface AttendanceReportProps {
  classes: ClassRoom[];
  children: Child[];
  dailyUpdates: DailyUpdate[];
}

export function AttendanceReport({ classes, children, dailyUpdates }: AttendanceReportProps) {
  const [expanded, setExpanded] = useState(false);
  const [openClassId, setOpenClassId] = useState<string | null>(null);

  // Build lookups
  const updateByChildId = Object.fromEntries(dailyUpdates.map(u => [u.childId, u]));
  const childrenByClassId: Record<string, Child[]> = {};

  for (const child of children) {
    const cId = child.classId ?? "__unassigned__";
    if (!childrenByClassId[cId]) childrenByClassId[cId] = [];
    childrenByClassId[cId].push(child);
  }

  const allClassIds = [
    ...classes.map(c => c.id),
    ...(childrenByClassId["__unassigned__"] ? ["__unassigned__"] : []),
  ];

  const checkedInTotal = dailyUpdates.filter(u => u.checkedIn).length;
  const checkedOutTotal = dailyUpdates.filter(u => !!u.checkOutTime).length;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header — tap to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: "var(--text)",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            Today&apos;s roster — {format(new Date(), "d MMMM")}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            {checkedInTotal} checked in · {checkedOutTotal} checked out
          </p>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {allClassIds.map(classId => {
            const cls = classes.find(c => c.id === classId);
            const classChildren = childrenByClassId[classId] ?? [];
            const inClass = classChildren.filter(c => updateByChildId[c.id]?.checkedIn).length;
            const isOpen = openClassId === classId;

            return (
              <div key={classId}>
                <button
                  onClick={() => setOpenClassId(isOpen ? null : classId)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    width: "100%", background: "none", border: "none", cursor: "pointer",
                    padding: "8px 0", borderTop: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {cls ? cls.name : "Unassigned"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {inClass}/{classChildren.length}
                    </span>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {isOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingBottom: 8 }}>
                    {classChildren.length === 0 ? (
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
                        No children in this class yet.
                      </p>
                    ) : (
                      classChildren.map(child => {
                        const update = updateByChildId[child.id];
                        const isIn = update?.checkedIn;
                        const isOut = !!update?.checkOutTime;

                        return (
                          <div
                            key={child.id}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "8px 0", borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              {/* Status indicator */}
                              <div style={{
                                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                background: isOut ? "var(--text-muted)" : isIn ? "var(--success)" : "var(--border)",
                              }} />
                              <div>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                                  {child.firstName} {child.lastName}
                                </p>
                                {update?.checkInTime && (
                                  <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                                    In {update.checkInTime}
                                    {update.checkOutTime ? ` · Out ${update.checkOutTime}` : ""}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              {update?.mood && (
                                <span
                                  title={MOOD_LABEL[update.mood] ?? ""}
                                  style={{ fontSize: 16 }}
                                >
                                  {update.mood}
                                </span>
                              )}
                              <span className={`pill ${isOut ? "pill-gray" : isIn ? "pill-green" : "pill-gray"}`}
                                style={{ fontSize: 10 }}
                              >
                                {isOut ? "Left" : isIn ? "Present" : "Absent"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {allClassIds.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              No classes set up yet. Add classes in Settings.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

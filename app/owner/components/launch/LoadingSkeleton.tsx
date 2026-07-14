"use client";

export function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-busy="true" aria-label="Loading your launch workspace">
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="skeleton" style={{ height: 160 }} />
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="skeleton" style={{ height: 64 }} />
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="skeleton" style={{ height: 64 }} />
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    </div>
  );
}

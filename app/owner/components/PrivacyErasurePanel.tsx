"use client";

import React from "react";
import type { Child } from "@/lib/types";

interface PrivacyErasurePanelProps {
  childRecords: Child[];
  onRequestErasure: (child: Child) => Promise<void>;
  onPermanentErasure: (child: Child, confirmName: string) => Promise<void>;
}

export function PrivacyErasurePanel({
  childRecords,
  onRequestErasure,
  onPermanentErasure,
}: PrivacyErasurePanelProps) {
  const [confirmingChildId, setConfirmingChildId] = React.useState<string | null>(null);
  const [confirmName, setConfirmName] = React.useState("");
  const [savingChildId, setSavingChildId] = React.useState<string | null>(null);

  const handleRequest = async (child: Child) => {
    setSavingChildId(child.id);
    try {
      await onRequestErasure(child);
    } finally {
      setSavingChildId(null);
    }
  };

  const handlePermanentErasure = async (child: Child) => {
    setSavingChildId(child.id);
    try {
      await onPermanentErasure(child, confirmName.trim());
      setConfirmingChildId(null);
      setConfirmName("");
    } finally {
      setSavingChildId(null);
    }
  };

  return (
    <div className="card" style={{ borderLeft: "3px solid var(--danger)" }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>POPIA data erasure</h4>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
        Soft-delete first, then permanently erase child-linked updates, moments, invoices and messages after confirmation.
      </p>

      {childRecords.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No children found for this school.</p>
      ) : childRecords.map(child => {
        const fullName = `${child.firstName} ${child.lastName}`.trim();
        const isPending = child.deletionStatus === "pending_erasure";
        const isSaving = savingChildId === child.id;
        const isConfirming = confirmingChildId === child.id;

        return (
          <div
            key={child.id}
            style={{
              padding: "10px 0",
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{fullName}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  {isPending ? "Pending permanent erasure" : "Active child record"}
                </p>
              </div>
              <span className={`pill ${isPending ? "pill-red" : "pill-gray"}`}>
                {isPending ? "Pending" : "Active"}
              </span>
            </div>

            {!isPending ? (
              <button
                className="btn btn-secondary"
                style={{ width: "100%", fontSize: 13 }}
                disabled={isSaving}
                onClick={() => handleRequest(child)}
              >
                {isSaving ? <span className="spinner" /> : "Request erasure"}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {isConfirming && (
                  <input
                    className="input"
                    placeholder={`Type ${fullName} to confirm`}
                    value={confirmName}
                    onChange={event => setConfirmName(event.target.value)}
                  />
                )}
                <button
                  className="btn btn-danger"
                  style={{ width: "100%", fontSize: 13 }}
                  disabled={isSaving}
                  onClick={() => {
                    if (!isConfirming) {
                      setConfirmingChildId(child.id);
                      setConfirmName("");
                      return;
                    }
                    void handlePermanentErasure(child);
                  }}
                >
                  {isSaving ? <span className="spinner" /> : "Permanently erase data"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

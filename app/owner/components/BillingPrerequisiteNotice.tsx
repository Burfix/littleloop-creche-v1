"use client";

import { UserPlus } from "lucide-react";

interface BillingPrerequisiteNoticeProps {
  onPrimaryAction: () => void;
  primaryLabel?: string;
  onSecondaryAction?: () => void;
  secondaryLabel?: string;
}

// Shown instead of CreateInvoiceForm when the school has children but none
// are linked to a parent yet. Invoices are tied to a parent record, so
// letting the owner fill out the whole form only to fail on submit is a
// preventable dead end — this catches it before they start typing, in both
// the onboarding billing step and the regular Billing tab (see BillingTab.tsx
// and app/onboarding/billing/page.tsx for where the prerequisite check lives).
export function BillingPrerequisiteNotice({
  onPrimaryAction,
  primaryLabel = "Invite or connect parent",
  onSecondaryAction,
  secondaryLabel = "Skip for now",
}: BillingPrerequisiteNoticeProps) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Billing is almost ready</h4>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
        You have children in LittleLoop, but none have a linked parent yet.
        Connect a parent before creating the first invoice.
      </p>
      <button className="btn btn-primary" style={{ width: "100%" }} onClick={onPrimaryAction}>
        <UserPlus size={16} aria-hidden="true" /> {primaryLabel}
      </button>
      {onSecondaryAction && (
        <button
          style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, padding: "6px 0" }}
          onClick={onSecondaryAction}
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}

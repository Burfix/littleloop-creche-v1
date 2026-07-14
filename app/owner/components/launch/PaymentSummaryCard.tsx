"use client";

import { CircleCheck, CreditCard } from "lucide-react";
import type { SchoolLaunchPayment } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

const INCLUDED_SERVICES = [
  "School workspace configuration",
  "Data import and validation",
  "Class setup",
  "Teacher and parent invitations",
  "Billing configuration",
  "Team training",
  "Go-live support",
];

const STATUS_LABEL: Record<SchoolLaunchPayment["status"], string> = {
  unpaid: "Awaiting payment",
  invoiced: "Invoice sent",
  paid: "Paid",
  waived: "Waived",
};

function formatRand(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}

interface PaymentSummaryCardProps {
  payment: SchoolLaunchPayment;
}

// Payment enforcement is a config flag (ENFORCE_ONBOARDING_PAYMENT in
// lib/school-launch.ts), currently off — this card never blocks anything,
// it just shows status and a respectful action when unpaid.
export function PaymentSummaryCard({ payment }: PaymentSummaryCardProps) {
  const isSettled = payment.status === "paid" || payment.status === "waived";

  // Once paid, this shouldn't keep dominating the workspace — compact card.
  if (isSettled) {
    return (
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
        <CircleCheck size={18} color="var(--success)" aria-hidden="true" />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{payment.packageName}</p>
          <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
            {STATUS_LABEL[payment.status]}
            {payment.paymentReference ? ` · Ref ${payment.paymentReference}` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionHeader title={payment.packageName} />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 22, fontWeight: 700 }}>
          {payment.amountCents > 0 ? formatRand(payment.amountCents) : "Price to be confirmed"}
        </span>
        <span className="pill pill-amber">{STATUS_LABEL[payment.status]}</span>
      </div>

      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
        {INCLUDED_SERVICES.map(s => <li key={s}>{s}</li>)}
      </ul>

      {payment.invoiceReference && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Invoice ref {payment.invoiceReference}</p>
      )}

      <button className="btn btn-primary" style={{ width: "100%" }}>
        <CreditCard size={16} /> Complete School Launch payment
      </button>
    </div>
  );
}

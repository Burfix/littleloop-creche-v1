"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { OnboardingPaymentStatus, SchoolLaunchPayment } from "@/lib/types";
import { DEFAULT_LAUNCH_PACKAGE_NAME } from "@/lib/school-launch";
import { updatePayment, type AdminActor } from "@/lib/school-launch-admin";

interface PaymentEditorFormProps {
  schoolId: string;
  payment: SchoolLaunchPayment;
  actor: AdminActor;
  onSaved: () => void;
}

const STATUS_OPTIONS: OnboardingPaymentStatus[] = ["unpaid", "invoiced", "paid", "waived"];

export function PaymentEditorForm({ schoolId, payment, actor, onSaved }: PaymentEditorFormProps) {
  const [status, setStatus] = useState<OnboardingPaymentStatus>(payment.status);
  const [amountRand, setAmountRand] = useState(payment.amountCents > 0 ? String(payment.amountCents / 100) : "");
  const [invoiceReference, setInvoiceReference] = useState(payment.invoiceReference ?? "");
  const [paymentReference, setPaymentReference] = useState(payment.paymentReference ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const amountCents = amountRand.trim() ? Math.round(parseFloat(amountRand) * 100) : 0;
      await updatePayment(schoolId, {
        packageName: payment.packageName || DEFAULT_LAUNCH_PACKAGE_NAME,
        status,
        amountCents: Number.isFinite(amountCents) ? amountCents : 0,
        invoiceReference: invoiceReference.trim() || undefined,
        paymentReference: paymentReference.trim() || undefined,
        paidAt: payment.paidAt,
      }, actor);
      toast.success("Payment updated");
      onSaved();
    } catch {
      toast.error("Couldn't save — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{payment.packageName || DEFAULT_LAUNCH_PACKAGE_NAME}</h4>
      <select className="input" value={status} onChange={e => setStatus(e.target.value as OnboardingPaymentStatus)}>
        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <input className="input" placeholder="Amount (ZAR)" type="number" min="0" step="0.01" value={amountRand} onChange={e => setAmountRand(e.target.value)} />
      <input className="input" placeholder="Invoice reference" value={invoiceReference} onChange={e => setInvoiceReference(e.target.value)} />
      <input className="input" placeholder="Payment reference" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? <span className="spinner" /> : "Save payment status"}
      </button>
    </div>
  );
}

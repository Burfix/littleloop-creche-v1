"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { format, addDays } from "date-fns";
import { createInvoice } from "@/lib/db";
import type { Invoice, Child } from "@/lib/types";

interface CreateInvoiceFormProps {
  schoolId: string;
  // Named childRecords (not `children`) to avoid colliding with React's
  // reserved children prop — see InviteForm's childRecords for the same
  // convention already used elsewhere in this codebase.
  childRecords: Child[];
  onInvoiceCreated: (invoice: Invoice) => void;
}

// Extracted from BillingTab's inline create form so the invoice-creation
// logic (and the createInvoice call) lives in exactly one place — reused
// by BillingTab itself and by the Configure billing onboarding screen.
// Same validation, same API call, same shape as before extraction.
export function CreateInvoiceForm({ schoolId, childRecords, onInvoiceCreated }: CreateInvoiceFormProps) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    childId: childRecords[0]?.id ?? "",
    description: "Monthly school fees",
    amountCents: "",
    month: new Date().toISOString().slice(0, 7),
    dueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
  });

  const childMap = Object.fromEntries(childRecords.map(c => [c.id, c]));

  const handleCreate = async () => {
    const amount = Math.round(parseFloat(form.amountCents) * 100);
    if (!form.childId) { toast.error("Select a child"); return; }
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    const child = childMap[form.childId];
    if (!child) { toast.error("Child not found"); return; }
    const parentId = child.parentIds?.[0];
    if (!parentId) { toast.error("This child has no linked parent — invite the parent first"); return; }

    setCreating(true);
    try {
      const id = await createInvoice({
        schoolId,
        branchId: child.classId ?? "",
        parentId,
        childId: form.childId,
        month: form.month,
        amountCents: amount,
        status: "outstanding",
        dueDate: form.dueDate,
        lineItems: [{ description: form.description, amountCents: amount }],
      });
      const now = new Date().toISOString();
      onInvoiceCreated({
        id, schoolId, branchId: child.classId ?? "",
        parentId, childId: form.childId, month: form.month,
        amountCents: amount, status: "outstanding",
        dueDate: form.dueDate, createdAt: now,
        lineItems: [{ description: form.description, amountCents: amount }],
      });
      toast.success("Invoice created");
      setForm(f => ({ ...f, amountCents: "", description: "Monthly school fees" }));
    } catch {
      toast.error("Could not create invoice");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface-2)" }}>
      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>New invoice</p>
      <select
        className="input"
        value={form.childId}
        onChange={e => setForm(f => ({ ...f, childId: e.target.value }))}
      >
        <option value="">Select child…</option>
        {childRecords.map(c => (
          <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
        ))}
      </select>
      <input
        className="input"
        placeholder="Description e.g. Monthly school fees"
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Amount (R)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 2500"
            value={form.amountCents}
            onChange={e => setForm(f => ({ ...f, amountCents: e.target.value }))}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Month</label>
          <input
            className="input"
            type="month"
            value={form.month}
            onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Due date</label>
        <input
          className="input"
          type="date"
          value={form.dueDate}
          onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
        />
      </div>
      <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleCreate} disabled={creating}>
        {creating ? <span className="spinner" /> : "Create invoice"}
      </button>
    </div>
  );
}

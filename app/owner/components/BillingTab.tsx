"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { format, addDays } from "date-fns";
import { updateInvoiceStatus, createInvoice } from "@/lib/db";
import type { Invoice, Child, AppUser, School } from "@/lib/types";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { MessageCircle, Plus, X } from "lucide-react";

interface BillingTabProps {
  invoices: Invoice[];
  children: Child[];
  parents: AppUser[];
  school: School;
  invoiceCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMoreInvoices: boolean;
  loadingInvoices: boolean;
  onLoadMore: () => Promise<void>;
  onInvoiceUpdate: (updatedInvoice: Invoice) => void;
  onInvoiceCreated: (invoice: Invoice) => void;
}

function formatPhone(phone?: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").replace(/^0/, "27");
}

function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(message)}`;
}

function buildReminderMessage(
  parentName: string, childName: string,
  amountCents: number, month: string, schoolName: string
): string {
  const amount = `R${(amountCents / 100).toLocaleString()}`;
  const monthLabel = format(new Date(month + "-01"), "MMMM yyyy");
  return `Hi ${parentName},\n\nThis is a friendly reminder that ${childName}'s school fees of ${amount} for ${monthLabel} are currently outstanding at ${schoolName}.\n\nPlease make payment at your earliest convenience.\n\nThank you 🙏`;
}

const STATUS_PILL: Record<string, string> = {
  paid: "pill-green",
  outstanding: "pill-amber",
  overdue: "pill-red",
  draft: "pill-gray",
};

export function BillingTab({
  invoices, children, parents, school,
  hasMoreInvoices, loadingInvoices,
  onLoadMore, onInvoiceUpdate, onInvoiceCreated,
}: BillingTabProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    childId: children[0]?.id ?? "",
    description: "Monthly school fees",
    amountCents: "",
    month: new Date().toISOString().slice(0, 7),
    dueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
  });

  const childMap = Object.fromEntries(children.map(c => [c.id, c]));
  const parentMap = Object.fromEntries(parents.map(p => [p.uid, p]));

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthInvoices = invoices.filter(i => i.month === currentMonth);
  const olderInvoices = invoices.filter(i => i.month !== currentMonth);

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
        schoolId: school.id,
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
        id, schoolId: school.id, branchId: child.classId ?? "",
        parentId, childId: form.childId, month: form.month,
        amountCents: amount, status: "outstanding",
        dueDate: form.dueDate, createdAt: now,
        lineItems: [{ description: form.description, amountCents: amount }],
      });
      toast.success("Invoice created");
      setShowCreateForm(false);
      setForm(f => ({ ...f, amountCents: "", description: "Monthly school fees" }));
    } catch {
      toast.error("Could not create invoice");
    } finally {
      setCreating(false);
    }
  };

  const renderInvoice = (inv: Invoice) => {
    const child = childMap[inv.childId];
    const parent = parentMap[inv.parentId];
    const childName = child ? `${child.firstName} ${child.lastName}` : "Unknown child";
    const parentName = parent?.displayName ?? parent?.email ?? "Parent";
    const parentPhone = parent?.phone;
    const needsReminder = (inv.status === "outstanding" || inv.status === "overdue") && !!parentPhone;
    const message = needsReminder
      ? buildReminderMessage(parentName, childName, inv.amountCents, inv.month, school.name)
      : "";

    return (
      <div key={inv.id} className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 1px", fontWeight: 700, fontSize: 15 }}>{childName}</p>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--text-muted)" }}>{parentName}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              R{(inv.amountCents / 100).toLocaleString()}
            </p>
            {inv.dueDate && inv.status !== "paid" && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                Due {format(new Date(inv.dueDate), "d MMM yyyy")}
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <span className={`pill ${STATUS_PILL[inv.status] ?? "pill-gray"}`}>{inv.status}</span>
            {needsReminder && (
              <a
                href={whatsappLink(parentPhone!, message)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "#25D366", color: "#fff", textDecoration: "none",
                  fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 8,
                }}
              >
                <MessageCircle size={12} />
                Remind
              </a>
            )}
          </div>
        </div>

        {inv.proofUrl && inv.status !== "paid" && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-muted)" }}>
              Proof uploaded — verify payment
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, fontSize: 13, padding: "8px" }}
                onClick={async () => {
                  await updateInvoiceStatus(inv.id, "paid");
                  onInvoiceUpdate({ ...inv, status: "paid" });
                  toast.success("Marked as paid");
                }}
              >
                Confirm paid
              </button>
              <a
                href={inv.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: 13, padding: "8px", textDecoration: "none" }}
              >
                View proof
              </a>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          {format(new Date(), "MMMM yyyy")}
        </h3>
        <button
          className="btn btn-primary"
          style={{ fontSize: 13, padding: "8px 14px" }}
          onClick={() => setShowCreateForm(v => !v)}
        >
          {showCreateForm ? <X size={14} /> : <Plus size={14} />}
          {showCreateForm ? "Cancel" : "New invoice"}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface-2)" }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>New invoice</p>
          <select
            className="input"
            value={form.childId}
            onChange={e => setForm(f => ({ ...f, childId: e.target.value }))}
          >
            <option value="">Select child…</option>
            {children.map(c => (
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
      )}

      {currentMonthInvoices.length === 0 && !showCreateForm && (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No invoices this month yet. Tap "New invoice" to create one.</p>
      )}
      {currentMonthInvoices.map(renderInvoice)}

      {olderInvoices.length > 0 && (
        <>
          <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
            PREVIOUS MONTHS
          </p>
          {olderInvoices.map(renderInvoice)}
        </>
      )}

      {hasMoreInvoices && (
        <button
          className="btn btn-secondary"
          style={{ width: "100%", fontSize: 13 }}
          onClick={onLoadMore}
          disabled={loadingInvoices}
        >
          {loadingInvoices ? <span className="spinner" /> : "Load more"}
        </button>
      )}
    </div>
  );
}

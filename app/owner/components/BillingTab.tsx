"use client";

import toast from "react-hot-toast";
import { format } from "date-fns";
import { updateInvoiceStatus } from "@/lib/db";
import type { Invoice } from "@/lib/types";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

interface BillingTabProps {
  invoices: Invoice[];
  invoiceCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMoreInvoices: boolean;
  loadingInvoices: boolean;
  onLoadMore: () => Promise<void>;
  onInvoiceUpdate: (updatedInvoice: Invoice) => void;
}

export function BillingTab({
  invoices,
  hasMoreInvoices,
  loadingInvoices,
  onLoadMore,
  onInvoiceUpdate,
}: BillingTabProps) {
  const currentMonth = format(new Date(), "MMMM yyyy");
  const monthInvoices = invoices.filter(i => i.month === new Date().toISOString().slice(0, 7));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{currentMonth}</h3>
        <button className="btn btn-secondary" style={{ fontSize: 12, padding: "8px 12px" }}>
          Export PDF
        </button>
      </div>

      {monthInvoices.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No invoices this month yet.</p>
      ) : monthInvoices.map(inv => (
        <div key={inv.id} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14 }}>{inv.childId}</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                R{(inv.amountCents / 100).toLocaleString()}
              </p>
            </div>
            <span className={`pill ${
              inv.status === "paid" ? "pill-green" :
              inv.status === "overdue" ? "pill-red" : "pill-amber"
            }`}>
              {inv.status}
            </span>
          </div>

          {inv.proofUrl && inv.status !== "paid" && (
            <div style={{ marginTop: 10 }}>
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
                  style={{ flex: 1, fontSize: 13, padding: "8px" }}
                >
                  View proof
                </a>
              </div>
            </div>
          )}
        </div>
      ))}

      {hasMoreInvoices && (
        <button
          className="btn btn-secondary"
          style={{ width: "100%", fontSize: 13 }}
          onClick={onLoadMore}
          disabled={loadingInvoices}
        >
          {loadingInvoices ? <span className="spinner" /> : "Load more invoices"}
        </button>
      )}
    </div>
  );
}

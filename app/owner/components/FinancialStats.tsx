"use client";

import { MessageCircle } from "lucide-react";
import { format } from "date-fns";
import type { CockpitStats, Invoice, Child, AppUser } from "@/lib/types";

interface FinancialStatsProps {
  stats: CockpitStats;
  invoices: Invoice[];
  children: Child[];
  parents: AppUser[];
  schoolName: string;
}

function formatPhone(phone?: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").replace(/^0/, "27");
}

function buildReminderMessage(
  parentName: string, childName: string,
  amountCents: number, month: string, schoolName: string
): string {
  const amount = `R${(amountCents / 100).toLocaleString()}`;
  const monthLabel = format(new Date(month + "-01"), "MMMM yyyy");
  return `Hi ${parentName},\n\nThis is a friendly reminder that ${childName}'s school fees of ${amount} for ${monthLabel} are currently outstanding at ${schoolName}.\n\nPlease make payment at your earliest convenience.\n\nThank you 🙏`;
}

export function FinancialStats({ stats, invoices, children, parents, schoolName }: FinancialStatsProps) {
  const currentMonth = format(new Date(), "MMMM yyyy");
  const childMap = Object.fromEntries(children.map(c => [c.id, c]));
  const parentMap = Object.fromEntries(parents.map(p => [p.uid, p]));

  const outstandingWithPhone = invoices
    .filter(i => (i.status === "outstanding" || i.status === "overdue") && parentMap[i.parentId]?.phone)
    .map(i => {
      const child = childMap[i.childId];
      const parent = parentMap[i.parentId];
      const childName = child ? `${child.firstName} ${child.lastName}` : "your child";
      const parentName = parent?.displayName ?? parent?.email ?? "Parent";
      const phone = formatPhone(parent?.phone);
      const msg = buildReminderMessage(parentName, childName, i.amountCents, i.month, schoolName);
      return { phone, msg };
    });

  const handleSendAll = () => {
    outstandingWithPhone.forEach(({ phone, msg }) => {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    });
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="stat-label">{currentMonth} collected</div>
          <div className="stat-value" style={{ color: "var(--success)", marginTop: 4 }}>
            R{(stats.collectedMTD / 100).toLocaleString()}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value" style={{
            color: stats.outstandingMTD > 0 ? "var(--warning)" : "var(--text)", marginTop: 4,
          }}>
            R{(stats.outstandingMTD / 100).toLocaleString()}
          </div>
          {stats.outstandingFamilies > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {stats.outstandingFamilies} {stats.outstandingFamilies === 1 ? "family" : "families"}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="stat-label">Total capacity</div>
          <div className="stat-value" style={{ marginTop: 4 }}>{stats.totalCapacity}</div>
        </div>
        <div className="card">
          <div className="stat-label">Staff</div>
          <div className="stat-value" style={{ marginTop: 4 }}>{stats.staffCount}</div>
        </div>
      </div>

      {(stats.photoConsentPending > 0 || stats.outstandingFamilies > 0) && (
        <div className="card warning-card" style={{ borderLeft: "3px solid var(--warning)", background: "#fffbeb" }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14, color: "#92400e" }}>Actions needed</p>
          {stats.photoConsentPending > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>Photo consent pending</span>
              <span className="pill pill-amber">{stats.photoConsentPending} forms</span>
            </div>
          )}
          {stats.outstandingFamilies > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>Outstanding payments</span>
              <span className="pill pill-red">{stats.outstandingFamilies} families</span>
            </div>
          )}
          {outstandingWithPhone.length > 0 ? (
            <button
              className="btn"
              style={{ width: "100%", fontSize: 13, background: "#25D366", color: "#fff" }}
              onClick={handleSendAll}
            >
              <MessageCircle size={14} />
              Send WhatsApp reminders ({outstandingWithPhone.length})
            </button>
          ) : stats.outstandingFamilies > 0 ? (
            <p style={{ margin: 0, fontSize: 12 }}>
              Add phone numbers to parent profiles to enable WhatsApp reminders.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}

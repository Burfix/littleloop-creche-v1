"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import {
  getChildrenForParent, getDailyUpdateForChild,
  getMomentsForChild, getInvoicesForParent,
  subscribeToThread, sendMessage,
} from "@/lib/db";
import type { Child, DailyUpdate, Moment, Invoice, Message } from "@/lib/types";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Home, Image, CreditCard, MessageCircle, LogOut } from "lucide-react";

type Tab = "home" | "moments" | "billing" | "chat";

const MOOD_LABELS: Record<string, string> = {
  "😊": "Happy", "😐": "Okay", "😢": "Upset", "😴": "Tired", "🤒": "Unwell",
};

export default function ParentDashboard() {
  const { appUser, signOut } = useAuth();
  const { school } = useSchool();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("home");
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [update, setUpdate] = useState<DailyUpdate | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "parent") { router.replace("/"); return; }

    getChildrenForParent(appUser.uid).then(c => {
      setChildren(c);
      if (c.length > 0) setSelectedChild(c[0]);
      setLoading(false);
    });
  }, [appUser, router]);

  useEffect(() => {
    if (!selectedChild) return;
    const today = new Date().toISOString().split("T")[0];
    getDailyUpdateForChild(selectedChild.id, today).then(setUpdate);
    getMomentsForChild(selectedChild.id).then(setMoments);
  }, [selectedChild]);

  useEffect(() => {
    if (!appUser) return;
    getInvoicesForParent(appUser.uid).then(setInvoices);
  }, [appUser]);

  useEffect(() => {
    if (!appUser || !selectedChild) return;
    const threadId = `${appUser.uid}_${selectedChild.id}`;
    const unsub = subscribeToThread(threadId, setMessages);
    return unsub;
  }, [appUser, selectedChild]);

  const handleSend = async () => {
    if (!newMsg.trim() || !appUser || !selectedChild) return;
    const threadId = `${appUser.uid}_${selectedChild.id}`;
    await sendMessage({
      schoolId: school?.id ?? "",
      threadId,
      senderId: appUser.uid,
      senderRole: "parent",
      text: newMsg.trim(),
      read: false,
    });
    setNewMsg("");
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  if (!appUser || loading) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  const today = format(new Date(), "EEEE, d MMMM");
  const outstanding = invoices.find(i => i.status === "outstanding" || i.status === "overdue");

  return (
    <div className="app-shell">
      {/* Header */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{today}</p>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {school?.name ?? "LittleLoop"}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {children.length > 1 && (
            <select
              value={selectedChild?.id ?? ""}
              onChange={e => setSelectedChild(children.find(c => c.id === e.target.value) ?? null)}
              style={{ fontSize: 13, border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px" }}
            >
              {children.map(c => (
                <option key={c.id} value={c.id}>{c.firstName}</option>
              ))}
            </select>
          )}
          <button onClick={handleSignOut} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="page-content" style={{ padding: "16px 20px" }}>

        {/* ── HOME TAB ── */}
        {tab === "home" && selectedChild && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Child status card */}
            <div className="card" style={{ background: "var(--brand)", color: "white", border: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="avatar" style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: 20 }}>
                  {selectedChild.avatarUrl
                    ? <img src={selectedChild.avatarUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%" }} />
                    : selectedChild.firstName[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Today's update</p>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    {selectedChild.firstName} {update?.checkedIn ? "is in care ✓" : "not yet checked in"}
                  </h3>
                </div>
              </div>

              {update && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22 }}>{update.mood ?? "—"}</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>{update.mood ? MOOD_LABELS[update.mood] : "Mood"}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {update.napMinutes ? `${update.napMinutes}m` : "—"}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Nap</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {update.meals.length > 0 ? update.meals.filter(m => m.eaten !== "none").length : "—"}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Meals eaten</div>
                  </div>
                </div>
              )}

              {!update && (
                <p style={{ margin: "12px 0 0", fontSize: 13, opacity: 0.8 }}>
                  No update yet today — check back after morning circle.
                </p>
              )}
            </div>

            {/* Meal details */}
            {update?.meals && update.meals.length > 0 && (
              <div className="card">
                <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Meals today</h4>
                {update.meals.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>{m.name}</span>
                    <span className={`pill ${m.eaten === "all" ? "pill-green" : m.eaten === "some" ? "pill-amber" : "pill-gray"}`}>
                      {m.eaten === "all" ? "All eaten" : m.eaten === "some" ? "Partly eaten" : "Not eaten"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Activities */}
            {update?.activities && update.activities.length > 0 && (
              <div className="card">
                <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Activities today</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {update.activities.map((a, i) => (
                    <span key={i} className="pill pill-blue">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Teacher note */}
            {update?.notes && (
              <div className="card" style={{ borderLeft: "3px solid var(--brand)" }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Teacher note</p>
                <p style={{ margin: 0, fontSize: 14 }}>{update.notes}</p>
              </div>
            )}

            {/* Outstanding invoice alert */}
            {outstanding && (
              <div className="card" style={{ borderLeft: "3px solid var(--warning)", background: "#fffbeb" }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#92400e" }}>
                  Payment outstanding
                </p>
                <p style={{ margin: "0 0 8px", fontSize: 14, color: "#78350f" }}>
                  R{(outstanding.amountCents / 100).toLocaleString()} due {format(new Date(outstanding.dueDate), "d MMM")}
                </p>
                <button className="btn btn-secondary" style={{ fontSize: 13, padding: "8px 14px" }} onClick={() => setTab("billing")}>
                  View invoice
                </button>
              </div>
            )}

            {/* POPIA notice */}
            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
              🔒 Updates visible only to approved guardians · POPIA compliant
            </p>
          </div>
        )}

        {/* ── MOMENTS TAB ── */}
        {tab === "moments" && (
          <div>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>
              {selectedChild?.firstName}'s moments
            </h3>
            {moments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
                <p style={{ fontSize: 14 }}>No moments shared yet</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {moments.map(m => (
                  <div key={m.id} style={{ borderRadius: 10, overflow: "hidden", position: "relative" }}>
                    <img
                      src={m.mediaUrl}
                      alt={m.caption ?? ""}
                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                    />
                    {m.caption && (
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                        padding: "16px 8px 8px", color: "white", fontSize: 11,
                      }}>
                        {m.caption}
                      </div>
                    )}
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                      {format(new Date(m.createdAt), "d MMM")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BILLING TAB ── */}
        {tab === "billing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Billing</h3>
            {invoices.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No invoices yet.</p>
            ) : invoices.map(inv => (
              <div key={inv.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
                      {format(new Date(inv.month + "-01"), "MMMM yyyy")}
                    </p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                      R{(inv.amountCents / 100).toLocaleString()}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      Due {format(new Date(inv.dueDate), "d MMMM yyyy")}
                    </p>
                  </div>
                  <span className={`pill ${
                    inv.status === "paid" ? "pill-green" :
                    inv.status === "overdue" ? "pill-red" : "pill-amber"
                  }`}>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </span>
                </div>

                {inv.lineItems && inv.lineItems.length > 0 && (
                  <>
                    <div className="divider" />
                    {inv.lineItems.map((li, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span>{li.description}</span>
                        <span>R{(li.amountCents / 100).toLocaleString()}</span>
                      </div>
                    ))}
                  </>
                )}

                {(inv.status === "outstanding" || inv.status === "overdue") && (
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 12, fontSize: 14 }}>
                    Upload proof of payment
                  </button>
                )}
                {inv.status === "paid" && inv.paidAt && (
                  <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--success)" }}>
                    ✓ Paid {format(new Date(inv.paidAt), "d MMM yyyy")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 180px)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>
              Chat with {selectedChild?.firstName}'s teacher
            </h3>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", marginTop: 40 }}>
                  No messages yet. Say hello!
                </p>
              )}
              {messages.map(m => (
                <div key={m.id} style={{
                  alignSelf: m.senderId === appUser?.uid ? "flex-end" : "flex-start",
                  background: m.senderId === appUser?.uid ? "var(--brand)" : "var(--surface-2)",
                  color: m.senderId === appUser?.uid ? "white" : "var(--text)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  maxWidth: "80%",
                  fontSize: 14,
                }}>
                  <p style={{ margin: 0 }}>{m.text}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 10, opacity: 0.7 }}>
                    {format(new Date(m.createdAt), "HH:mm")}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, paddingBottom: 80 }}>
              <input
                className="input"
                placeholder="Type a message…"
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleSend} style={{ padding: "12px 18px" }}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {([
          { id: "home", Icon: Home, label: "Home" },
          { id: "moments", Icon: Image, label: "Moments" },
          { id: "billing", Icon: CreditCard, label: "Billing" },
          { id: "chat", Icon: MessageCircle, label: "Chat" },
        ] as const).map(({ id, Icon, label }) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

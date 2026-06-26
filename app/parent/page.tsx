"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import {
  getChildrenForParent, getDailyUpdateForChild,
  getMomentsForChild, getInvoicesForParent,
  getClassRoom, subscribeToThread, sendMessage, updateInvoiceProof, markThreadMessagesRead,
} from "@/lib/db";
import { storage } from "@/lib/firebase";
import type { Child, DailyUpdate, Moment, Invoice, Message } from "@/lib/types";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Home, Image, CreditCard, MessageCircle, LogOut, RefreshCw } from "lucide-react";

type Tab = "home" | "moments" | "billing" | "chat";

const AVATAR_PALETTE = [
  { bg: "#fce7f3", text: "#9d174d" },
  { bg: "#dbeafe", text: "#1e40af" },
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#ede9fe", text: "#4c1d95" },
  { bg: "#fee2e2", text: "#991b1b" },
  { bg: "#ccfbf1", text: "#0f766e" },
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

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
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatLastOpened, setChatLastOpened] = useState(0);

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
    let cancelled = false;
    const today = new Date().toISOString().split("T")[0];
    getDailyUpdateForChild(selectedChild.id, today).then(setUpdate);
    getMomentsForChild(selectedChild.id).then(setMoments);
    getClassRoom(selectedChild.classId)
      .then(classRoom => {
        if (cancelled) return;
        const teacherId = classRoom?.schoolId === selectedChild.schoolId
          ? classRoom.teacherIds[0] ?? null
          : null;
        setSelectedTeacherId(teacherId);
        setMessages([]);
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedTeacherId(null);
          setMessages([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedChild]);

  useEffect(() => {
    if (!appUser) return;
    getInvoicesForParent(appUser.uid).then(setInvoices);
  }, [appUser]);

  useEffect(() => {
    if (!appUser || !selectedChild || !selectedTeacherId) {
      return;
    }
    const threadId = `${selectedTeacherId}_${appUser.uid}_${selectedChild.id}`;
    const unsub = subscribeToThread(threadId, setMessages);
    return unsub;
  }, [appUser, selectedChild, selectedTeacherId]);

  const handleSend = async () => {
    if (!newMsg.trim() || !appUser || !selectedChild) return;
    if (!selectedTeacherId) {
      toast.error("No teacher assigned for this child yet");
      return;
    }
    const threadId = `${selectedTeacherId}_${appUser.uid}_${selectedChild.id}`;
    await sendMessage({
      schoolId: selectedChild.schoolId,
      childId: selectedChild.id,
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

  const handleRefresh = async () => {
    if (!selectedChild || refreshing) return;
    setRefreshing(true);
    const today = new Date().toISOString().split("T")[0];
    const [upd, moms] = await Promise.all([
      getDailyUpdateForChild(selectedChild.id, today),
      getMomentsForChild(selectedChild.id),
    ]);
    setUpdate(upd);
    setMoments(moms);
    setRefreshing(false);
  };

  const handleProofUpload = async (invoice: Invoice, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    if (!file.type.match(/^(image\/.*|application\/pdf)$/)) {
      toast.error("Upload an image or PDF proof");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Proof must be smaller than 5MB");
      return;
    }

    setUploadingInvoiceId(invoice.id);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `schools/${invoice.schoolId}/proofs/${invoice.id}/${file.lastModified}_${safeName}`;
      const ref = storageRef(storage, path);
      const snap = await uploadBytes(ref, file);
      const proofUrl = await getDownloadURL(snap.ref);

      await updateInvoiceProof(invoice.id, proofUrl);
      setInvoices(prev => prev.map(item => item.id === invoice.id ? { ...item, proofUrl } : item));
      toast.success("Proof uploaded");
    } catch (err) {
      console.error("Payment proof upload failed:", err);
      toast.error("Could not upload proof");
    } finally {
      setUploadingInvoiceId(null);
    }
  };

  if (!appUser || loading) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  const today = format(new Date(), "EEEE, d MMMM");
  const outstanding = invoices.find(i => i.status === "outstanding" || i.status === "overdue");
  const firstName = appUser.displayName?.split(" ")[0] ?? "there";
  const greeting = timeGreeting();
  const unreadCount = messages.filter(
    m => m.senderId !== appUser.uid && new Date(m.createdAt).getTime() > chatLastOpened
  ).length;

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
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{greeting}, {firstName}</h2>
          {school?.name && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{school.name}</p>
          )}
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
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
            aria-label="Refresh"
          >
            <RefreshCw size={17} style={{ transition: "transform 0.5s", transform: refreshing ? "rotate(360deg)" : "none" }} />
          </button>
          <button onClick={handleSignOut} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="page-content" style={{ padding: "16px 20px" }}>

        {/* ── EMPTY STATE ── */}
        {children.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>👶</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>No children linked yet</h3>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Ask your school to link your account to your child&apos;s profile.
              Once they do, daily updates will appear here.
            </p>
          </div>
        )}

        {/* ── HOME TAB ── */}
        {tab === "home" && selectedChild && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Child status card */}
            <div className="card" style={{ background: "var(--brand)", color: "white", border: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="avatar" style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: 20, overflow: "hidden" }}>
                  {selectedChild.avatarUrl
                    ? (
                        <NextImage
                          src={selectedChild.avatarUrl}
                          alt=""
                          width={40}
                          height={40}
                          unoptimized
                          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                        />
                      )
                    : selectedChild.firstName[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Today&apos;s update</p>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    {selectedChild.firstName}{" "}
                    {update?.checkOutTime
                      ? `went home at ${format(new Date(update.checkOutTime), "HH:mm")}`
                      : update?.checkedIn
                        ? "is in care ✓"
                        : "not yet checked in"}
                  </h3>
                  {update?.checkInTime && (
                    <p style={{ margin: "3px 0 0", fontSize: 12, opacity: 0.75 }}>
                      Arrived {format(new Date(update.checkInTime), "HH:mm")}
                      {update.checkOutTime && ` · Left ${format(new Date(update.checkOutTime), "HH:mm")}`}
                    </p>
                  )}
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              {selectedChild && (() => {
                const col = avatarColor(selectedChild.firstName);
                return (
                  <div className="avatar" style={{ background: col.bg, color: col.text, fontSize: 16, flexShrink: 0 }}>
                    {selectedChild.avatarUrl
                      ? <NextImage src={selectedChild.avatarUrl} alt="" width={36} height={36} unoptimized style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                      : selectedChild.firstName[0]}
                  </div>
                );
              })()}
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {selectedChild?.firstName}&apos;s moments
              </h3>
            </div>
            {moments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
                <p style={{ fontSize: 14 }}>No moments shared yet</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {moments.map(m => (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ borderRadius: 10, overflow: "hidden", position: "relative", aspectRatio: "1" }}>
                      <NextImage
                        src={m.mediaUrl}
                        alt={m.caption ?? ""}
                        fill
                        unoptimized
                        sizes="50vw"
                        style={{ objectFit: "cover" }}
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
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
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
                  <>
                    <label className="btn btn-primary" style={{ width: "100%", marginTop: 12, fontSize: 14, cursor: "pointer" }}>
                      {uploadingInvoiceId === inv.id ? <span className="spinner" /> : "Upload proof of payment"}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        disabled={uploadingInvoiceId === inv.id}
                        style={{ display: "none" }}
                        onChange={event => handleProofUpload(inv, event.target.files)}
                      />
                    </label>
                    {inv.proofUrl && (
                      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--success)" }}>
                        ✓ Proof uploaded. The school will verify payment.
                      </p>
                    )}
                  </>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              {selectedChild && (() => {
                const col = avatarColor(selectedChild.firstName);
                return (
                  <div className="avatar" style={{ background: col.bg, color: col.text, fontSize: 15, flexShrink: 0 }}>
                    {selectedChild.firstName[0]}
                  </div>
                );
              })()}
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Chat with {selectedChild?.firstName}&apos;s teacher
              </h3>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", marginTop: 40 }}>
                  {selectedTeacherId ? "No messages yet. Say hello!" : "No teacher assigned for this child yet."}
                </p>
              )}
              {messages.map((m, i) => {
                const isMine = m.senderId === appUser?.uid;
                // Show "Seen" only under the last message I sent that has been read
                const isLastMine = isMine && messages.slice(i + 1).every(next => next.senderId === appUser?.uid);
                return (
                  <div key={m.id} style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                    <div style={{
                      background: isMine ? "var(--brand)" : "var(--surface-2)",
                      color: isMine ? "white" : "var(--text)",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontSize: 14,
                    }}>
                      <p style={{ margin: 0 }}>{m.text}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 10, opacity: 0.7 }}>
                        {format(new Date(m.createdAt), "HH:mm")}
                      </p>
                    </div>
                    {isMine && isLastMine && m.read && (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                        Seen ✓
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, paddingBottom: "max(80px, calc(64px + env(safe-area-inset-bottom)))" }}>
              <input
                className="input"
                placeholder="Type a message…"
                value={newMsg}
                disabled={!selectedTeacherId}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={!selectedTeacherId}
                style={{ padding: "12px 18px" }}
              >
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
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              if (id === "chat") {
                setChatLastOpened(Date.now());
                if (appUser && selectedTeacherId && selectedChild) {
                  const threadId = `${selectedTeacherId}_${appUser.uid}_${selectedChild.id}`;
                  markThreadMessagesRead(threadId, appUser.uid).catch(() => null);
                }
              }
            }}
          >
            <div style={{ position: "relative", display: "inline-flex" }}>
              <Icon size={20} />
              {id === "chat" && unreadCount > 0 && tab !== "chat" && (
                <span style={{
                  position: "absolute", top: -5, right: -7,
                  background: "var(--error, #ef4444)", color: "white",
                  borderRadius: "50%", fontSize: 10, fontWeight: 700,
                  width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center",
                  lineHeight: 1,
                }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

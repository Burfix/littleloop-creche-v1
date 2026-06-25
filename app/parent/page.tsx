"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import {
  getChildrenForParent, getDailyUpdateForChild,
  getMomentsForChild, getInvoicesForParent,
  subscribeToThread, sendMessage, updateInvoiceProof,
} from "@/lib/db";
import { storage } from "@/lib/firebase";
import type { Child, DailyUpdate, Moment, Invoice, Message, MedicalRecord } from "@/lib/types";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Home, Image, CreditCard, MessageCircle, LogOut, Stethoscope } from "lucide-react";

type Tab = "home" | "moments" | "billing" | "chat" | "medical";

const MOOD_LABELS: Record<string, string> = {
  "😊": "Happy", "😐": "Okay", "😢": "Upset", "😴": "Tired", "🤒": "Unwell",
};

export default function ParentDashboard() {
  const { appUser, firebaseUser, signOut } = useAuth();
  const { school } = useSchool();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("home");
  const [medRecord, setMedRecord] = useState<MedicalRecord | null>(null);
  const [medLoading, setMedLoading] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [update, setUpdate] = useState<DailyUpdate | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<string | null>(null);
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
                    ? (
                        <NextImage
                          src={selectedChild.avatarUrl}
                          alt=""
                          width={40}
                          height={40}
                          unoptimized
                          style={{ width: "100%", height: "100%", borderRadius: "50%" }}
                        />
                      )
                    : selectedChild.firstName[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Today&apos;s update</p>
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
              {selectedChild?.firstName}&apos;s moments
            </h3>
            {moments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
                <p style={{ fontSize: 14 }}>No moments shared yet</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {moments.map(m => (
                  <div key={m.id} style={{ borderRadius: 10, overflow: "hidden", position: "relative", aspectRatio: "1" }}>
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
        {tab === "medical" && selectedChild && (
          <ParentMedicalView childId={selectedChild.id} firebaseUser={firebaseUser} />
        )}

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
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>
              Chat with {selectedChild?.firstName}&apos;s teacher
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
          { id: "medical", Icon: Stethoscope, label: "Medical" },
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

// ─── Parent Medical View (read-only) ─────────────────────────────────────────

import type { User } from "firebase/auth";

function ParentMedicalView({ childId, firebaseUser }: { childId: string; firebaseUser: User | null }) {
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    firebaseUser.getIdToken().then(token =>
      fetch(`/api/children/${childId}/medical`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).then(r => r.json())
      .then(({ data }) => setRecord(data))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [childId, firebaseUser]);

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>;

  if (!record) return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
      <p style={{ fontSize: 32, marginBottom: 8 }}>🏥</p>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>No medical record yet</p>
      <p style={{ fontSize: 13 }}>Your school will add your child's medical information here. Please contact them directly if you need to provide allergy or medication details urgently.</p>
    </div>
  );

  const SEVERITY_COLOR: Record<string, string> = {
    anaphylactic: "#dc2626", severe: "#ea580c", moderate: "#d97706", mild: "#65a30d",
  };
  const row = { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" } as React.CSSProperties;
  const sectionStyle = { borderRadius: 12, border: "1px solid var(--border)", padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 4 } as React.CSSProperties;
  const sectionTitle = { fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" } as React.CSSProperties;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Medical Record</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Managed by your school. Contact them to make changes.</p>

      {/* Allergies */}
      {record.allergies.length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitle}>Allergies</p>
          {record.allergies.map((a, i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ background: SEVERITY_COLOR[a.severity] ?? "#999", color: "#fff", borderRadius: 4, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>{a.severity.toUpperCase()}</span>
                <strong style={{ fontSize: 14 }}>{a.name}</strong>
              </div>
              {a.reaction && <p style={{ margin: "2px 0", fontSize: 13, color: "var(--text-muted)" }}>Reaction: {a.reaction}</p>}
              {a.treatment && <p style={{ margin: "2px 0", fontSize: 13, color: "#dc2626", fontWeight: 500 }}>Treatment: {a.treatment}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Medications */}
      {record.medications.length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitle}>Medications at School</p>
          {record.medications.map((m, i) => (
            <div key={i} style={row}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{m.name}</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{m.dose} · {m.frequency}</p>
                {m.instructions && <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{m.instructions}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conditions */}
      {record.conditions.length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitle}>Medical Conditions</p>
          {record.conditions.map((c, i) => (
            <div key={i} style={row}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{c.name}</p>
                {c.notes && <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{c.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dietary */}
      {(() => {
        const flags = (["vegetarian","vegan","halal","kosher","glutenFree","dairyFree"] as const).filter(k => record.dietary?.[k]);
        if (!flags.length && !record.dietary?.other) return null;
        return (
          <div style={sectionStyle}>
            <p style={sectionTitle}>Dietary Requirements</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {flags.map(f => (
                <span key={f} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 20, fontSize: 13, padding: "4px 10px" }}>
                  {f === "glutenFree" ? "Gluten-free" : f === "dairyFree" ? "Dairy-free" : f.charAt(0).toUpperCase() + f.slice(1)}
                </span>
              ))}
            </div>
            {record.dietary?.other && <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{record.dietary.other}</p>}
          </div>
        );
      })()}

      {/* Emergency contacts */}
      {record.emergencyContacts.length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitle}>Emergency Contacts</p>
          {record.emergencyContacts.map((ec, i) => (
            <div key={i} style={row}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{ec.name} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>· {ec.relationship}</span></p>
                <a href={`tel:${ec.phone}`} style={{ fontSize: 13, color: "var(--primary)" }}>{ec.phone}</a>
              </div>
              {ec.canPickup && <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", borderRadius: 20, padding: "2px 8px", alignSelf: "center" }}>PICKUP</span>}
            </div>
          ))}
        </div>
      )}

      {/* Doctor & Medical aid */}
      {(record.doctorName || record.medicalAidProvider) && (
        <div style={sectionStyle}>
          {record.doctorName && (
            <>
              <p style={sectionTitle}>Doctor</p>
              <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14 }}>{record.doctorName}</p>
              {record.doctorPractice && <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{record.doctorPractice}</p>}
              {record.doctorPhone && <a href={`tel:${record.doctorPhone}`} style={{ fontSize: 13, color: "var(--primary)" }}>{record.doctorPhone}</a>}
            </>
          )}
          {record.medicalAidProvider && (
            <>
              <p style={{ ...sectionTitle, marginTop: 12 }}>Medical Aid</p>
              <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14 }}>{record.medicalAidProvider}</p>
              {record.medicalAidNumber && <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Member: {record.medicalAidNumber}{record.medicalAidDependantCode ? ` · Dep: ${record.medicalAidDependantCode}` : ""}</p>}
            </>
          )}
        </div>
      )}

      {record.notes && (
        <div style={sectionStyle}>
          <p style={sectionTitle}>Additional Notes</p>
          <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>{record.notes}</p>
        </div>
      )}
    </div>
  );
}

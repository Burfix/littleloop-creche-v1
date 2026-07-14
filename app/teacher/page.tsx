"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import {
  getClassesForTeacher, getChildrenForClass,
  getDailyUpdatesForClass, upsertDailyUpdate,
  getTasksForClass, toggleTask, addTask,
} from "@/lib/db";
import { storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { addMoment } from "@/lib/db";
import type { ClassRoom, Child, DailyUpdate, Task, MoodEmoji } from "@/lib/types";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Users, Camera, CheckSquare, LogOut, MessageSquare, ChevronLeft, Send, CameraOff } from "lucide-react";
import { sendMessage, subscribeToThread, getLastMessageForThread } from "@/lib/db";
import type { Message } from "@/lib/types";

type Tab = "checkin" | "moments" | "tasks" | "messages";

interface ThreadTarget {
  childId: string;
  parentId: string;
  threadId: string;
  childName: string;
}
const MOODS: MoodEmoji[] = ["😊", "😐", "😢", "😴", "🤒"];

export default function TeacherDashboard() {
  const { appUser, firebaseUser, signOut } = useAuth();
  const { school } = useSchool();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("checkin");
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedMomentChildId, setSelectedMomentChildId] = useState("");
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Messages tab
  const [selectedThread, setSelectedThread] = useState<ThreadTarget | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [threadPreviews, setThreadPreviews] = useState<Record<string, Message | null>>({});

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "teacher") { router.replace("/"); return; }
    getClassesForTeacher(appUser.uid).then(c => {
      setClasses(c);
      if (c.length > 0) setSelectedClass(c[0]);
    });
  }, [appUser, router]);

  useEffect(() => {
    if (!selectedClass || !school) return;
    getChildrenForClass(school.id, selectedClass.id).then(c => {
      setChildren(c);
      setSelectedMomentChildId(prev => c.some(child => child.id === prev) ? prev : c[0]?.id ?? "");
    });
    getDailyUpdatesForClass(school.id, selectedClass.id, today).then(setUpdates);
    getTasksForClass(school.id, selectedClass.id).then(setTasks);
  }, [selectedClass, school, today]);

  // Subscribe to active thread in real-time
  useEffect(() => {
    if (!selectedThread) return;
    const unsub = subscribeToThread(selectedThread.threadId, msgs => {
      setThreadMessages(msgs);
      // Update preview for this thread live
      const last = msgs[msgs.length - 1] ?? null;
      setThreadPreviews(prev => ({ ...prev, [selectedThread.threadId]: last }));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return unsub;
  }, [selectedThread]);

  // Load thread previews (last message per child) when messages tab is opened
  useEffect(() => {
    if (tab !== "messages" || !appUser || selectedThread) return;
    const contactChildren = children.filter(c => c.parentIds?.length > 0);
    if (contactChildren.length === 0) return;

    Promise.all(
      contactChildren.map(child => {
        const parentId = child.parentIds[0];
        const threadId = `${appUser.uid}_${parentId}_${child.id}`;
        return getLastMessageForThread(threadId).then(msg => ({ threadId, msg }));
      })
    ).then(results => {
      const map: Record<string, Message | null> = {};
      results.forEach(({ threadId, msg }) => { map[threadId] = msg; });
      setThreadPreviews(map);
    }).catch(() => null);
  }, [tab, children, appUser, selectedThread]);

  const handleSend = async () => {
    if (!draft.trim() || !appUser || !school || !selectedThread || sending) return;
    setSending(true);
    const text = draft.trim();
    try {
      await sendMessage({
        threadId: selectedThread.threadId,
        schoolId: school.id,
        childId: selectedThread.childId,
        senderId: appUser.uid,
        senderRole: "teacher",
        text,
        read: false,
      });
      setDraft("");

      // Fire-and-forget push notification to parent — never blocks the UI
      firebaseUser?.getIdToken().then(token => {
        fetch("/api/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            targetUid: selectedThread.parentId,
            title: `${appUser.displayName ?? "Your teacher"} sent an update`,
            body: text.length > 80 ? text.slice(0, 77) + "…" : text,
          }),
        }).catch(() => {}); // silent — push is best-effort
      }).catch(() => {});
    } catch {
      toast.error("Could not send message");
    } finally {
      setSending(false);
    }
  };

  const getUpdateForChild = (childId: string) =>
    updates.find(u => u.childId === childId);

  const handleCheckIn = async (child: Child) => {
    if (!appUser || !school || !selectedClass) return;
    const existing = getUpdateForChild(child.id);
    const checkInTime = new Date().toISOString();
    const id = await upsertDailyUpdate({
      id: existing?.id,
      schoolId: school.id,
      childId: child.id,
      classId: selectedClass.id,
      teacherId: appUser.uid,
      date: today,
      checkedIn: true,
      checkInTime: existing?.checkInTime ?? checkInTime,
      meals: existing?.meals ?? [
        { name: "Breakfast", eaten: "all" },
        { name: "Lunch", eaten: "all" },
        { name: "Snack", eaten: "all" },
      ],
      activities: existing?.activities ?? [],
      notes: existing?.notes,
      mood: existing?.mood,
      napMinutes: existing?.napMinutes,
    });
    setUpdates(prev => {
      const withoutOld = prev.filter(u => u.childId !== child.id);
      return [...withoutOld, {
        id,
        schoolId: school.id,
        childId: child.id,
        classId: selectedClass.id,
        teacherId: appUser.uid,
        date: today,
        checkedIn: true,
        checkInTime,
        meals: [
          { name: "Breakfast", eaten: "all" },
          { name: "Lunch", eaten: "all" },
          { name: "Snack", eaten: "all" },
        ],
        activities: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
    });
    toast.success(`${child.firstName} checked in ✓`);
  };

  const handleMood = async (child: Child, mood: MoodEmoji) => {
    if (!appUser || !school || !selectedClass) return;
    const existing = getUpdateForChild(child.id);
    if (!existing) { toast.error("Check in first"); return; }
    await upsertDailyUpdate({ ...existing, mood });
    setUpdates(prev => prev.map(u => u.childId === child.id ? { ...u, mood } : u));
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !school || !selectedClass || !appUser) return;
    const selectedChild = children.find(child => child.id === selectedMomentChildId);

    if (!selectedChild) {
      toast.error("Choose a child before uploading");
      return;
    }

    if (!selectedChild.photoConsent) {
      toast.error(`${selectedChild.firstName} does not have photo consent`);
      return;
    }

    setUploading(true);
    try {
      for (const [index, file] of Array.from(files).entries()) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `schools/${school.id}/moments/${selectedChild.id}/${Date.now()}_${index}_${safeName}`;
        const sRef = storageRef(storage, path);
        const snap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snap.ref);
        await addMoment({
          schoolId: school.id,
          childId: selectedChild.id,
          classId: selectedClass.id,
          teacherId: appUser.uid,
          date: today,
          mediaUrl: url,
          type: "photo",
          visibleToParents: true,
        });
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded for ${selectedChild.firstName}`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.trim() || !school || !selectedClass) return;
    const id = await addTask({
      schoolId: school.id,
      branchId: selectedClass.branchId,
      classId: selectedClass.id,
      title: newTask.trim(),
      priority: "medium",
      done: false,
    });
    setTasks(prev => [...prev, {
      id, schoolId: school.id, branchId: selectedClass.branchId,
      classId: selectedClass.id, title: newTask.trim(),
      priority: "medium", done: false, createdAt: new Date().toISOString(),
    }]);
    setNewTask("");
  };

  const handleToggleTask = async (task: Task) => {
    await toggleTask(task.id, !task.done);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
  };

  const handleCheckOut = async (child: Child) => {
    if (!appUser || !school || !selectedClass) return;
    const existing = getUpdateForChild(child.id);
    if (!existing?.checkedIn) { toast.error("Child is not checked in"); return; }
    const checkOutTime = new Date().toISOString();
    await upsertDailyUpdate({ ...existing, checkOutTime });
    setUpdates(prev => prev.map(u => u.childId === child.id ? { ...u, checkOutTime } : u));
    toast.success(`${child.firstName} checked out ✓`);
  };

  const handleMealUpdate = async (child: Child, mealIndex: number, eaten: "all" | "some" | "none") => {
    if (!appUser || !school || !selectedClass) return;
    const existing = getUpdateForChild(child.id);
    if (!existing) { toast.error("Check in first"); return; }
    const meals = existing.meals.map((m, i) => i === mealIndex ? { ...m, eaten } : m);
    await upsertDailyUpdate({ ...existing, meals });
    setUpdates(prev => prev.map(u => u.childId === child.id ? { ...u, meals } : u));
  };

  const handleNapUpdate = async (child: Child, napMinutes: number | undefined) => {
    if (!appUser || !school || !selectedClass) return;
    const existing = getUpdateForChild(child.id);
    if (!existing) return;
    await upsertDailyUpdate({ ...existing, napMinutes });
  };

  const handleNotesUpdate = async (child: Child, notes: string | undefined) => {
    if (!appUser || !school || !selectedClass) return;
    const existing = getUpdateForChild(child.id);
    if (!existing) return;
    await upsertDailyUpdate({ ...existing, notes });
  };

  const checkedIn = updates.filter(u => u.checkedIn).length;
  const selectedMomentChild = children.find(child => child.id === selectedMomentChildId);
  const canUploadMoment = Boolean(selectedMomentChild?.photoConsent) && !uploading;

  if (!appUser) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="app-shell">
      {/* Header */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
            {format(new Date(), "EEEE, d MMMM")}
          </p>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {selectedClass?.name ?? "My class"}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {classes.length > 1 && (
            <select
              value={selectedClass?.id ?? ""}
              onChange={e => {
                const c = classes.find(cl => cl.id === e.target.value);
                if (c) setSelectedClass(c);
              }}
              style={{ fontSize: 13, border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px" }}
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button onClick={() => { signOut(); router.replace("/login"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        padding: "12px 20px", gap: 8, borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}>
        <div className="stat-block" style={{ textAlign: "center" }}>
          <div className="stat-value" style={{ color: "var(--brand)" }}>{checkedIn}</div>
          <div className="stat-label">Checked in</div>
        </div>
        <div className="stat-block" style={{ textAlign: "center" }}>
          <div className="stat-value">{children.length}</div>
          <div className="stat-label">Expected</div>
        </div>
        <div className="stat-block" style={{ textAlign: "center" }}>
          <div className="stat-value">{tasks.filter(t => !t.done).length}</div>
          <div className="stat-label">Tasks open</div>
        </div>
      </div>

      <div className="page-content" style={{ padding: "16px 20px" }}>

        {/* ── CHECK-IN TAB ── */}
        {tab === "checkin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {children.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No children assigned to this class yet.</p>
            )}
            {children.map(child => {
              const upd = getUpdateForChild(child.id);
              return (
                <div key={child.id} className="card">
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="avatar" style={{ background: "var(--brand-light)", color: "var(--brand)", fontSize: 16 }}>
                      {child.firstName[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                          {child.firstName} {child.lastName}
                        </p>
                        {!child.photoConsent && (
                          <span
                            title="No photo consent"
                            style={{
                              display: "inline-flex", alignItems: "center",
                              background: "#fffbeb", color: "#92400e",
                              borderRadius: 99, padding: "1px 6px", gap: 3, fontSize: 10, fontWeight: 700,
                            }}
                          >
                            <CameraOff size={9} />
                            No consent
                          </span>
                        )}
                      </div>
                      {upd?.checkInTime && (
                        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                          In {format(new Date(upd.checkInTime), "HH:mm")}
                          {upd.checkOutTime && ` · Out ${format(new Date(upd.checkOutTime), "HH:mm")}`}
                        </p>
                      )}
                    </div>
                    {upd?.checkedIn && !upd?.checkOutTime ? (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "8px 14px", fontSize: 13 }}
                        onClick={() => handleCheckOut(child)}
                      >
                        Check out
                      </button>
                    ) : upd?.checkOutTime ? (
                      <span className="pill pill-gray" style={{ fontSize: 12 }}>Gone home</span>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ padding: "8px 14px", fontSize: 13 }}
                        onClick={() => handleCheckIn(child)}
                      >
                        Check in
                      </button>
                    )}
                  </div>

                  {upd?.checkedIn && (
                    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>

                      {/* Mood */}
                      <div>
                        <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Mood</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          {MOODS.map(m => (
                            <button
                              key={m}
                              onClick={() => handleMood(child, m)}
                              style={{
                                fontSize: 22, background: "none", border: "none", cursor: "pointer",
                                opacity: upd.mood === m ? 1 : 0.35,
                                transform: upd.mood === m ? "scale(1.2)" : "none",
                                transition: "all 0.15s",
                              }}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Meals */}
                      <div>
                        <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Meals</p>
                        {upd.meals.map((meal, mi) => (
                          <div key={mi} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontSize: 13 }}>{meal.name}</span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {(["all", "some", "none"] as const).map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => handleMealUpdate(child, mi, opt)}
                                  style={{
                                    fontSize: 12, padding: "4px 9px", borderRadius: 6, cursor: "pointer",
                                    border: `1px solid ${meal.eaten === opt
                                      ? opt === "all" ? "var(--success)" : opt === "some" ? "var(--warning)" : "var(--error)"
                                      : "var(--border)"}`,
                                    background: meal.eaten === opt
                                      ? opt === "all" ? "var(--success)" : opt === "some" ? "var(--warning)" : "var(--error)"
                                      : "transparent",
                                    color: meal.eaten === opt ? "white" : "var(--text-muted)",
                                    fontWeight: meal.eaten === opt ? 600 : 400,
                                    transition: "all 0.12s",
                                  }}
                                >
                                  {opt === "all" ? "All" : opt === "some" ? "Some" : "None"}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Nap */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Nap (mins)</p>
                        <input
                          type="number"
                          min={0}
                          max={480}
                          className="input"
                          style={{ width: 80, fontSize: 13, padding: "5px 8px", textAlign: "center" }}
                          value={upd.napMinutes ?? ""}
                          placeholder="0"
                          onChange={e => {
                            const val = e.target.value === "" ? undefined : Number(e.target.value);
                            setUpdates(prev => prev.map(u => u.childId === child.id ? { ...u, napMinutes: val } : u));
                          }}
                          onBlur={e => handleNapUpdate(child, e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </div>

                      {/* Notes */}
                      <div>
                        <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Notes for parent</p>
                        <textarea
                          className="input"
                          style={{ width: "100%", minHeight: 56, fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                          value={upd.notes ?? ""}
                          placeholder="How was their day? Any observations…"
                          onChange={e => {
                            const notes = e.target.value || undefined;
                            setUpdates(prev => prev.map(u => u.childId === child.id ? { ...u, notes } : u));
                          }}
                          onBlur={e => handleNotesUpdate(child, e.target.value || undefined)}
                        />
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── MOMENTS TAB ── */}
        {tab === "moments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Child
              </label>
              <select
                className="input"
                value={selectedMomentChildId}
                onChange={e => setSelectedMomentChildId(e.target.value)}
                disabled={children.length === 0 || uploading}
              >
                {children.length === 0 ? (
                  <option value="">No children assigned</option>
                ) : children.map(child => (
                  <option key={child.id} value={child.id}>
                    {child.firstName} {child.lastName}{child.photoConsent ? "" : " - no photo consent"}
                  </option>
                ))}
              </select>
            </div>

            {selectedMomentChild && !selectedMomentChild.photoConsent && (
              <div className="card warning-card" style={{ borderLeft: "3px solid var(--warning)", background: "#fffbeb", display: "flex", alignItems: "center", gap: 8 }}>
                <CameraOff size={16} style={{ color: "#92400e", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
                  Photo sharing is disabled for {selectedMomentChild.firstName} until consent is recorded.
                </p>
              </div>
            )}

            <div
              className="card"
              style={{
                textAlign: "center",
                borderStyle: "dashed",
                cursor: canUploadMoment ? "pointer" : "not-allowed",
                opacity: canUploadMoment ? 1 : 0.6,
              }}
              onClick={() => canUploadMoment && fileRef.current?.click()}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                {uploading ? "Uploading…" : "Share a moment"}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                {selectedMomentChild ? `Tap to add photos for ${selectedMomentChild.firstName}` : "Choose a child first"}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                disabled={!canUploadMoment}
                style={{ display: "none" }}
                onChange={e => handlePhotoUpload(e.target.files)}
              />
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              Photos are shared privately with each child&apos;s approved guardians only.
            </p>
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {tab === "tasks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Add a task…"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddTask()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" style={{ padding: "12px 16px" }} onClick={handleAddTask}>
                Add
              </button>
            </div>
            {tasks.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No tasks yet. You&apos;re ahead!</p>
            )}
            {tasks.map(task => (
              <div key={task.id} className="card"
                style={{ display: "flex", alignItems: "center", gap: 12, opacity: task.done ? 0.5 : 1 }}>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => handleToggleTask(task)}
                  style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--brand)" }}
                />
                <span style={{
                  flex: 1, fontSize: 14,
                  textDecoration: task.done ? "line-through" : "none",
                }}>
                  {task.title}
                </span>
                <span className={`pill ${
                  task.priority === "high" ? "pill-red" :
                  task.priority === "medium" ? "pill-amber" : "pill-gray"
                }`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── MESSAGES TAB ── */}
        {tab === "messages" && (
          selectedThread ? (
            /* ── Thread view ── */
            <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
              {/* Thread header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 0 12px", borderBottom: "1px solid var(--border)",
                position: "sticky", top: 0, background: "var(--surface)", zIndex: 1,
              }}>
                <button onClick={() => { setSelectedThread(null); setThreadMessages([]); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)", padding: 0, display: "flex" }}>
                  <ChevronLeft size={22} />
                </button>
                <div className="avatar" style={{ background: "var(--brand-light)", color: "var(--brand)", fontSize: 14 }}>
                  {selectedThread.childName[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{selectedThread.childName}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Parent notification</p>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80, display: "flex", flexDirection: "column", gap: 8, paddingTop: 12 }}>
                {threadMessages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 16px" }}>
                    <p style={{ fontSize: 32, margin: "0 0 8px" }}>💬</p>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>No messages yet</p>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                      Send {selectedThread.childName}&apos;s parents an update
                    </p>
                  </div>
                )}
                {threadMessages.map(m => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{
                      maxWidth: "80%", background: "var(--brand)", color: "#fff",
                      borderRadius: "16px 16px 4px 16px", padding: "10px 14px",
                    }}>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>{m.text}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, opacity: 0.75, textAlign: "right" }}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {m.read && " · Seen ✓"}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Compose */}
              <div style={{
                position: "fixed", bottom: "calc(64px + env(safe-area-inset-bottom))",
                left: "50%", transform: "translateX(-50%)",
                width: "100%", maxWidth: 430,
                background: "var(--surface)", borderTop: "1px solid var(--border)",
                padding: "10px 16px", display: "flex", gap: 8, alignItems: "flex-end",
              }}>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a notification…"
                  rows={1}
                  style={{
                    flex: 1, resize: "none", border: "1.5px solid var(--border)",
                    borderRadius: 10, padding: "10px 12px", fontSize: 14,
                    outline: "none", fontFamily: "inherit", lineHeight: 1.4,
                    maxHeight: 100, overflowY: "auto",
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="btn btn-primary"
                  style={{ padding: "10px 14px", borderRadius: 10, flexShrink: 0 }}
                >
                  {sending ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Send size={16} />}
                </button>
              </div>
            </div>
          ) : (
            /* ── Inbox / contact list ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-muted)" }}>
                Send a notification to a child&apos;s parents
              </p>
              {children.filter(c => c.parentIds?.length > 0).length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: 32 }}>
                  <p style={{ fontSize: 28, margin: "0 0 8px" }}>👨‍👩‍👧</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>No parents linked</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                    Ask your school owner to link parents to children
                  </p>
                </div>
              )}
              {children.filter(c => c.parentIds?.length > 0).map(child => {
                const parentId = child.parentIds[0];
                const threadId = `${appUser!.uid}_${parentId}_${child.id}`;
                const preview = threadPreviews[threadId];
                const isSeen = preview?.senderRole === "teacher" && preview?.read;
                const previewText = preview
                  ? (preview.text.length > 48 ? preview.text.slice(0, 45) + "…" : preview.text)
                  : `${child.parentIds.length} parent${child.parentIds.length !== 1 ? "s" : ""} linked`;

                return (
                  <button
                    key={child.id}
                    className="card"
                    onClick={() => {
                      setSelectedThread({ childId: child.id, parentId, threadId, childName: `${child.firstName} ${child.lastName}` });
                    }}
                    style={{
                      width: "100%", textAlign: "left", cursor: "pointer", border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", gap: 12,
                    }}
                  >
                    <div className="avatar" style={{ background: "var(--brand-light)", color: "var(--brand)", fontSize: 15 }}>
                      {child.firstName[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{child.firstName} {child.lastName}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {previewText}
                      </p>
                      {preview && (
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: isSeen ? "var(--brand)" : "var(--text-muted)" }}>
                          {preview.senderRole === "teacher"
                            ? (isSeen ? "✓ Seen" : "Delivered")
                            : "Parent replied"}
                          {" · "}
                          {new Date(preview.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    <ChevronLeft size={16} style={{ transform: "rotate(180deg)", color: "var(--text-muted)", flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {([
          { id: "checkin", Icon: Users, label: "Check-in" },
          { id: "moments", Icon: Camera, label: "Moments" },
          { id: "tasks", Icon: CheckSquare, label: "Tasks" },
          { id: "messages", Icon: MessageSquare, label: "Messages" },
        ] as const).map(({ id, Icon, label }) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => {
            setTab(id as Tab);
            if (id !== "messages") { setSelectedThread(null); setThreadMessages([]); }
          }}>
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

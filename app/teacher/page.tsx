"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import {
  getClassesForTeacher, getChildrenForClass,
  getDailyUpdatesForClass, upsertDailyUpdate,
  getTasksForClass, toggleTask, addTask,
  addMoment,
} from "@/lib/db";
import { storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import type { ClassRoom, Child, DailyUpdate, Task, MoodEmoji, MealRecord, MedicalRecord, JournalEntry, DevelopmentDomain } from "@/lib/types";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Users, Camera, CheckSquare, LogOut, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

type Tab = "checkin" | "moments" | "journal" | "tasks" | "leave";
const MOODS: MoodEmoji[] = ["😊", "😐", "😢", "😴", "🤒"];
const MEAL_NAMES = ["Breakfast", "Lunch", "Snack"] as const;
const EATEN_OPTIONS: MealRecord["eaten"][] = ["all", "some", "none"];
const NAP_OPTIONS = [0, 30, 60, 90, 120] as const;

export default function TeacherDashboard() {
  const { appUser, firebaseUser, signOut } = useAuth();
  const { school } = useSchool();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("checkin");
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [uploading, setUploading] = useState(false);
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<Record<string, MedicalRecord>>({});
  const [momentChildId, setMomentChildId] = useState<string>("");
  const [savingChild, setSavingChild] = useState<string | null>(null);
  // Journal state
  const [journalChildId, setJournalChildId] = useState<string>("");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalObs, setJournalObs] = useState("");
  const [journalDomains, setJournalDomains] = useState<DevelopmentDomain[]>([]);
  const [journalPhotos, setJournalPhotos] = useState<string[]>([]);
  const [journalShared, setJournalShared] = useState(true);
  const [journalSaving, setJournalSaving] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalUploading, setJournalUploading] = useState(false);
  const journalPhotoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    getChildrenForClass(school.id, selectedClass.id).then(kids => {
      setChildren(kids);
      if (kids.length > 0) setMomentChildId(kids[0].id);
    });
    getDailyUpdatesForClass(school.id, selectedClass.id, today).then(setUpdates);
    getTasksForClass(school.id, selectedClass.id).then(setTasks);
  }, [selectedClass, school, today]);

  const getUpdate = useCallback(
    (childId: string) => updates.find(u => u.childId === childId),
    [updates]
  );

  const patchUpdate = useCallback(
    (childId: string, patch: Partial<DailyUpdate>) => {
      setUpdates(prev =>
        prev.map(u => u.childId === childId ? { ...u, ...patch } : u)
      );
    },
    []
  );

  // ── Check-in ──────────────────────────────────────────────────
  const handleCheckIn = async (child: Child) => {
    if (!appUser || !school || !selectedClass) return;
    const existing = getUpdate(child.id);
    if (existing?.checkedIn) return;
    setSavingChild(child.id);
    try {
      const checkInTime = new Date().toISOString();
      const defaultMeals: MealRecord[] = MEAL_NAMES.map(name => ({ name, eaten: "all" }));
      const id = await upsertDailyUpdate({
        id: existing?.id,
        schoolId: school.id,
        childId: child.id,
        classId: selectedClass.id,
        teacherId: appUser.uid,
        date: today,
        checkedIn: true,
        checkInTime,
        checkOutTime: existing?.checkOutTime,
        meals: existing?.meals ?? defaultMeals,
        activities: existing?.activities ?? [],
        notes: existing?.notes,
        mood: existing?.mood,
        napMinutes: existing?.napMinutes,
      });
      setUpdates(prev => {
        const rest = prev.filter(u => u.childId !== child.id);
        return [...rest, {
          id,
          schoolId: school.id,
          childId: child.id,
          classId: selectedClass.id,
          teacherId: appUser.uid,
          date: today,
          checkedIn: true,
          checkInTime,
          meals: defaultMeals,
          activities: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }];
      });
      setExpandedChild(child.id);
      toast.success(`${child.firstName} checked in ✓`);
    } finally {
      setSavingChild(null);
    }
  };

  // ── Check-out ─────────────────────────────────────────────────
  const handleCheckOut = async (child: Child) => {
    if (!appUser || !school || !selectedClass) return;
    const existing = getUpdate(child.id);
    if (!existing) return;
    setSavingChild(child.id);
    try {
      const checkOutTime = new Date().toISOString();
      await upsertDailyUpdate({ ...existing, checkOutTime });
      patchUpdate(child.id, { checkOutTime });
      toast.success(`${child.firstName} checked out`);
    } finally {
      setSavingChild(null);
    }
  };

  // ── Mood ──────────────────────────────────────────────────────
  const handleMood = async (child: Child, mood: MoodEmoji) => {
    const existing = getUpdate(child.id);
    if (!existing) { toast.error("Check in first"); return; }
    patchUpdate(child.id, { mood });
    await upsertDailyUpdate({ ...existing, mood });
  };

  // ── Meals ─────────────────────────────────────────────────────
  const handleMeal = async (child: Child, mealName: string, eaten: MealRecord["eaten"]) => {
    const existing = getUpdate(child.id);
    if (!existing) return;
    const meals = existing.meals.map(m => m.name === mealName ? { ...m, eaten } : m);
    patchUpdate(child.id, { meals });
    await upsertDailyUpdate({ ...existing, meals });
  };

  // ── Nap ───────────────────────────────────────────────────────
  const handleNap = async (child: Child, napMinutes: number) => {
    const existing = getUpdate(child.id);
    if (!existing) return;
    patchUpdate(child.id, { napMinutes });
    await upsertDailyUpdate({ ...existing, napMinutes });
  };

  // ── Notes ─────────────────────────────────────────────────────
  const handleNotes = async (child: Child, notes: string) => {
    const existing = getUpdate(child.id);
    if (!existing) return;
    patchUpdate(child.id, { notes });
    await upsertDailyUpdate({ ...existing, notes });
  };

  // ── Photo upload ──────────────────────────────────────────────
  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !school || !selectedClass || !appUser || !momentChildId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `schools/${school.id}/moments/${Date.now()}_${file.name}`;
        const sRef = storageRef(storage, path);
        const snap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snap.ref);
        await addMoment({
          schoolId: school.id,
          childId: momentChildId,
          classId: selectedClass.id,
          teacherId: appUser.uid,
          date: today,
          mediaUrl: url,
          type: "photo",
          visibleToParents: true,
        });
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded`);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Tasks ─────────────────────────────────────────────────────
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

  const checkedIn = updates.filter(u => u.checkedIn).length;
  const checkedOut = updates.filter(u => u.checkOutTime).length;

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
          <button
            onClick={() => { signOut(); router.replace("/login"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
        padding: "12px 20px", gap: 8, borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: "var(--brand)" }}>{checkedIn}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>In</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{checkedOut}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Out</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{children.length - checkedIn}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Pending</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{tasks.filter(t => !t.done).length}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Tasks</div>
        </div>
      </div>

      <div className="page-content" style={{ padding: "16px 20px" }}>

        {/* ── CHECK-IN TAB ── */}
        {tab === "checkin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {children.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                No children assigned to this class yet.
              </p>
            )}
            {children.map(child => {
              const upd = getUpdate(child.id);
              const isIn = upd?.checkedIn;
              const isOut = !!upd?.checkOutTime;
              const isExpanded = expandedChild === child.id;
              const isSaving = savingChild === child.id;

              return (
                <div key={child.id} className="card" style={{ padding: 0, overflow: "hidden" }}>

                  {/* ── Row: avatar + name + action button ── */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 16px",
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: isIn ? "var(--brand-light)" : "var(--surface-2)",
                      color: isIn ? "var(--brand)" : "var(--text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 15, flexShrink: 0,
                    }}>
                      {child.firstName[0]}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                        {child.firstName} {child.lastName}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                        {isOut
                          ? `Out ${format(new Date(upd!.checkOutTime!), "HH:mm")}`
                          : isIn
                          ? `In ${format(new Date(upd!.checkInTime!), "HH:mm")}${upd?.mood ? ` · ${upd.mood}` : ""}`
                          : "Not yet arrived"}
                      </p>
                    </div>

                    {/* Action button */}
                    {!isIn ? (
                      <button
                        className="btn btn-primary"
                        style={{ padding: "8px 16px", fontSize: 13, minWidth: 88 }}
                        onClick={() => handleCheckIn(child)}
                        disabled={isSaving}
                      >
                        {isSaving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Check in"}
                      </button>
                    ) : isOut ? (
                      <span style={{
                        fontSize: 13, color: "var(--text-muted)",
                        background: "var(--surface-2)", padding: "6px 12px",
                        borderRadius: 8, fontWeight: 500,
                      }}>
                        Gone home
                      </span>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "8px 14px", fontSize: 13, minWidth: 88 }}
                        onClick={() => handleCheckOut(child)}
                        disabled={isSaving}
                      >
                        {isSaving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Check out"}
                      </button>
                    )}

                    {/* Expand toggle (only when checked in) */}
                    {isIn && !isOut && (
                      <button
                        onClick={() => setExpandedChild(isExpanded ? null : child.id)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--text-muted)", padding: "4px 0 4px 4px",
                        }}
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    )}
                  </div>

                  {/* ── Expanded detail panel ── */}
                  {isExpanded && isIn && (
                    <div style={{
                      borderTop: "1px solid var(--border)",
                      padding: "14px 16px",
                      display: "flex", flexDirection: "column", gap: 16,
                      background: "var(--surface-2)",
                    }}>

                      {/* Mood */}
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Mood
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                          {MOODS.map(m => (
                            <button
                              key={m}
                              onClick={() => handleMood(child, m)}
                              style={{
                                fontSize: 24, background: "none", border: "none", cursor: "pointer",
                                opacity: upd?.mood === m ? 1 : 0.3,
                                transform: upd?.mood === m ? "scale(1.25)" : "none",
                                transition: "all 0.15s",
                                padding: 0,
                              }}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Meals */}
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Meals
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {MEAL_NAMES.map(mealName => {
                            const meal = upd?.meals.find(m => m.name === mealName);
                            const eaten = meal?.eaten ?? "all";
                            return (
                              <div key={mealName} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, width: 68, color: "var(--text-muted)" }}>{mealName}</span>
                                <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                                  {EATEN_OPTIONS.map(opt => (
                                    <button
                                      key={opt}
                                      onClick={() => handleMeal(child, mealName, opt)}
                                      style={{
                                        padding: "5px 12px",
                                        fontSize: 12,
                                        fontWeight: 500,
                                        border: "none",
                                        borderRight: opt !== "none" ? "1px solid var(--border)" : "none",
                                        cursor: "pointer",
                                        background: eaten === opt ? "var(--brand)" : "var(--surface)",
                                        color: eaten === opt ? "#fff" : "var(--text-muted)",
                                        transition: "background 0.1s",
                                        textTransform: "capitalize",
                                      }}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Nap */}
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Nap
                        </p>
                        <div style={{ display: "flex", gap: 6 }}>
                          {NAP_OPTIONS.map(mins => (
                            <button
                              key={mins}
                              onClick={() => handleNap(child, mins)}
                              style={{
                                padding: "6px 10px",
                                fontSize: 12,
                                fontWeight: 500,
                                borderRadius: 8,
                                border: "1px solid var(--border)",
                                cursor: "pointer",
                                background: upd?.napMinutes === mins ? "var(--brand)" : "var(--surface)",
                                color: upd?.napMinutes === mins ? "#fff" : "var(--text)",
                                transition: "background 0.1s",
                              }}
                            >
                              {mins === 0 ? "None" : `${mins}m`}
                            </button>
                          ))}
                        </div>
                      </div>


                      {/* ── Safety Panel ── */}
                      {(() => {
                        const med = medicalRecords[child.id];
                        const hasAlerts = med && (
                          med.allergies.length > 0 ||
                          med.medications.length > 0 ||
                          med.conditions.length > 0 ||
                          med.emergencyContacts.length > 0
                        );
                        if (!hasAlerts) return null;
                        const severityColor: Record<string, string> = {
                          anaphylactic: "#dc2626",
                          severe: "#ea580c",
                          moderate: "#d97706",
                          mild: "#65a30d",
                        };
                        return (
                          <div style={{ borderRadius: 10, border: "1.5px solid #fca5a5", background: "#fff1f2", padding: 12 }}>
                            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              ⚠️ Safety Info
                            </p>
                            {med.allergies.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#7f1d1d" }}>ALLERGIES</p>
                                {med.allergies.map((a, i) => (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                    <span style={{ background: severityColor[a.severity] ?? "#999", color: "#fff", borderRadius: 4, fontSize: 10, padding: "1px 5px", fontWeight: 700 }}>
                                      {a.severity.toUpperCase()}
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                                    {a.treatment && <span style={{ fontSize: 12, color: "#7f1d1d" }}>— {a.treatment}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {med.medications.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#7f1d1d" }}>MEDICATIONS</p>
                                {med.medications.map((m, i) => (
                                  <div key={i} style={{ fontSize: 13, marginBottom: 2 }}>
                                    <strong>{m.name}</strong> — {m.dose}, {m.frequency}
                                    {m.instructions && <span style={{ color: "#7f1d1d" }}> ({m.instructions})</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {med.conditions.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#7f1d1d" }}>CONDITIONS</p>
                                {med.conditions.map((c, i) => (
                                  <div key={i} style={{ fontSize: 13, marginBottom: 2 }}>
                                    <strong>{c.name}</strong>{c.notes ? ` — ${c.notes}` : ""}
                                  </div>
                                ))}
                              </div>
                            )}
                            {med.emergencyContacts.filter(e => e.canPickup).length > 0 && (
                              <div>
                                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#7f1d1d" }}>AUTHORISED PICKUP</p>
                                {med.emergencyContacts.filter(e => e.canPickup).map((e, i) => (
                                  <div key={i} style={{ fontSize: 13, marginBottom: 2 }}>
                                    {e.name} ({e.relationship}) — <a href={`tel:${e.phone}`} style={{ color: "#dc2626" }}>{e.phone}</a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Notes */}
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Notes for parent
                        </p>
                        <textarea
                          className="input"
                          rows={2}
                          placeholder="Any notes for the parent today…"
                          defaultValue={upd?.notes ?? ""}
                          onBlur={e => handleNotes(child, e.target.value)}
                          style={{ resize: "none", fontSize: 13 }}
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

            {/* Child selector */}
            {children.length > 0 && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Which child is this for?
                </label>
                <select
                  className="input"
                  value={momentChildId}
                  onChange={e => setMomentChildId(e.target.value)}
                  style={{ fontSize: 14 }}
                >
                  {children.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Upload area */}
            <div
              className="card"
              style={{
                textAlign: "center", borderStyle: "dashed",
                cursor: uploading ? "not-allowed" : "pointer",
                opacity: uploading ? 0.7 : 1,
              }}
              onClick={() => !uploading && fileRef.current?.click()}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                {uploading ? "Uploading…" : "Share a moment"}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                {momentChildId
                  ? `Photos go to ${children.find(c => c.id === momentChildId)?.firstName ?? "child"}'s guardian`
                  : "Select a child above first"}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={e => handlePhotoUpload(e.target.files)}
              />
            </div>

            <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
              Photos are shared privately with each child&apos;s approved guardians only.
            </p>
          </div>
        )}

        {/* ── JOURNAL TAB ── */}
        {tab === "journal" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Child selector */}
            {children.length > 0 && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>Child</label>
                <select
                  value={journalChildId}
                  onChange={e => {
                    const id = e.target.value;
                    setJournalChildId(id);
                    if (!id) { setJournalEntries([]); return; }
                    setJournalLoading(true);
                    import("@/lib/db").then(({ getJournalEntriesForChild }) =>
                      getJournalEntriesForChild(id, true)
                    ).then(entries => { setJournalEntries(entries); setJournalLoading(false); });
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, background: "var(--surface)", color: "var(--text)" }}
                >
                  <option value="">Select a child…</option>
                  {children.map(c => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* New entry form */}
            {journalChildId && (
              <div style={{ borderRadius: 14, border: "1px solid var(--border)", padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>New Entry</p>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Title</label>
                  <input
                    value={journalTitle}
                    onChange={e => setJournalTitle(e.target.value)}
                    placeholder="e.g. Built a tower with 8 blocks"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14, background: "var(--surface-2)", color: "var(--text)" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Observation</label>
                  <textarea
                    value={journalObs}
                    onChange={e => setJournalObs(e.target.value)}
                    rows={4}
                    placeholder="Describe what you observed. Be specific — what did the child do or say?"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14, background: "var(--surface-2)", color: "var(--text)", resize: "none" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>Development Domains</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(["physical","cognitive","language","social","emotional","creative"] as DevelopmentDomain[]).map(d => {
                      const labels: Record<DevelopmentDomain, string> = {
                        physical: "🏃 Physical", cognitive: "🧠 Cognitive", language: "💬 Language",
                        social: "🤝 Social", emotional: "💛 Emotional", creative: "🎨 Creative",
                      };
                      const selected = journalDomains.includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() => setJournalDomains(prev => selected ? prev.filter(x => x !== d) : [...prev, d])}
                          style={{
                            padding: "6px 12px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                            border: selected ? "2px solid var(--primary)" : "1px solid var(--border)",
                            background: selected ? "var(--primary-light)" : "var(--surface-2)",
                            color: selected ? "var(--primary)" : "var(--text-muted)",
                            fontWeight: selected ? 700 : 400,
                          }}
                        >
                          {labels[d]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Photo upload */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Photos</label>
                  <input ref={journalPhotoRef} type="file" accept="image/*" multiple hidden onChange={async e => {
                    const files = Array.from(e.target.files ?? []);
                    if (!files.length) return;
                    setJournalUploading(true);
                    try {
                      const { ref: storageRef, uploadBytes, getDownloadURL } = await import("firebase/storage");
                      const { storage } = await import("@/lib/firebase");
                      const urls = await Promise.all(files.map(async file => {
                        const r = storageRef(storage, `journals/${journalChildId}/${Date.now()}_${file.name}`);
                        await uploadBytes(r, file);
                        return getDownloadURL(r);
                      }));
                      setJournalPhotos(prev => [...prev, ...urls]);
                    } catch { toast.error("Upload failed"); }
                    finally { setJournalUploading(false); if (journalPhotoRef.current) journalPhotoRef.current.value = ""; }
                  }} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {journalPhotos.map((url, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img src={url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                        <button onClick={() => setJournalPhotos(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => journalPhotoRef.current?.click()}
                      disabled={journalUploading}
                      style={{ width: 72, height: 72, borderRadius: 8, border: "2px dashed var(--border)", background: "var(--surface-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--text-muted)" }}
                    >
                      {journalUploading ? "…" : "+"}
                    </button>
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={journalShared} onChange={e => setJournalShared(e.target.checked)} />
                  Share with parent
                </label>

                <button
                  disabled={journalSaving || !journalTitle.trim() || !journalObs.trim()}
                  onClick={async () => {
                    if (!appUser || !selectedClass) return;
                    const child = children.find(c => c.id === journalChildId);
                    if (!child) return;
                    setJournalSaving(true);
                    try {
                      const { createJournalEntry } = await import("@/lib/db");
                      const id = await createJournalEntry({
                        schoolId: selectedClass.schoolId,
                        childId: journalChildId,
                        childName: `${child.firstName} ${child.lastName}`,
                        title: journalTitle.trim(),
                        observation: journalObs.trim(),
                        domains: journalDomains,
                        photoUrls: journalPhotos,
                        sharedWithParent: journalShared,
                        authorId: appUser.uid,
                        authorName: appUser.displayName ?? appUser.email ?? "Teacher",
                      });
                      toast.success("Journal entry saved");
                      // Prepend to list
                      setJournalEntries(prev => [{
                        id, schoolId: selectedClass.schoolId, childId: journalChildId,
                        childName: `${child.firstName} ${child.lastName}`,
                        title: journalTitle.trim(), observation: journalObs.trim(),
                        domains: journalDomains, photoUrls: journalPhotos,
                        sharedWithParent: journalShared,
                        authorId: appUser.uid, authorName: appUser.displayName ?? appUser.email ?? "Teacher",
                        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                      }, ...prev]);
                      setJournalTitle(""); setJournalObs(""); setJournalDomains([]); setJournalPhotos([]); setJournalShared(true);
                    } catch { toast.error("Failed to save"); }
                    finally { setJournalSaving(false); }
                  }}
                  style={{ padding: "12px 0", borderRadius: 12, background: "var(--primary)", color: "#fff", border: "none", fontWeight: 700, fontSize: 15, cursor: journalSaving ? "not-allowed" : "pointer", opacity: (journalSaving || !journalTitle.trim() || !journalObs.trim()) ? 0.6 : 1 }}
                >
                  {journalSaving ? "Saving…" : "Save Entry"}
                </button>
              </div>
            )}

            {/* Entries list */}
            {journalChildId && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 10px" }}>
                  Previous Entries
                </p>
                {journalLoading ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>
                ) : journalEntries.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No entries yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {journalEntries.map(entry => {
                      const domainLabels: Record<DevelopmentDomain, string> = {
                        physical: "🏃 Physical", cognitive: "🧠 Cognitive", language: "💬 Language",
                        social: "🤝 Social", emotional: "💛 Emotional", creative: "🎨 Creative",
                      };
                      return (
                        <div key={entry.id} style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 14, background: "var(--surface)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{entry.title}</p>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {entry.sharedWithParent ? "👁 Shared" : "🔒 Draft"}
                            </span>
                          </div>
                          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>{entry.observation}</p>
                          {entry.domains.length > 0 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                              {entry.domains.map(d => (
                                <span key={d} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--primary-light)", color: "var(--primary)", fontWeight: 600 }}>{domainLabels[d]}</span>
                              ))}
                            </div>
                          )}
                          {entry.photoUrls.length > 0 && (
                            <div style={{ display: "flex", gap: 6 }}>
                              {entry.photoUrls.map((url, i) => (
                                <img key={i} src={url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />
                              ))}
                            </div>
                          )}
                          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                            {new Date(entry.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })} · {entry.authorName}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
              <button
                className="btn btn-primary"
                style={{ padding: "12px 16px" }}
                onClick={handleAddTask}
              >
                Add
              </button>
            </div>
            {tasks.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No tasks yet — you&apos;re ahead!</p>
            )}
            {tasks.map(task => (
              <div
                key={task.id}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: 12, opacity: task.done ? 0.5 : 1 }}
              >
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
      </div>


      {/* Leave Request tab */}
      {tab === "leave" && (
        <TeacherLeavePanel firebaseUser={firebaseUser} schoolId={school?.id ?? ""} />
      )}

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {([
          { id: "checkin", Icon: Users, label: "Check-in" },
          { id: "moments", Icon: Camera, label: "Moments" },
          { id: "journal", Icon: BookOpen, label: "Journal" },
          { id: "tasks", Icon: CheckSquare, label: "Tasks" },
          { id: "leave", Icon: Calendar, label: "Leave" },
        ] as const).map(({ id, Icon, label }) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id as Tab)}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Teacher Leave Panel ──────────────────────────────────────────────────────

function TeacherLeavePanel({ firebaseUser, schoolId }: { firebaseUser: import("firebase/auth").User | null; schoolId: string }) {
  const [myRequests, setMyRequests] = useState<import("@/lib/types").LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [leaveType, setLeaveType] = useState<import("@/lib/types").LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  async function getToken() { return firebaseUser?.getIdToken() ?? ""; }

  useEffect(() => {
    if (!firebaseUser || !schoolId) return;
    import("@/lib/db").then(({ getLeaveRequestsForSchool }) =>
      getLeaveRequestsForSchool(schoolId)
    ).then(all => {
      setMyRequests(all.filter(r => r.staffUid === firebaseUser.uid));
      setLoading(false);
    });
  }, [firebaseUser, schoolId]);

  function calcDays(s: string, e: string): number {
    if (!s || !e) return 0;
    const diff = new Date(e).getTime() - new Date(s).getTime();
    return Math.max(1, Math.round(diff / 86400000) + 1);
  }

  async function submitRequest() {
    if (!startDate || !endDate || !reason.trim()) {
      toast.error("Please fill in all fields"); return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End date must be after start date"); return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const days = calcDays(startDate, endDate);
      const res = await fetch("/api/hr/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: leaveType, startDate, endDate, days, reason }),
      });
      if (!res.ok) throw new Error("Failed");
      const { id } = await res.json();
      const newReq: import("@/lib/types").LeaveRequest = {
        id, schoolId, staffUid: firebaseUser!.uid, staffName: firebaseUser!.displayName ?? "",
        type: leaveType, startDate, endDate, days, reason,
        status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      setMyRequests(prev => [newReq, ...prev]);
      setShowForm(false);
      setStartDate(""); setEndDate(""); setReason(""); setLeaveType("annual");
      toast.success("Leave request submitted");
    } catch { toast.error("Failed to submit"); }
    finally { setSubmitting(false); }
  }

  const LEAVE_LABELS: Record<string, string> = {
    annual: "Annual Leave", sick: "Sick Leave", family: "Family Responsibility",
    unpaid: "Unpaid Leave", other: "Other",
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, background: "var(--surface)", color: "var(--text)", boxSizing: "border-box" };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 80px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>My Leave</h2>
        <button onClick={() => setShowForm(v => !v)} style={{ padding: "8px 16px", borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {showForm ? "Cancel" : "+ Request Leave"}
        </button>
      </div>

      {showForm && (
        <div style={{ borderRadius: 14, border: "1px solid var(--primary)", padding: 16, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>New Leave Request</p>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Leave Type</label>
            <select style={inputStyle} value={leaveType} onChange={e => setLeaveType(e.target.value as import("@/lib/types").LeaveType)}>
              {Object.entries(LEAVE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Start Date</label>
              <input style={inputStyle} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>End Date</label>
              <input style={inputStyle} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          {startDate && endDate && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
              {calcDays(startDate, endDate)} day{calcDays(startDate, endDate) !== 1 ? "s" : ""}
            </p>
          )}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Reason</label>
            <textarea style={{ ...inputStyle, resize: "none" }} rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Brief reason for leave request…" />
          </div>
          <button onClick={submitRequest} disabled={submitting} style={{ padding: "13px 0", borderRadius: 12, background: "var(--primary)", color: "#fff", border: "none", fontWeight: 700, fontSize: 15, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>
      ) : myRequests.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 40, color: "var(--text-muted)" }}>
          <p style={{ fontSize: 14 }}>No leave requests yet.</p>
          <p style={{ fontSize: 13 }}>Tap "+ Request Leave" to submit one.</p>
        </div>
      ) : myRequests.map(req => {
        const statusColors: Record<string, [string, string]> = {
          pending: ["#fef3c7", "#d97706"], approved: ["#dcfce7", "#16a34a"], declined: ["#fee2e2", "#dc2626"],
        };
        const [bg, fg] = statusColors[req.status] ?? ["var(--surface-2)", "var(--text-muted)"];
        return (
          <div key={req.id} style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 14, background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14 }}>{LEAVE_LABELS[req.type]}</p>
                <p style={{ margin: "0 0 2px", fontSize: 13, color: "var(--text-muted)" }}>
                  {new Date(req.startDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – {new Date(req.endDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })} · {req.days} day{req.days !== 1 ? "s" : ""}
                </p>
                {req.reason && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>"{req.reason}"</p>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: bg, color: fg, whiteSpace: "nowrap" }}>{req.status.toUpperCase()}</span>
            </div>
            {req.reviewNote && <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>Note from manager: {req.reviewNote}</p>}
          </div>
        );
      })}
    </div>
  );
}

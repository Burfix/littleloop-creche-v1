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
import type { ClassRoom, Child, DailyUpdate, Task, MoodEmoji, MealRecord } from "@/lib/types";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Users, Camera, CheckSquare, LogOut, ChevronDown, ChevronUp } from "lucide-react";

type Tab = "checkin" | "moments" | "tasks";
const MOODS: MoodEmoji[] = ["😊", "😐", "😢", "😴", "🤒"];
const MEAL_NAMES = ["Breakfast", "Lunch", "Snack"] as const;
const EATEN_OPTIONS: MealRecord["eaten"][] = ["all", "some", "none"];
const NAP_OPTIONS = [0, 30, 60, 90, 120] as const;

export default function TeacherDashboard() {
  const { appUser, signOut } = useAuth();
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
  const [momentChildId, setMomentChildId] = useState<string>("");
  const [savingChild, setSavingChild] = useState<string | null>(null);
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

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {([
          { id: "checkin", Icon: Users, label: "Check-in" },
          { id: "moments", Icon: Camera, label: "Moments" },
          { id: "tasks", Icon: CheckSquare, label: "Tasks" },
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

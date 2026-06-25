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
import { Users, Camera, CheckSquare, LogOut } from "lucide-react";

type Tab = "checkin" | "moments" | "tasks";
const MOODS: MoodEmoji[] = ["😊", "😐", "😢", "😴", "🤒"];

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
    getChildrenForClass(school.id, selectedClass.id).then(setChildren);
    getDailyUpdatesForClass(school.id, selectedClass.id, today).then(setUpdates);
    getTasksForClass(school.id, selectedClass.id).then(setTasks);
  }, [selectedClass, school, today]);

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
    if (!files || !school || !selectedClass || !appUser || children.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `schools/${school.id}/moments/${Date.now()}_${file.name}`;
        const sRef = storageRef(storage, path);
        const snap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snap.ref);
        // Upload to first child in class as demo; real app would let teacher select
        await addMoment({
          schoolId: school.id,
          childId: children[0].id,
          classId: selectedClass.id,
          teacherId: appUser.uid,
          date: today,
          mediaUrl: url,
          type: "photo",
          visibleToParents: true,
        });
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded`);
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

  const checkedIn = updates.filter(u => u.checkedIn).length;

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
              onChange={e => setClasses(prev => {
                const c = prev.find(cl => cl.id === e.target.value);
                if (c) setSelectedClass(c);
                return prev;
              })}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: upd?.checkedIn ? 12 : 0 }}>
                    <div className="avatar" style={{ background: "var(--brand-light)", color: "var(--brand)", fontSize: 16 }}>
                      {child.firstName[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                        {child.firstName} {child.lastName}
                      </p>
                      {upd?.checkInTime && (
                        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                          In at {format(new Date(upd.checkInTime), "HH:mm")}
                        </p>
                      )}
                    </div>
                    <button
                      className={`btn ${upd?.checkedIn ? "btn-secondary" : "btn-primary"}`}
                      style={{ padding: "8px 16px", fontSize: 13 }}
                      onClick={() => !upd?.checkedIn && handleCheckIn(child)}
                    >
                      {upd?.checkedIn ? "✓ In" : "Check in"}
                    </button>
                  </div>

                  {upd?.checkedIn && (
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                        Mood
                      </p>
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
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── MOMENTS TAB ── */}
        {tab === "moments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ textAlign: "center", borderStyle: "dashed", cursor: "pointer" }}
              onClick={() => fileRef.current?.click()}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                {uploading ? "Uploading…" : "Share a moment"}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                Tap to add photos from today
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
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No tasks yet — you&apos;re ahead!</p>
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
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {([
          { id: "checkin", Icon: Users, label: "Check-in" },
          { id: "moments", Icon: Camera, label: "Moments" },
          { id: "tasks", Icon: CheckSquare, label: "Tasks" },
        ] as const).map(({ id, Icon, label }) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id as Tab)}>
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

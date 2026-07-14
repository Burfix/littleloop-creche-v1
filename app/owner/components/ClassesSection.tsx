"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Plus, X, Trash2, Users } from "lucide-react";
import {
  getClassesForSchool,
  createClass,
  updateClass,
  deleteClass,
} from "@/lib/db";
import type { ClassRoom, AppUser, School } from "@/lib/types";

interface ClassesSectionProps {
  school: School;
  teachers: AppUser[];
  onClassesChange?: (classes: ClassRoom[]) => void;
}

const DEFAULT_FORM = {
  name: "",
  ageGroupMin: 0,
  ageGroupMax: 2,
  capacity: 10,
  teacherIds: [] as string[],
};

export function ClassesSection({ school, teachers, onClassesChange }: ClassesSectionProps) {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    let cancelled = false;
    getClassesForSchool(school.id)
      .then(cs => { if (!cancelled) { setClasses(cs); onClassesChange?.(cs); } })
      .catch(err => {
        console.error("Failed to load classes", { schoolId: school.id, err });
        toast.error("Could not load classes");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [school.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Enter a class name"); return; }
    if (form.capacity < 1) { toast.error("Capacity must be at least 1"); return; }

    const branchId = school.branches[0]?.id ?? "";
    setSaving(true);
    try {
      const id = await createClass({
        schoolId: school.id,
        branchId,
        name: form.name.trim(),
        ageGroupMin: form.ageGroupMin,
        ageGroupMax: form.ageGroupMax,
        capacity: form.capacity,
        teacherIds: form.teacherIds,
      });
      const newClass: ClassRoom = {
        id,
        schoolId: school.id,
        branchId,
        name: form.name.trim(),
        ageGroupMin: form.ageGroupMin,
        ageGroupMax: form.ageGroupMax,
        capacity: form.capacity,
        teacherIds: form.teacherIds,
      };
      const updated = [newClass, ...classes];
      setClasses(updated);
      onClassesChange?.(updated);
      toast.success(`${form.name} created`);
      setForm(DEFAULT_FORM);
      setShowForm(false);
    } catch (err) {
      console.error("Failed to create class", { schoolId: school.id, err });
      toast.error("Could not create class");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTeacher = async (cls: ClassRoom, teacherId: string) => {
    const hasTeacher = cls.teacherIds.includes(teacherId);
    const newIds = hasTeacher
      ? cls.teacherIds.filter(id => id !== teacherId)
      : [...cls.teacherIds, teacherId];

    try {
      await updateClass(cls.id, { teacherIds: newIds });
      const updated = classes.map(c => c.id === cls.id ? { ...c, teacherIds: newIds } : c);
      setClasses(updated);
      onClassesChange?.(updated);
    } catch (err) {
      console.error("Failed to update class", { classId: cls.id, err });
      toast.error("Could not update class");
    }
  };

  const handleDelete = async (cls: ClassRoom) => {
    setDeletingId(cls.id);
    try {
      await deleteClass(cls.id);
      const updated = classes.filter(c => c.id !== cls.id);
      setClasses(updated);
      onClassesChange?.(updated);
      toast.success(`${cls.name} deleted`);
    } catch (err) {
      console.error("Failed to delete class", { classId: cls.id, err });
      toast.error("Could not delete class");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div style={{ padding: "8px 0" }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Classes</h4>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: "7px 12px" }}
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancel" : "New class"}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 12, background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>New class</p>

          <input
            className="input"
            placeholder="Class name e.g. Toddlers (1–2yr)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Min age (yr)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={12}
                value={form.ageGroupMin}
                onChange={e => setForm(f => ({ ...f, ageGroupMin: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Max age (yr)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={12}
                value={form.ageGroupMax}
                onChange={e => setForm(f => ({ ...f, ageGroupMax: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Capacity</label>
              <input
                className="input"
                type="number"
                min={1}
                value={form.capacity}
                onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}
              />
            </div>
          </div>

          {teachers.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Assign teachers
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {teachers.map(t => {
                  const selected = form.teacherIds.includes(t.uid);
                  return (
                    <button
                      key={t.uid}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        teacherIds: selected
                          ? f.teacherIds.filter(id => id !== t.uid)
                          : [...f.teacherIds, t.uid],
                      }))}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        border: `1.5px solid ${selected ? "var(--brand)" : "var(--border)"}`,
                        background: selected ? "var(--brand-light)" : "none",
                        color: selected ? "var(--brand-dark)" : "var(--text)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {t.displayName ?? t.email}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? <span className="spinner" /> : "Create class"}
          </button>
        </div>
      )}

      {classes.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          No classes yet. Create one to group children and assign teachers.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {classes.map(cls => {
            const assignedTeachers = teachers.filter(t => cls.teacherIds.includes(t.uid));
            return (
              <div key={cls.id} className="card" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{cls.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      {cls.ageGroupMin}–{cls.ageGroupMax} yr · Capacity {cls.capacity}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(cls)}
                    disabled={deletingId === cls.id}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-muted)", padding: 4,
                    }}
                  >
                    {deletingId === cls.id
                      ? <span className="spinner" style={{ width: 14, height: 14 }} />
                      : <Trash2 size={14} />
                    }
                  </button>
                </div>

                {/* Teacher chips */}
                {teachers.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                      <Users size={10} style={{ display: "inline", marginRight: 4 }} />
                      TEACHERS
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {teachers.map(t => {
                        const assigned = cls.teacherIds.includes(t.uid);
                        return (
                          <button
                            key={t.uid}
                            type="button"
                            onClick={() => handleToggleTeacher(cls, t.uid)}
                            style={{
                              padding: "4px 9px",
                              borderRadius: 8,
                              border: `1.5px solid ${assigned ? "var(--brand)" : "var(--border)"}`,
                              background: assigned ? "var(--brand-light)" : "none",
                              color: assigned ? "var(--brand-dark)" : "var(--text-muted)",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            {t.displayName ?? t.email}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {teachers.length === 0 && (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    Invite teachers to assign them.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

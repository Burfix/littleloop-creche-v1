"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getAllUsers } from "@/lib/db";
import type { AppUser, School } from "@/lib/types";
import type { User } from "firebase/auth";

const ROLE_PILL: Record<string, string> = {
  superadmin: "pill-blue",
  owner: "pill-green",
  teacher: "pill-amber",
  parent: "pill-gray",
};

interface UsersPanelProps {
  schools: School[];
  firebaseUser: User;
  /** Pre-fill suggestion — highlight a user whose display name should be updated */
  targetEmail?: string;
  targetDisplayName?: string;
}

export function UsersPanel({ schools, firebaseUser, targetEmail, targetDisplayName }: UsersPanelProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  useEffect(() => {
    getAllUsers()
      .then(setUsers)
      .catch(() => toast.error("Could not load users"))
      .finally(() => setLoadingUsers(false));
  }, []);

  const filtered = users.filter(user =>
    (selectedSchoolId === "all" || user.schoolId === selectedSchoolId) &&
    (roleFilter === "all" || user.role === roleFilter)
  );

  const startEditing = (user: AppUser, suggestedName?: string) => {
    setEditingUid(user.uid);
    setDraftName(suggestedName ?? user.displayName ?? "");
  };

  const saveDisplayName = async (user: AppUser) => {
    const trimmedName = draftName.trim();
    if (!trimmedName) { toast.error("Name is required"); return; }

    setSavingUid(user.uid);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: trimmedName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUsers(prev => prev.map(item => item.uid === user.uid ? { ...item, displayName: trimmedName } : item));
      setEditingUid(null);
      setDraftName("");
      toast.success("User name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update user");
    } finally {
      setSavingUid(null);
    }
  };

  const deleteUser = async (user: AppUser) => {
    if (user.uid === firebaseUser.uid) {
      toast.error("You cannot delete your own active account");
      return;
    }
    const label = user.email ?? user.displayName ?? "this user";
    if (!window.confirm(`Delete ${label}? This removes their app profile and Firebase Auth account.`)) return;

    setDeletingUid(user.uid);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUsers(prev => prev.filter(item => item.uid !== user.uid));
      toast.success(`${label} deleted. You can send a fresh invite now.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete user");
    } finally {
      setDeletingUid(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <select className="input" value={selectedSchoolId} onChange={e => setSelectedSchoolId(e.target.value)}>
          <option value="all">All schools</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          {["all", "superadmin", "owner", "teacher", "parent"].map(role => (
            <option key={role} value={role}>{role === "all" ? "All roles" : role}</option>
          ))}
        </select>
      </div>

      {loadingUsers ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading users...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No users found.</p>
      ) : filtered.map(user => {
        const isEditing = editingUid === user.uid;
        const suggestedName = targetEmail && user.email === targetEmail ? targetDisplayName : undefined;

        return (
          <div key={user.uid} className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="avatar" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {isEditing ? (
                  <input
                    className="input"
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveDisplayName(user)}
                  />
                ) : (
                  <>
                    <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 15 }}>{user.displayName ?? user.email}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{user.email}</p>
                  </>
                )}
              </div>
              <span className={`pill ${ROLE_PILL[user.role] ?? "pill-gray"}`}>{user.role}</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {isEditing ? (
                <>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }}
                    disabled={savingUid === user.uid} onClick={() => saveDisplayName(user)}>
                    {savingUid === user.uid ? <span className="spinner" /> : "Save"}
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }}
                    onClick={() => { setEditingUid(null); setDraftName(""); }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }}
                    onClick={() => startEditing(user)}>
                    Edit name
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: 13 }}
                    disabled={deletingUid === user.uid || user.uid === firebaseUser.uid}
                    onClick={() => deleteUser(user)}>
                    {deletingUid === user.uid ? <span className="spinner" /> : "Delete"}
                  </button>
                  {suggestedName && user.displayName !== suggestedName && (
                    <button className="btn btn-primary" style={{ flex: 1, fontSize: 13 }}
                      onClick={() => startEditing(user, suggestedName)}>
                      Use {suggestedName}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getAllSchools } from "@/lib/db";
import type { School } from "@/lib/types";
import { LogOut } from "lucide-react";
import { SchoolsTab } from "./components/SchoolsTab";
import { InviteTab } from "./components/InviteTab";
import { AddSchoolModal } from "./components/AddSchoolModal";
import { UsersPanel } from "./components/UsersPanel";

type Tab = "schools" | "invite" | "users";

export default function AdminDashboard() {
  const { appUser, firebaseUser, signOut } = useAuth();
  const router = useRouter();

  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("schools");
  const [showAddModal, setShowAddModal] = useState(false);
  const [setupSent, setSetupSent] = useState(false);
  const [preselectedSchoolId, setPreselectedSchoolId] = useState("");
  const [preselectedSchoolSlug, setPreselectedSchoolSlug] = useState("");

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "superadmin") { router.replace("/"); return; }
    getAllSchools().then(s => { setSchools(s); setLoading(false); });
  }, [appUser, router]);

  const handleSelectSchool = (school: School) => {
    setPreselectedSchoolId(school.id);
    setPreselectedSchoolSlug(school.slug);
    setTab("invite");
  };

  if (loading || !appUser) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <div style={{ padding: "16px 20px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>SuperAdmin</p>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>LittleLoop Network</h2>
          </div>
          <button onClick={() => { signOut(); router.replace("/login"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <LogOut size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0 }}>
          {(["schools", "invite", "users"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "10px 0", border: "none", background: "none",
              borderBottom: tab === t ? "2px solid var(--brand)" : "2px solid transparent",
              color: tab === t ? "var(--brand)" : "var(--text-muted)",
              fontWeight: tab === t ? 600 : 400, fontSize: 14, cursor: "pointer",
              textTransform: "capitalize",
            }}>
              {t === "schools" ? "Schools" : t === "invite" ? "Invite User" : "Users"}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ padding: "16px 20px" }}>
        {tab === "schools" && (
          <SchoolsTab
            schools={schools}
            setupSent={setupSent}
            onAddSchool={() => { setSetupSent(false); setShowAddModal(true); }}
            onSelectSchool={handleSelectSchool}
          />
        )}

        {tab === "invite" && firebaseUser && (
          <InviteTab
            schools={schools}
            firebaseUser={firebaseUser}
            initialSchoolId={preselectedSchoolId}
            initialSchoolSlug={preselectedSchoolSlug}
          />
        )}

        {tab === "users" && firebaseUser && (
          <UsersPanel
            schools={schools}
            firebaseUser={firebaseUser}
            targetEmail="rodwingoldstone@gmail.com"
            targetDisplayName="Rodwin Goldstone"
          />
        )}
      </div>

      {showAddModal && firebaseUser && (
        <AddSchoolModal
          firebaseUser={firebaseUser}
          onCreated={() => {
            getAllSchools().then(setSchools);
            setSetupSent(true);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

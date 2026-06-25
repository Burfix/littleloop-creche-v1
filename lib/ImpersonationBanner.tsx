"use client";
/**
 * Shown at top of any portal when superadmin is impersonating a user.
 * State stored in sessionStorage — clears when tab closes.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";

export function ImpersonationBanner() {
  const router = useRouter();
  const [info, setInfo] = useState<{ originalUid: string; targetName: string; targetRole: string } | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("impersonating");
      if (raw) setInfo(JSON.parse(raw));
    } catch {}
  }, []);

  if (!info) return null;

  async function exitImpersonation() {
    setLeaving(true);
    try {
      sessionStorage.removeItem("impersonating");
      await getAuth().signOut();
      router.push("/admin");
    } catch {
      sessionStorage.removeItem("impersonating");
      router.push("/admin");
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#7c3aed", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 16px", fontSize: 13, fontWeight: 500,
      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    }}>
      <span>
        👁 Viewing as <strong style={{ marginLeft: 4, marginRight: 4 }}>{info.targetName}</strong>
        <span style={{ opacity: 0.8 }}>({info.targetRole})</span>
      </span>
      <button onClick={exitImpersonation} disabled={leaving} style={{
        background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)",
        color: "#fff", borderRadius: 6, padding: "4px 12px", fontSize: 12,
        fontWeight: 700, cursor: leaving ? "not-allowed" : "pointer",
      }}>
        {leaving ? "Exiting…" : "✕ Exit impersonation"}
      </button>
    </div>
  );
}

"use client";
/**
 * Shown at top of every portal when superadmin is impersonating a user.
 * Exit restores the superadmin session via a stored custom token — no sign-out.
 */
import { useEffect, useState } from "react";
import { getAuth, signInWithCustomToken } from "firebase/auth";

export function ImpersonationBanner() {
  const [info, setInfo] = useState<{
    originalUid: string;
    targetName: string;
    targetRole: string;
    restoreToken: string;
  } | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("impersonating");
      if (raw) setInfo(JSON.parse(raw));
    } catch {}
  }, []);

  // Push body down so portal content isn't hidden under the banner
  useEffect(() => {
    if (info) document.body.style.paddingTop = "42px";
    else document.body.style.paddingTop = "";
    return () => { document.body.style.paddingTop = ""; };
  }, [info]);

  if (!info) return null;

  async function exit() {
    setLeaving(true);
    sessionStorage.removeItem("impersonating");
    try {
      // Restore superadmin session — no logout prompt
      await signInWithCustomToken(getAuth(), info!.restoreToken);
    } catch {
      // Fallback: plain sign-out if token is expired (>1h)
      try { await getAuth().signOut(); } catch {}
    }
    window.location.href = "/admin";
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#7c3aed", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px", height: 42, fontSize: 13, fontWeight: 500,
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16 }}>👁</span>
        Viewing as <strong>{info.targetName}</strong>
        <span style={{
          background: "rgba(255,255,255,0.2)", borderRadius: 20,
          padding: "1px 8px", fontSize: 11, fontWeight: 600,
        }}>{info.targetRole}</span>
      </span>
      <button
        onClick={exit}
        disabled={leaving}
        style={{
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.5)",
          color: "#fff", borderRadius: 6,
          padding: "5px 14px", fontSize: 12, fontWeight: 700,
          cursor: leaving ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        {leaving ? "Returning…" : "✕ Stop impersonating"}
      </button>
    </div>
  );
}

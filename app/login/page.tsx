"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { signIn, appUser, resetPassword } = useAuth();
  const { school } = useSchool();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  // If already logged in, bounce to role page. Owners route through "/" —
  // app/page.tsx decides between /onboarding (first login, incomplete
  // setup) and /owner, so that decision lives in exactly one place.
  if (appUser) {
    const routes: Record<string, string> = { parent: "/parent", teacher: "/teacher", superadmin: "/admin" };
    router.replace(routes[appUser.role] ?? "/");
    return null;
  }

  const handleSubmit = async () => {
    if (!email || (!resetMode && !password)) return;
    setLoading(true);
    try {
      if (resetMode) {
        await resetPassword(email);
        toast.success("Reset link sent — check your email");
        setResetMode(false);
      } else {
        await signIn(email, password);
        // Router redirect handled by useEffect in root page, but we push anyway
        router.push("/");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      const friendly =
        msg.includes("invalid-credential") ? "Incorrect email or password" :
        msg.includes("user-not-found") ? "No account found with that email" :
        msg.includes("too-many-requests") ? "Too many attempts — try again later" :
        "Sign-in failed. Please try again.";
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = school?.name ?? "LittleLoop";
  const logoUrl = school?.logoUrl;

  return (
    <div className="app-shell" style={{ justifyContent: "center", padding: "32px 24px" }}>
      {/* Logo / School name */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={schoolName}
            width={160}
            height={56}
            unoptimized
            style={{ height: 56, width: "auto", objectFit: "contain", marginBottom: 12 }}
          />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: "var(--brand)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px", fontSize: 28,
          }}>
            🌱
          </div>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>{schoolName}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
          {resetMode ? "We'll send a reset link to your email" : "Sign in to your account"}
        </p>
      </div>

      {/* Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          className="input"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />
        {!resetMode && (
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
          />
        )}

        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 4 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : resetMode ? "Send reset link" : "Sign in"}
        </button>

        <button
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--brand)", fontSize: 14, fontWeight: 500, padding: "8px 0",
          }}
          onClick={() => setResetMode(!resetMode)}
        >
          {resetMode ? "Back to sign in" : "Forgot password?"}
        </button>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 40 }}>
        Powered by LittleLoop · POPIA compliant
      </p>
    </div>
  );
}

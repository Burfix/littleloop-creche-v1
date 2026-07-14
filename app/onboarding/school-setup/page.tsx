"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSchool, getSchoolBySlug, updateSchoolDetails } from "@/lib/db";
import type { School } from "@/lib/types";
import { OnboardingProgressBar } from "../components/OnboardingProgressBar";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

// Screen 2 of the redesigned onboarding flow (see
// LittleLoop-Onboarding-Redesign-Spec.docx) — reached from Welcome's "Get
// started" CTA. Most owners are just confirming data that was already
// entered at signup, so both fields are pre-filled; nothing here is
// destructive and the owner can always come back via Settings later.

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function SchoolSetupPage() {
  const { appUser } = useAuth();
  const router = useRouter();

  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [saving, setSaving] = useState(false);
  const originalSlug = useRef("");

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }

    let cancelled = false;
    // setState calls live inside this nested async function (not directly
    // in the effect body) per the same pattern used in school-context.tsx —
    // avoids the cascading-render lint rule while keeping the cancelled-flag
    // guard against setting state after unmount.
    void Promise.resolve().then(async () => {
      if (!appUser.schoolId) { if (!cancelled) setLoading(false); return; }
      try {
        const s = await getSchool(appUser.schoolId);
        if (cancelled) return;
        setSchool(s);
        setName(s?.name ?? "");
        setSlug(s?.slug ?? "");
        originalSlug.current = s?.slug ?? "";
      } catch {
        if (!cancelled) toast.error("Could not load school details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [appUser, router]);

  // Debounced uniqueness check. Skipped entirely when the slug matches what's
  // already saved — that's always valid, it's this school's own slug — so
  // an owner who changes nothing never sees a spurious "checking" state.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      const candidate = slugify(slug);
      if (!candidate) { if (!cancelled) setSlugStatus("invalid"); return; }
      if (candidate === originalSlug.current) { if (!cancelled) setSlugStatus("idle"); return; }

      if (!cancelled) setSlugStatus("checking");
      await new Promise(resolve => setTimeout(resolve, 500));
      if (cancelled) return;

      try {
        const existing = await getSchoolBySlug(candidate);
        if (!cancelled) setSlugStatus(existing && existing.id !== school?.id ? "taken" : "available");
      } catch {
        if (!cancelled) setSlugStatus("idle");
      }
    });
    return () => { cancelled = true; };
  }, [slug, school?.id]);

  const canContinue =
    !!name.trim() &&
    slugStatus !== "checking" &&
    slugStatus !== "invalid" &&
    slugStatus !== "taken" &&
    !saving;

  const handleContinue = async () => {
    if (!school || !canContinue) return;
    setSaving(true);
    try {
      const cleanSlug = slugify(slug);
      const updates: { name?: string; slug?: string } = {};
      if (name.trim() !== school.name) updates.name = name.trim();
      if (cleanSlug !== school.slug) updates.slug = cleanSlug;
      if (Object.keys(updates).length > 0) {
        await updateSchoolDetails(school.id, updates);
      }
      router.push("/onboarding/add-child");
    } catch {
      toast.error("Could not save school details. Try again.");
      setSaving(false);
    }
  };

  if (loading || !appUser) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  return (
    <div className="app-shell" style={{ padding: "32px 24px" }}>
      <OnboardingProgressBar step={1} label="School details" />

      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
        Tell us about your school
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 28px" }}>
        This is what parents and teachers will see.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            School name
          </label>
          <input
            className="input"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Sunflower House"
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Domain slug
          </label>
          <input
            className="input"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="sunflower-house"
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, minHeight: 18 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {slugify(slug) || "your-school"}.littleloop.app
            </span>
            {slugStatus === "checking" && (
              <Loader2 size={13} color="var(--text-muted)" style={{ animation: "spin 0.8s linear infinite" }} />
            )}
            {slugStatus === "available" && <Check size={13} color="var(--success)" />}
            {slugStatus === "taken" && <span style={{ fontSize: 12, color: "var(--danger)" }}>Already taken</span>}
            {slugStatus === "invalid" && <span style={{ fontSize: 12, color: "var(--danger)" }}>Enter a valid name</span>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 40 }}>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleContinue} disabled={!canContinue}>
          {saving ? <span className="spinner" /> : "Continue"}
        </button>
        <button
          style={{
            width: "100%", background: "none", border: "none", color: "var(--text-muted)",
            fontSize: 13, marginTop: 8, padding: "10px 0",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}
          onClick={() => router.push("/onboarding")}
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    </div>
  );
}

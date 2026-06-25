"use client";

import { useState } from "react";
import { useSchool } from "@/lib/school-context";
import toast from "react-hot-toast";

interface FormState {
  childFirstName: string;
  childLastName: string;
  childDateOfBirth: string;
  desiredStartDate: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  notes: string;
}

const EMPTY: FormState = {
  childFirstName: "", childLastName: "", childDateOfBirth: "",
  desiredStartDate: "", parentName: "", parentEmail: "", parentPhone: "", notes: "",
};

export default function WaitlistPage() {
  const { school, loading } = useSchool();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [position, setPosition] = useState<number | null>(null);

  function set(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!school) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, schoolId: school.id }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Submission failed");
      }
      const { position: pos } = await res.json();
      setPosition(pos);
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!school) return (
    <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--text-muted)" }}>School not found.</p>
    </main>
  );

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid var(--border)", fontSize: 14,
    background: "var(--surface)", color: "var(--text)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
    display: "block", marginBottom: 4,
  };

  if (submitted) return (
    <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)" }}>
      <div style={{ maxWidth: 400, textAlign: "center" }}>
        <p style={{ fontSize: 56, marginBottom: 12 }}>🎉</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>You're on the list!</h1>
        {position && (
          <div style={{ background: "var(--primary-light)", borderRadius: 12, padding: "14px 20px", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--primary)", fontWeight: 600 }}>
              Your position: <strong style={{ fontSize: 22 }}>#{position}</strong>
            </p>
          </div>
        )}
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
          We'll be in touch at <strong>{form.parentEmail}</strong> when a spot opens up at {school.name}.
        </p>
      </div>
    </main>
  );

  return (
    <main style={{ minHeight: "100dvh", padding: "32px 20px 80px", background: "var(--bg)", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Join the Waiting List</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{school.name}</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Child</legend>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>First name *</label><input style={inputStyle} required value={form.childFirstName} onChange={set("childFirstName")} /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Last name *</label><input style={inputStyle} required value={form.childLastName} onChange={set("childLastName")} /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Date of birth *</label><input style={inputStyle} type="date" required value={form.childDateOfBirth} onChange={set("childDateOfBirth")} /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Desired start</label><input style={inputStyle} type="date" value={form.desiredStartDate} onChange={set("desiredStartDate")} /></div>
          </div>
        </fieldset>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Parent / Guardian</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><label style={labelStyle}>Full name *</label><input style={inputStyle} required value={form.parentName} onChange={set("parentName")} /></div>
            <div><label style={labelStyle}>Email *</label><input style={inputStyle} type="email" required value={form.parentEmail} onChange={set("parentEmail")} /></div>
            <div><label style={labelStyle}>Phone *</label><input style={inputStyle} type="tel" required value={form.parentPhone} onChange={set("parentPhone")} /></div>
          </div>
        </fieldset>

        <div>
          <label style={labelStyle}>Additional notes</label>
          <textarea style={{ ...inputStyle, resize: "none" }} rows={3} value={form.notes} onChange={set("notes")} placeholder="Any information you'd like us to know…" />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{ padding: "14px 0", borderRadius: 12, background: "var(--primary)", color: "#fff", border: "none", fontWeight: 700, fontSize: 16, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? "Submitting…" : "Join Waiting List"}
        </button>

        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Already have a place?{" "}
          <a href="/apply" style={{ color: "var(--primary)" }}>Apply for admission instead</a>
        </p>
      </form>
    </main>
  );
}

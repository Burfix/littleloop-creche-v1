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
  childFirstName: "",
  childLastName: "",
  childDateOfBirth: "",
  desiredStartDate: "",
  parentName: "",
  parentEmail: "",
  parentPhone: "",
  notes: "",
};

export default function ApplyPage() {
  const { school, loading } = useSchool();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async () => {
    const required: (keyof FormState)[] = [
      "childFirstName", "childLastName", "childDateOfBirth",
      "parentName", "parentEmail", "parentPhone",
    ];
    const missing = required.filter(k => !form[k].trim());
    if (missing.length) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!form.parentEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!school) {
      toast.error("School not found. Please check the link you used.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admissions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, schoolId: school.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Submission failed");
      }
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  if (!school) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 32, margin: "0 0 12px" }}>🏫</p>
        <h2 style={{ margin: "0 0 8px" }}>School not found</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Please check the link you used to get here.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 48, margin: "0 0 16px" }}>🎉</p>
        <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>Application received!</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 15, maxWidth: 320, margin: "0 auto" }}>
          Thank you for applying to <strong>{school.name}</strong>.
          We&apos;ll be in touch with you at <strong>{form.parentEmail}</strong> soon.
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ padding: "24px 20px 40px" }}>
      {/* School header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "var(--brand)", display: "flex",
          alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px", fontSize: 26,
        }}>
          🌱
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
          Apply to {school.name}
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
          Fill in the form below and we&apos;ll be in touch.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Child details */}
        <section>
          <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 15 }}>Child details</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  First name *
                </label>
                <input className="input" value={form.childFirstName} onChange={set("childFirstName")} placeholder="Emma" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Last name *
                </label>
                <input className="input" value={form.childLastName} onChange={set("childLastName")} placeholder="Smith" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Date of birth *
              </label>
              <input className="input" type="date" value={form.childDateOfBirth} onChange={set("childDateOfBirth")} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Desired start date
              </label>
              <input className="input" type="date" value={form.desiredStartDate} onChange={set("desiredStartDate")} />
            </div>
          </div>
        </section>

        <div style={{ borderTop: "1px solid var(--border)" }} />

        {/* Guardian details */}
        <section>
          <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 15 }}>Parent / guardian</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Full name *
              </label>
              <input className="input" value={form.parentName} onChange={set("parentName")} placeholder="Sarah Smith" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Email address *
              </label>
              <input className="input" type="email" value={form.parentEmail} onChange={set("parentEmail")} placeholder="sarah@example.com" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Phone / WhatsApp *
              </label>
              <input className="input" type="tel" value={form.parentPhone} onChange={set("parentPhone")} placeholder="+27 82 123 4567" />
            </div>
          </div>
        </section>

        <div style={{ borderTop: "1px solid var(--border)" }} />

        {/* Notes */}
        <section>
          <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 15 }}>Anything else?</p>
          <textarea
            className="input"
            rows={3}
            placeholder="Allergies, special needs, questions for us…"
            value={form.notes}
            onChange={set("notes")}
            style={{ resize: "none", fontSize: 14 }}
          />
        </section>

        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 4 }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <span className="spinner" /> : "Submit application"}
        </button>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          Your information is stored securely and only shared with {school.name} staff.
        </p>
      </div>
    </div>
  );
}

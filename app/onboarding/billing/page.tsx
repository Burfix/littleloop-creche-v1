"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSchool, getChildrenForSchoolPage } from "@/lib/db";
import type { Child, Invoice, School } from "@/lib/types";
import { OnboardingProgressBar } from "../components/OnboardingProgressBar";
import { CreateInvoiceForm } from "@/app/owner/components/CreateInvoiceForm";
import { BillingPrerequisiteNotice } from "@/app/owner/components/BillingPrerequisiteNotice";
import { ArrowLeft, CircleCheck, Plus } from "lucide-react";
import toast from "react-hot-toast";

// Screen 7 of the redesigned onboarding flow (see
// LittleLoop-Onboarding-Redesign-Spec.docx) — reached from Invite's
// "Continue". Reuses CreateInvoiceForm (extracted from BillingTab so the
// invoice-creation logic has exactly one implementation) rather than
// duplicating it here.
export default function OnboardingBillingPage() {
  const { appUser } = useAuth();
  const router = useRouter();

  const [school, setSchool] = useState<School | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!appUser) { router.replace("/login"); return; }

    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (!appUser.schoolId) { if (!cancelled) { setLoading(false); router.replace("/owner"); } return; }
      try {
        const [s, childPage] = await Promise.all([
          getSchool(appUser.schoolId),
          getChildrenForSchoolPage(appUser.schoolId, { includePendingErasure: true }),
        ]);
        if (cancelled) return;
        setSchool(s);
        setChildren(childPage.items);
      } catch {
        if (!cancelled) toast.error("Could not load school details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [appUser, router]);

  useEffect(() => {
    // Defensive: a resolved schoolId that fails to load (deleted/corrupt
    // doc) shouldn't strand the owner on an infinite spinner.
    if (!loading && appUser?.schoolId && !school) {
      router.replace("/owner");
    }
  }, [loading, appUser, school, router]);

  if (loading || !appUser || !school) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  const activeChildren = children.filter(c => c.deletionStatus !== "pending_erasure");
  const childrenWithParent = activeChildren.filter(c => (c.parentIds?.length ?? 0) > 0);

  return (
    <div className="app-shell" style={{ padding: "32px 24px" }}>
      <OnboardingProgressBar step={5} label="Billing" />

      {!created ? (
        <>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
            Configure billing
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
            Create your first invoice. Parents get notified and can upload proof of payment.
          </p>

          {activeChildren.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>
              You&apos;ll need at least one child (with a parent linked) before creating an invoice.
              You can always do this from the Billing tab later.
            </p>
          ) : childrenWithParent.length === 0 ? (
            <div style={{ marginBottom: 20 }}>
              <BillingPrerequisiteNotice
                onPrimaryAction={() => router.push("/onboarding/invite")}
                onSecondaryAction={() => router.push("/onboarding/complete")}
              />
            </div>
          ) : (
            <CreateInvoiceForm
              schoolId={school.id}
              childRecords={childrenWithParent}
              onInvoiceCreated={setCreated}
            />
          )}

          <div style={{ marginTop: 24 }}>
            <button
              style={{
                width: "100%", background: "none", border: "none", color: "var(--text-muted)",
                fontSize: 13, padding: "10px 0",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}
              onClick={() => router.push("/onboarding/invite")}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, padding: "6px 0" }}
              onClick={() => router.push("/onboarding/complete")}
            >
              I&apos;ll do this later
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 24 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 14,
              background: "var(--brand-light)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <CircleCheck size={24} color="var(--success)" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
            Invoice created
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 28px", maxWidth: 280 }}>
            R{(created.amountCents / 100).toLocaleString()} due {created.dueDate}. You can create more any time from Billing.
          </p>

          <button
            className="btn btn-secondary"
            style={{ width: "100%", marginBottom: 10 }}
            onClick={() => setCreated(null)}
          >
            <Plus size={16} /> Create another invoice
          </button>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={() => router.push("/onboarding/complete")}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

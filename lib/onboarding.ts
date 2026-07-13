import { collection, query, where, getCountFromServer } from "firebase/firestore";
import { db } from "./firebase";
import type { School } from "./types";

// Onboarding progress is derived from data presence, not a stored "current
// step" pointer. This means it can never drift from reality — a school that
// already has children (imported by hand, or created before this flow
// existed) shows that step as done automatically, and an incomplete/partial
// record just shows as "not done yet" rather than crashing anything that
// reads it. See lib/db.ts normalizeSchool() for the same philosophy applied
// to School.branches.

export type OnboardingStepKey =
  | "schoolSetup"
  | "firstChild"
  | "classes"
  | "teachers"
  | "parents"
  | "billing";

export interface OnboardingStep {
  key: OnboardingStepKey;
  label: string;
  done: boolean;
  /** Which existing tab/section this step's action currently lives in. */
  href: { tab: "settings" | "billing" };
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  nextIncomplete: OnboardingStep | null;
}

// Exported so lib/school-launch.ts can reuse the exact same counting logic
// rather than re-implementing it — both modules derive step/task completion
// from the same underlying data-presence signals.
export async function countWhere(collectionName: string, schoolId: string, extra?: [string, string]): Promise<number> {
  const constraints = [where("schoolId", "==", schoolId)];
  if (extra) constraints.push(where(extra[0], "==", extra[1]));
  const snap = await getCountFromServer(query(collection(db, collectionName), ...constraints));
  return snap.data().count;
}

// Shared reducer for optimistic client-side updates — every action that
// completes a step (add child, create class, send an invite, create an
// invoice) calls this instead of re-deriving completedCount/isComplete/
// nextIncomplete by hand at each call site. The next real load still
// re-derives from actual data via getOnboardingStatus(), so a failed or
// out-of-band change can never leave the checklist stuck on a false
// positive for more than one page visit.
export function markStepDone(status: OnboardingStatus, key: OnboardingStepKey): OnboardingStatus {
  const steps = status.steps.map(s => s.key === key ? { ...s, done: true } : s);
  const completedCount = steps.filter(s => s.done).length;
  return {
    steps,
    completedCount,
    totalCount: steps.length,
    isComplete: completedCount === steps.length,
    nextIncomplete: steps.find(s => !s.done) ?? null,
  };
}

export async function getOnboardingStatus(schoolId: string, school: School | null): Promise<OnboardingStatus> {
  const [childCount, classCount, teacherCount, parentCount, invoiceCount] = await Promise.all([
    countWhere("children", schoolId),
    countWhere("classes", schoolId),
    countWhere("users", schoolId, ["role", "teacher"]),
    countWhere("users", schoolId, ["role", "parent"]),
    countWhere("invoices", schoolId),
  ]);

  const steps: OnboardingStep[] = [
    { key: "schoolSetup", label: "School details", done: !!school?.name, href: { tab: "settings" } },
    { key: "firstChild", label: "Add your first child", done: childCount > 0, href: { tab: "settings" } },
    { key: "classes", label: "Create a class", done: classCount > 0, href: { tab: "settings" } },
    { key: "teachers", label: "Invite your teachers", done: teacherCount > 0, href: { tab: "settings" } },
    { key: "parents", label: "Invite parents", done: parentCount > 0, href: { tab: "settings" } },
    { key: "billing", label: "Turn on billing", done: invoiceCount > 0, href: { tab: "billing" } },
  ];

  const completedCount = steps.filter(s => s.done).length;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    isComplete: completedCount === steps.length,
    nextIncomplete: steps.find(s => !s.done) ?? null,
  };
}

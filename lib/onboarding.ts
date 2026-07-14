import { collection, query, where, getCountFromServer } from "firebase/firestore";
import { db } from "./firebase";

// The original derived-checklist onboarding model (OnboardingStatus/
// OnboardingStep/getOnboardingStatus/markStepDone) has been replaced by
// lib/school-launch.ts's SchoolLaunchStatus — the paid "School Launch
// Package" experience. countWhere is kept here (and re-exported/reused by
// school-launch.ts) since both models derive completion from the same
// underlying data-presence signals, and there was no reason to duplicate
// or relocate it.
export async function countWhere(collectionName: string, schoolId: string, extra?: [string, string]): Promise<number> {
  const constraints = [where("schoolId", "==", schoolId)];
  if (extra) constraints.push(where(extra[0], "==", extra[1]));
  const snap = await getCountFromServer(query(collection(db, collectionName), ...constraints));
  return snap.data().count;
}

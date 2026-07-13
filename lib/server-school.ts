import { adminDb } from "@/lib/firebase-admin";
import type { School } from "@/lib/types";

function toIsoString(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export async function getSchoolBySlugServer(slug: string): Promise<School | null> {
  try {
    const snap = await adminDb()
      .collection("schools")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    const data = doc.data();

    return {
      ...data,
      id: doc.id,
      branches: Array.isArray(data.branches) ? data.branches : [],
      createdAt: toIsoString(data.createdAt),
    } as School;
  } catch (err) {
    console.error("Server tenant lookup failed:", err);
    return null;
  }
}

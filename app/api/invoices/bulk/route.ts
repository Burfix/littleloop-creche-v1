import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/invoices/bulk
 * Generate one invoice per active child in the school for a given month.
 * Skips children who already have an invoice for that month.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const db = adminDb();
  const auth = adminAuth();

  try {
    const decoded = await auth.verifyIdToken(token);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    if (!["owner", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }
    const schoolId: string = userSnap.data()?.schoolId;

    const { month, amountCents, dueDate, description } = await req.json();
    if (!month || !amountCents || !dueDate) {
      return NextResponse.json({ error: "month, amountCents, dueDate required" }, { status: 400 });
    }

    // Get all active children
    const childrenSnap = await db.collection("children")
      .where("schoolId", "==", schoolId)
      .where("deletionStatus", "not-in", ["pending_erasure"])
      .get();

    if (childrenSnap.empty) return NextResponse.json({ success: true, created: 0, skipped: 0 });

    // Check existing invoices for this month to avoid duplicates
    const existingSnap = await db.collection("invoices")
      .where("schoolId", "==", schoolId)
      .where("month", "==", month)
      .get();
    const existingChildIds = new Set(existingSnap.docs.map(d => d.data().childId as string));

    const toCreate = childrenSnap.docs.filter(d => !existingChildIds.has(d.id));

    // Batch write (max 500 per batch)
    let created = 0;
    const BATCH_SIZE = 450;
    for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = toCreate.slice(i, i + BATCH_SIZE);
      chunk.forEach(childDoc => {
        const child = childDoc.data();
        const ref = db.collection("invoices").doc();
        batch.set(ref, {
          schoolId,
          branchId: child.branchId ?? "",
          parentId: child.parentIds?.[0] ?? "",
          childId: childDoc.id,
          childName: `${child.firstName} ${child.lastName}`,
          month,
          description: description ?? `Tuition — ${month}`,
          amountCents,
          dueDate,
          lineItems: [],
          notes: "",
          status: "outstanding",
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      created += chunk.length;
    }

    await db.collection("audit_logs").add({
      action: "invoices_bulk_generated",
      schoolId, month, amountCents, created,
      performedBy: decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, created, skipped: existingChildIds.size });
  } catch (err) {
    console.error("Bulk invoice error:", err);
    return NextResponse.json({ error: "Failed to generate invoices" }, { status: 500 });
  }
}

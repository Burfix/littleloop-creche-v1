import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit";

// ─── POST /api/invoices — create a single invoice ────────────────────────────
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { namespace: "create-invoice", limit: 60, windowSeconds: 60 });
  if (limited) return limited;

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

    const body = await req.json();
    const { childId, month, description, amountCents, dueDate, lineItems, notes } = body;

    if (!childId || !month || !amountCents || !dueDate) {
      return NextResponse.json({ error: "childId, month, amountCents, dueDate required" }, { status: 400 });
    }

    // Get child to resolve parentId + name
    const childSnap = await db.collection("children").doc(childId).get();
    if (!childSnap.exists) return NextResponse.json({ error: "Child not found" }, { status: 404 });
    const child = childSnap.data()!;

    if (child.schoolId !== schoolId) {
      return NextResponse.json({ error: "Child not in your school" }, { status: 403 });
    }

    const parentId = child.parentIds?.[0] ?? "";
    const childName = `${child.firstName} ${child.lastName}`;

    const ref = await db.collection("invoices").add({
      schoolId,
      branchId: child.branchId ?? "",
      parentId,
      childId,
      childName,
      month,
      description: description ?? `Tuition — ${month}`,
      amountCents,
      dueDate,
      lineItems: lineItems ?? [],
      notes: notes ?? "",
      status: "outstanding",
      createdAt: FieldValue.serverTimestamp(),
    });

    // Audit
    await db.collection("audit_logs").add({
      action: "invoice_created",
      invoiceId: ref.id,
      childId,
      schoolId,
      performedBy: decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, invoiceId: ref.id });
  } catch (err) {
    console.error("Create invoice error:", err);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}

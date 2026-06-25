import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { notifyParentOfInvoice } from "@/lib/notify";

type RouteContext = { params: Promise<{ invoiceId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { invoiceId } = await params;
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const db = adminDb();
  const auth = adminAuth();

  try {
    const decoded = await auth.verifyIdToken(token);
    const [userSnap, invoiceSnap] = await Promise.all([
      db.collection("users").doc(decoded.uid).get(),
      db.collection("invoices").doc(invoiceId).get(),
    ]);

    const role = userSnap.data()?.role;
    if (!["owner", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }

    if (!invoiceSnap.exists) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const invoice = invoiceSnap.data()!;
    if (invoice.schoolId !== userSnap.data()?.schoolId) {
      return NextResponse.json({ error: "School mismatch" }, { status: 403 });
    }
    if (invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
    }

    const schoolSnap = await db.collection("schools").doc(invoice.schoolId).get();
    const schoolName = schoolSnap.data()?.name ?? "Your school";
    const amountFormatted = `R${(invoice.amountCents / 100).toLocaleString("en-ZA")}`;

    await notifyParentOfInvoice(invoice.parentId, schoolName, amountFormatted);

    // Log the reminder
    await db.collection("audit_logs").add({
      action: "fee_reminder_sent",
      invoiceId,
      parentId: invoice.parentId,
      schoolId: invoice.schoolId,
      performedBy: decoded.uid,
      createdAt: (await import("firebase-admin/firestore")).FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Remind error:", err);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}

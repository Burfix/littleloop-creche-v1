import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/api-auth";
import { adminMessaging } from "@/lib/firebase-admin";

const ALLOWED_ROLES = ["teacher", "owner", "superadmin"];

export async function POST(req: NextRequest) {
  try {
    const authorized = await requireAppUser(req);
    if ("error" in authorized) return authorized.error;

    if (!ALLOWED_ROLES.includes(authorized.user?.role)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const { targetUid, title, body } = await req.json();

    if (!targetUid || typeof targetUid !== "string") {
      return NextResponse.json({ error: "targetUid required" }, { status: 400 });
    }
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    // Fetch target user's FCM token
    const targetSnap = await authorized.db.collection("users").doc(targetUid).get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const fcmToken: string | undefined = targetSnap.data()?.fcmToken;
    if (!fcmToken) {
      // User hasn't enabled push — not a failure, just silent
      return NextResponse.json({ sent: false, reason: "no_token" });
    }

    await adminMessaging().send({
      token: fcmToken,
      notification: {
        title,
        body: body ?? "",
      },
      webpush: {
        notification: {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        },
        fcmOptions: {
          link: "/parent",
        },
      },
    });

    return NextResponse.json({ sent: true });
  } catch (err: unknown) {
    // Clean up stale token so we don't retry it
    const code = (err as { code?: string })?.code;
    if (code === "messaging/registration-token-not-registered") {
      try {
        const { targetUid } = await req.json().catch(() => ({}));
        if (targetUid) {
          const { adminDb } = await import("@/lib/firebase-admin");
          await adminDb().collection("users").doc(targetUid).update({ fcmToken: null });
        }
      } catch { /* best-effort cleanup */ }
      return NextResponse.json({ sent: false, reason: "stale_token" });
    }

    console.error("[notifications/send]", err);
    return NextResponse.json({ sent: false, reason: "send_failed" });
  }
}

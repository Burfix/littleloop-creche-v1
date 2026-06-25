import { NextRequest, NextResponse } from "next/server";
import { getMessaging } from "firebase-admin/messaging";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

interface SendPayload {
  /** UIDs of users to notify. Tokens are looked up from fcm_tokens collection. */
  targetUids: string[];
  title: string;
  body: string;
  /** Optional deep-link URL opened on notification tap */
  url?: string;
  /** Optional dedup tag — same tag replaces the previous notification */
  tag?: string;
}

export async function POST(req: NextRequest) {
  // Internal-only endpoint — must be called server-to-server with admin token
  // or from another API route using the service account.
  // For safety we verify the caller is authenticated as owner/superadmin.
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Allow internal server-to-server calls via a shared secret
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const callerSecret = req.headers.get("x-internal-secret");
  const isInternal = internalSecret && callerSecret === internalSecret;

  if (!isInternal) {
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    try {
      const db = adminDb();
      const auth = adminAuth();
      const decoded = await auth.verifyIdToken(token);
      const userSnap = await db.collection("users").doc(decoded.uid).get();
      const role = userSnap.data()?.role;
      if (!["owner", "superadmin"].includes(role)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  }

  try {
    const { targetUids, title, body, url, tag }: SendPayload = await req.json();

    if (!targetUids?.length || !title || !body) {
      return NextResponse.json({ error: "targetUids, title and body are required" }, { status: 400 });
    }

    // Look up FCM tokens for all target UIDs
    const db = adminDb();
    const tokenSnaps = await db
      .collection("fcm_tokens")
      .where("uid", "in", targetUids.slice(0, 10)) // Firestore 'in' limit = 10
      .get();

    const tokens = tokenSnaps.docs.map(d => d.data().token as string).filter(Boolean);

    if (!tokens.length) {
      return NextResponse.json({ success: true, sent: 0, reason: "No registered tokens" });
    }

    // Send via FCM multicast
    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          title,
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: tag ?? "littleloop",
          renotify: true,
          data: { url: url ?? "/" },
        },
        fcmOptions: { link: url ?? "/" },
      },
    });

    // Clean up stale tokens (registration-not-found errors)
    const staleTokenIds: string[] = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
        staleTokenIds.push(tokens[i]);
      }
    });
    if (staleTokenIds.length) {
      const batch = db.batch();
      const staleSnaps = await db
        .collection("fcm_tokens")
        .where("token", "in", staleTokenIds)
        .get();
      staleSnaps.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      staleRemoved: staleTokenIds.length,
    });
  } catch (err) {
    console.error("Send notification error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send notification" },
      { status: 500 }
    );
  }
}

import { addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { getOwnerForSchool } from "./db";
import type { LaunchNotification, LaunchNotificationCategory } from "./types";

// ─── Owner-facing launch notifications ─────────────────────────────────────
//
// Two channels, one call site (notifyOwnerOfLaunchEvent below):
//   1. A durable Firestore record (this is the source of truth — always
//      written, never depends on browser permissions or network luck).
//   2. A best-effort push via the existing /api/notifications/send route
//      (already used for teacher -> parent chat pushes), only if the owner
//      has registered a device and we have a fresh ID token to authenticate
//      the call with.
// If push fails or the owner never granted permission, the in-app record
// still exists — that's the whole point of not making push the only channel.

export async function createLaunchNotification(
  schoolId: string,
  category: LaunchNotificationCategory,
  title: string,
  body: string,
  link?: string,
): Promise<string> {
  const ref = await addDoc(collection(db, "launchNotifications"), {
    schoolId,
    category,
    title,
    body,
    ...(link ? { link } : {}),
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

/** Mirrors lib/db.ts subscribeToThread — realtime, so the owner's bell
 * updates without a manual refresh, which is the actual problem this
 * feature exists to solve. */
export function subscribeToLaunchNotifications(
  schoolId: string,
  callback: (notifications: LaunchNotification[]) => void,
  take = 20,
) {
  const q = query(
    collection(db, "launchNotifications"),
    where("schoolId", "==", schoolId),
    orderBy("createdAt", "desc"),
    limit(take),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as LaunchNotification));
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, "launchNotifications", notificationId), { readAt: new Date().toISOString() });
}

export async function markAllNotificationsRead(notifications: LaunchNotification[]): Promise<void> {
  const unread = notifications.filter(n => !n.readAt);
  await Promise.all(unread.map(n => markNotificationRead(n.id)));
}

/** One entry per unread notification, fetched lazily — used to size the
 * bell badge without pulling the full list every time. */
export async function getUnreadLaunchNotificationCount(schoolId: string): Promise<number> {
  const q = query(collection(db, "launchNotifications"), where("schoolId", "==", schoolId));
  const snap = await getDocs(q);
  return snap.docs.filter(d => !d.data().readAt).length;
}

export interface NotifyOwnerParams {
  schoolId: string;
  category: LaunchNotificationCategory;
  title: string;
  body: string;
  link?: string;
  /** Fresh ID token of the staff member making the change, for the push
   * endpoint's auth check — omit to persist the in-app record only. */
  actorIdToken?: string;
}

export async function notifyOwnerOfLaunchEvent(params: NotifyOwnerParams): Promise<void> {
  const { schoolId, category, title, body, link, actorIdToken } = params;

  // The durable record always gets written — this is not allowed to
  // silently fail the way push is, since it's the fallback of last resort.
  await createLaunchNotification(schoolId, category, title, body, link);

  if (!actorIdToken) return;
  try {
    const owner = await getOwnerForSchool(schoolId);
    if (!owner) return;
    await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${actorIdToken}` },
      body: JSON.stringify({ targetUid: owner.uid, title, body, link: link ?? "/owner" }),
    });
  } catch (err) {
    // Best-effort only — the in-app notification above already landed.
    console.warn("[launch-notifications] push send failed", err);
  }
}

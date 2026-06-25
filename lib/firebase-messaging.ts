"use client";

import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import type { MessagePayload } from "firebase/messaging";
import { db, auth } from "@/lib/firebase";
import app from "@/lib/firebase";
import {
  collection, doc, setDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

// ─── Token storage ────────────────────────────────────────────────────────────
export async function saveFcmToken(uid: string, schoolId: string, token: string): Promise<void> {
  // Use token hash as document ID so one device = one doc, idempotent
  const tokenDocId = btoa(token).slice(0, 40).replace(/[^a-zA-Z0-9]/g, "");
  await setDoc(
    doc(collection(db, "fcm_tokens"), tokenDocId),
    {
      uid,
      schoolId,
      token,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteFcmToken(token: string): Promise<void> {
  const tokenDocId = btoa(token).slice(0, 40).replace(/[^a-zA-Z0-9]/g, "");
  await deleteDoc(doc(collection(db, "fcm_tokens"), tokenDocId));
}

// ─── Service worker bootstrap ─────────────────────────────────────────────────
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/firebase-messaging-sw.js");
}

function sendConfigToSW(sw: ServiceWorkerRegistration): void {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const target = sw.active ?? sw.installing ?? sw.waiting;
  target?.postMessage({ type: "FIREBASE_CONFIG", config });
}

// ─── Main entry point ─────────────────────────────────────────────────────────
/**
 * Request notification permission, register the SW, get an FCM token,
 * and save it to Firestore. Safe to call on every login — idempotent.
 *
 * Returns the token string on success, null if not supported or denied.
 */
export async function initFcm(uid: string, schoolId: string): Promise<string | null> {
  try {
    // FCM web push requires browser support
    if (!(await isSupported())) return null;
    if (!("serviceWorker" in navigator)) return null;
    if (!VAPID_KEY) {
      console.warn("FCM: NEXT_PUBLIC_FIREBASE_VAPID_KEY not set — skipping push setup");
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    // Register SW and send Firebase config
    const swReg = await registerServiceWorker();
    sendConfigToSW(swReg);

    // Get FCM token
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) return null;

    // Persist token
    await saveFcmToken(uid, schoolId, token);

    // Handle foreground messages (app is open)
    onMessage(messaging, (payload: MessagePayload) => {
      const title = payload.notification?.title ?? "LittleLoop";
      const body = payload.notification?.body ?? "";
      toast(
        `${title}${body ? `\n${body}` : ""}`,
        { duration: 5000, icon: "🔔" }
      );
    });

    return token;
  } catch (err) {
    // Non-fatal — app works without push
    console.warn("FCM init failed:", err);
    return null;
  }
}

/**
 * Revoke push notifications for this device.
 */
export async function revokeFcm(token: string): Promise<void> {
  try {
    const messaging = getMessaging(app);
    const { deleteToken } = await import("firebase/messaging");
    await deleteToken(messaging);
    await deleteFcmToken(token);
  } catch (err) {
    console.warn("FCM revoke failed:", err);
  }
}

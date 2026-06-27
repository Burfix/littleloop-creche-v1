"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import app from "./firebase";
import { updateUser } from "./db";

/**
 * Register this device for push notifications and persist the FCM token.
 * Call once after the user is authenticated — silently no-ops if the browser
 * doesn't support push or the user declines permission.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "denied") return;

  try {
    const supported = await isSupported();
    if (!supported) return;

    // Register the Firebase messaging service worker
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await updateUser(userId, { fcmToken: token });
    }
  } catch (err) {
    // Push is a nice-to-have — never surface errors to the user
    console.warn("[push] Registration failed:", err);
  }
}

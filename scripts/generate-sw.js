#!/usr/bin/env node
/**
 * Generates public/firebase-messaging-sw.js at build time,
 * injecting NEXT_PUBLIC_ Firebase config so the service worker
 * can initialise Firebase without exposing secrets.
 *
 * Runs automatically via the "prebuild" npm script on Vercel and locally.
 */

const fs = require("fs");
const path = require("path");

const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.warn(
    `[generate-sw] Warning: missing env vars: ${missing.join(", ")}. ` +
    "Service worker will be generated with empty values — push notifications won't work until these are set."
  );
}

const config = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "",
};

const content = `// AUTO-GENERATED — do not edit. See scripts/generate-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config, null, 2)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'LittleLoop';
  const body  = payload.notification?.body  ?? '';
  self.registration.showNotification(title, {
    body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    data:  payload.data ?? {},
  });
});
`;

const dest = path.join(__dirname, "..", "public", "firebase-messaging-sw.js");
fs.writeFileSync(dest, content, "utf8");
console.log("[generate-sw] ✓ public/firebase-messaging-sw.js written");

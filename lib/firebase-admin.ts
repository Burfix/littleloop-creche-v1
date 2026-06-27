import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "")
    .replace(/^"|"$/g, "")   // strip surrounding quotes if present
    .replace(/\\n/g, "\n");  // convert escaped \n to real newlines

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

export function adminMessaging() {
  return getMessaging(getAdminApp());
}

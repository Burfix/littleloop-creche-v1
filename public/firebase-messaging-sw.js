// LittleLoop FCM Service Worker
// Firebase compat scripts are required in SW context (no ESM support)
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

// Config is injected at registration time via query params or hardcoded here.
// The SW cannot access Next.js env vars so we read from a well-known URL.
self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG") {
    if (self.__firebaseConfigured) return;
    self.__firebaseConfigured = true;

    const app = firebase.initializeApp(event.data.config);
    const messaging = firebase.messaging(app);

    // Handle background messages (app not in foreground)
    messaging.onBackgroundMessage((payload) => {
      const { title, body, icon, data } = payload.notification ?? {};
      const notificationTitle = title ?? "LittleLoop";
      const notificationOptions = {
        body: body ?? "",
        icon: icon ?? "/icon-192.png",
        badge: "/icon-192.png",
        data: data ?? {},
        tag: data?.tag ?? "littleloop",
        renotify: true,
      };
      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
});

// Handle notification click — open or focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

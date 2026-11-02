// Loaded into the generated service worker: shows notifications and opens the app when one is tapped.
self.addEventListener("push", (event) => {
  let message;
  try {
    message = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: "pwa-192x192.png",
      badge: "pwa-64x64.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const appUrl = self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(appUrl));
      return open ? open.focus() : self.clients.openWindow(appUrl);
    }),
  );
});

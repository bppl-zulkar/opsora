const CACHE = "opsora-shell-v5";
const ASSETS = ["/offline", "/opsora-logo.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline")),
    );
    return;
  }
  const url = new URL(event.request.url);
  if (
    url.origin === location.origin &&
    /\.(?:css|js|svg|png|webp|woff2)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            const copy = response.clone();
            void caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, copy));
            return response;
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "Opsora", {
        body: data.body || "A task update is available",
        icon: "/opsora-logo.png",
        badge: "/opsora-logo.png",
        silent: false,
        vibrate: [220, 100, 220, 100, 320],
        renotify: true,
        tag: data.url || "opsora-update",
        data: { url: data.url || "/notifications" },
      });
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      clients
        .filter((client) => client.visibilityState === "visible")
        .forEach((client) =>
          client.postMessage({ type: "OPSORA_PUSH_SOUND" }),
        );
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});

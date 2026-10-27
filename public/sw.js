// App shell: pages network-first (falling back to the last copy when offline),
// build assets and samples cache-first, so training works offline.
const SHELL = "chroma-shell-v1";
const SAMPLES = "chroma-samples-v1";
const DEV = self.location.hostname === "localhost";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (!DEV) event.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/"])).catch(() => {}));
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("chroma-") && key !== SHELL && key !== SAMPLES) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  ),
);

const STATIC = /^\/(_next\/static\/|icons\/|icon\.png|apple-icon\.png)/;

async function cacheFirst(name, req) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (DEV || req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL);
        try {
          const res = await Promise.race([
            fetch(req),
            new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 3500)),
          ]);
          if (res.ok) cache.put("/", res.clone());
          return res;
        } catch {
          return (await cache.match("/")) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/samples/")) return event.respondWith(cacheFirst(SAMPLES, req));
  if (STATIC.test(url.pathname)) event.respondWith(cacheFirst(SHELL, req));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const url = data.url || "/";
  event.waitUntil(
    self.registration.showNotification(data.title || "Chroma", {
      body: data.body || "",
      icon: "/icons/192.png",
      badge: "/icons/badge.png",
      tag: data.tag ?? url,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.postMessage({ type: "open", url });
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

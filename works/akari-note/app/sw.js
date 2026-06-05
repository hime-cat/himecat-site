const CACHE_NAME = "akari-note-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./policy.html",
  "./css/style.css",
  "./js/script.js",
  "./js/supabase-config.js",
  "./images/favicon-256.png",
  "./images/apple-touch-icon-180.png",
  "./images/pwa-icon-192.png",
  "./images/pwa-icon-512.png",
  "./images/ogp.png",
  "./images/hanging_lantern.webp",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy);
          });
          return response;
        })
        .catch(() =>
          caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match("./index.html");
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchedResponse = fetch(request)
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy);
          });
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchedResponse;
    })
  );
});

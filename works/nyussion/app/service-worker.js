const CACHE_NAME = "nyussion-v3";

const CACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/reset.css",
  "./css/style.css",
  "./js/app.js",
  "./js/pwa.js",
  "./images/favicon.png",
  "./images/apple-touch-icon.png",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/ogp.png",
].map((path) => new URL(path, self.location.href).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_ASSETS))
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
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

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
          if (cachedResponse) {
            return cachedResponse;
          }

          if (request.mode === "navigate") {
            return caches.match(new URL("./", self.location.href).toString());
          }

          return Response.error();
        })
      )
  );
});

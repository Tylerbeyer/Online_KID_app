// ─────────────────────────────────────────────────────────────────────────────
// service-worker.js — makes KidTech work OFFLINE and installable as a PWA.
//
// A service worker is a tiny background script the browser keeps even when the
// page is closed. It intercepts network requests and can serve files from a
// local cache. Strategy here = "cache first" (fast + works with no internet).
//
// IMPORTANT: bump CACHE_VERSION whenever you change app.jsx or any asset, or
// returning users may keep seeing the old cached version.
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_VERSION = "kidtech-v10";

// Files that make up the "app shell". Relative paths keep it working whether
// you deploy at the site root or in a sub-folder.
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.jsx",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  // CDN libraries (cached so the app runs with no internet after first load):
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7/babel.min.js",
];

// INSTALL: pre-cache the app shell. addAll fails if ANY item fails, so we cache
// items individually and ignore CDN failures (e.g. first install while flaky).
self.addEventListener("install", event => {
  self.skipWaiting(); // activate the new worker immediately
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.all(APP_SHELL.map(url =>
        cache.add(url).catch(() => console.log("SW: skipped caching", url))
      ))
    )
  );
});

// ACTIVATE: delete caches from older versions so updates take effect.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// FETCH: try the cache first; fall back to the network; cache new GETs as we go.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return; // never cache POST/PUT/etc.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached; // served from cache = instant + offline-safe
      return fetch(event.request).then(response => {
        // Save a copy for next time (best-effort; ignore opaque/errors).
        const copy = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      }).catch(() => cached); // totally offline + not cached → nothing we can do
    })
  );
});

const CACHE_NAME = "ifra-scanner-v52";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./manufacturer-codes.json", "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Third-party libraries needed by the scanner and OCR are cached on first use.
  const scannerLibrary =
    (url.hostname === "cdnjs.cloudflare.com" && url.pathname.includes("quagga")) ||
    (url.hostname === "cdn.jsdelivr.net" && /\/(tesseract\.js|tesseract\.js-core)@/.test(url.pathname)) ||
    url.hostname === "tessdata.projectnaptha.com";
  if (scannerLibrary) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => {
      try {
        const response = await fetch(request);
        if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
    }));
    return;
  }
  // Keep app files available offline. Other origins use the browser's normal network cache.
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});

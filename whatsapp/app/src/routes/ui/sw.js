// WhatsApp Gateway Service Worker
const CACHE_NAME = 'wa-gateway-v1';
const ASSETS_TO_CACHE = [
  './',
  'ui-assets/styles.css',
  'ui-assets/styles/moderation.css',
  'ui-assets/icon.svg',
  'ui-assets/manifest.webmanifest',
];

// Install: Cache core static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
          console.warn('⚠️ Non-fatal: Some assets failed to precache in SW:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old version caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Network first with cache fallback for HTML/assets, bypass for /api & /logs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache dynamic API endpoints, logs, or WebSocket streams
  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('/logs') ||
    url.pathname.includes('/health') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache valid responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback to cache
        return caches.match(event.request);
      })
  );
});

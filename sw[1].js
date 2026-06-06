// ===== SERVICE WORKER — Security Desk PWA =====
// Provides full offline functionality via cache-first strategy

const CACHE_NAME = 'security-desk-v2';
const OFFLINE_URLS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// External resources to cache on first fetch
const EXTERNAL_CACHE_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH — Cache-first with network fallback =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // For navigation requests — always serve app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        return cached || fetch(request).then(response => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // For external CDN resources (fonts, icons) — cache on first fetch
  const isExternal = EXTERNAL_CACHE_PATTERNS.some(p => url.hostname.includes(p));
  if (isExternal) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          // Return empty response for failed external resources (fonts etc)
          return new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        });
      })
    );
    return;
  }

  // For all other requests — cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for HTML requests
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ===== BACKGROUND SYNC (future: sync reports to cloud) =====
self.addEventListener('sync', event => {
  if (event.tag === 'sync-reports') {
    // Placeholder for future cloud sync
    event.waitUntil(Promise.resolve());
  }
});

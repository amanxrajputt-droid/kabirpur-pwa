// ═══════════════════════════════════════════
//  KABIRPUR VILLAGE — SERVICE WORKER
//  Provides full offline support
// ═══════════════════════════════════════════

const CACHE_NAME = 'kabirpur-v1';
const OFFLINE_URL = './index.html';

// All files to cache on install
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Google Fonts (cached on first visit)
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=Noto+Sans+Devanagari:wght@300;400;600;700&family=Tiro+Devanagari+Hindi:ital@0;1&display=swap',
];

// ── INSTALL: cache all core assets ──
self.addEventListener('install', event => {
  console.log('[SW] Installing Kabirpur Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching core files');
      // Cache local files (always succeed)
      return cache.addAll([OFFLINE_URL, './manifest.json', './icon-192.png', './icon-512.png'])
        .then(() => {
          // Try to cache Google Fonts (may fail in offline install - that's ok)
          return cache.add('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=Noto+Sans+Devanagari:wght@300;400;600;700&family=Tiro+Devanagari+Hindi:ital@0;1&display=swap').catch(() => {});
        });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating Kabirpur Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: Cache-first strategy for local, Network-first for external ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') return;

  // Skip Google Maps (always needs network)
  if (url.hostname.includes('maps.google.com') || url.hostname.includes('maps.googleapis.com')) {
    return;
  }

  // For Google Fonts — network first, fallback to cache
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For local assets — Cache first, then network
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Serve from cache & update in background
        fetch(event.request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
        }).catch(() => {});
        return cachedResponse;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// ── BACKGROUND SYNC: notify when back online ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

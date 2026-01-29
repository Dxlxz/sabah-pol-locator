// Service Worker for Sabah POL Locator
const CACHE_NAME = 'sabah-pol-locator-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-72x72.png',
  '/icon-96x96.png',
  '/icon-128x128.png',
  '/icon-144x144.png',
  '/icon-152x152.png',
  '/icon-192x192.png',
  '/icon-384x384.png',
  '/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Install completed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.log('Service Worker: Install failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('Service Worker: Deleting old cache', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Activate completed');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Strategy for map tiles: Cache First, then Network
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            // Return cached tile
            return response;
          }
          // Fetch from network and cache
          return fetch(request)
            .then((networkResponse) => {
              if (!networkResponse || networkResponse.status !== 200) {
                return networkResponse;
              }
              const clonedResponse = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, clonedResponse);
                });
              return networkResponse;
            })
            .catch(() => {
              // Return a fallback if both cache and network fail
              return new Response('Offline', { status: 503 });
            });
        })
    );
    return;
  }

  // Strategy for static assets: Cache First
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          return response || fetch(request);
        })
    );
    return;
  }

  // Strategy for other requests: Network First, then Cache
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const clonedResponse = networkResponse.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(request, clonedResponse);
          });
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-stations') {
    event.waitUntil(
      // Could sync station data here
      Promise.resolve()
    );
  }
});

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png'
      })
    );
  }
});

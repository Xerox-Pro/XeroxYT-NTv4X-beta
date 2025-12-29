
const CACHE_NAME = 'xeroxyt-cache-v11';
// Use relative paths
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'styles.css',
  'icon.svg',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API Requests: Network Only
  if (url.pathname.includes('/api/')) {
    return;
  }

  // 2. Static Assets: Cache First
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|json|woff2?|ttf|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
           return new Response('', { status: 404, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // 3. Navigation Requests: Network First -> Fallback to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
            return response;
        })
        .catch(() => {
          return caches.match('index.html')
            .then(response => response || caches.match('./'));
        })
    );
    return;
  }

  // 4. Default Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

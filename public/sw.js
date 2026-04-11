// Service Worker simple pour éviter les problèmes de cache
const VERSION = Date.now().toString();
const CACHE_NAME = `inventaire-caserne-${VERSION}`;

// Installation et activation immédiate
self.addEventListener('install', (event) => {
  console.log('[SW] Installation');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activation');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Stratégie simple : toujours réseau d'abord pour éviter les problèmes MIME
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request.clone(), {
      cache: 'no-cache'
    }).catch(() => {
      // Fallback sur le cache seulement si pas de réseau
      return caches.match(event.request);
    })
  );
});

// Messages pour forcer la mise à jour
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
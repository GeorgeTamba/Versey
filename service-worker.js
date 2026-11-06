/**
 * Versey - Service Worker for Offline PWA Capabilities
 * Caches application shell, assets, styles, scripts, and verses data.
 */

const CACHE_NAME = 'versey-v6';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/verse.js',
  './js/image.js',
  './js/share.js',
  './js/ui.js',
  './data/i18n.json',
  './data/verses.json',
  './data/verses.en.json',
  './data/verses.es.json',
  './data/verses.zh-Hans.json',
  './data/verses.zh-Hant.json',
  './data/verses.id.json',
  './assets/og-image.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const freshRequests = PRECACHE_ASSETS.map((url) => new Request(url, { cache: 'reload' }));
      return cache.addAll(freshRequests);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Network-first with HTTP cache bypass so local/updated scripts & JSON are always fresh when online,
  // falling back to Cache Storage when offline.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});


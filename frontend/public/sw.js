/*
 * Howdi chat service worker.
 *
 * Deliberately small: it never caches pages or API responses, because
 * they are personal and must always be current. It only keeps an offline
 * page, shown when a page can't load at all.
 */
const CACHE = 'howdi-offline-v1';
const OFFLINE = ['/offline.html', '/brand/mascot/resting.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }
  if (OFFLINE.includes(new URL(request.url).pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});

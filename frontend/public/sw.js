/*
 * Howdi chat service worker.
 *
 * Deliberately small: it never caches pages or API responses, because
 * they are personal and must always be current. It keeps an offline page,
 * shown when a page can't load at all, and shows push notifications.
 */
const CACHE = 'howdi-offline-v2';
const OFFLINE = ['/offline.html', '/brand/mascot/resting.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
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

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Howdi chat', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Someone looking at the app already sees it live, in the bell.
      if (windows.some((client) => client.focused && client.visibilityState === 'visible')) return;
      return self.registration.showNotification(payload.title || 'Howdi chat', {
        body: payload.body || '',
        icon: '/pwa/icon-192.png',
        badge: '/pwa/icon-192.png',
        tag: payload.tag,
        renotify: Boolean(payload.tag),
        data: { link: payload.link || '/' },
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.link || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        return open
          .focus()
          .then((client) => (client.url === target ? client : client.navigate(target)));
      }
      return self.clients.openWindow(target);
    }),
  );
});

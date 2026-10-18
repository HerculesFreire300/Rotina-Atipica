const CACHE_NAME = 'rotina-atipica-shell-v5';
const SHELL_FILES = [
  './',
  './index.html',
  './app.js?v=8',
  './style.css',
  './supabase-config.js?v=3',
  './manifest.webmanifest',
  './logo-autismo.png',
  './app-icon-192.png',
  './app-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch (error) {
    console.error('Push notification payload is invalid:', error);
  }
  const title = typeof payload.title === 'string' ? payload.title : 'Rotina Atípica';
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'Está na hora de começar a rotina de hoje.',
    icon: './app-icon-192.png',
    badge: './app-icon-192.png',
    data: { url: './' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow('./');
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('rotina-atipica-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isAppAsset = SHELL_FILES.some((file) => new URL(file, self.registration.scope).pathname === url.pathname);
  if (!isAppAsset && request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(request) || (request.mode === 'navigate' ? cache.match('./index.html') : undefined);
      }),
  );
});

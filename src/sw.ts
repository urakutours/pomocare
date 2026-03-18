/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Workbox precaching (manifest injected by vite-plugin-pwa at build time)
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Activate immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Push notification handler ---
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Timer Complete';
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body: data.body || 'PomoCare',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: 'pomocare-timer',
    renotify: true,
    vibrate: [300, 100, 300, 100, 300],
    data: { url: '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// --- Notification click handler ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});

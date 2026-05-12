// Service Worker for PWA and Push Notifications

// v3: Uygulama sayfalarını önbellek-öncelikli sunmak oturum/SSR ile çakışabiliyordu;
// yalnız hafif shell + offline sayfası precache; navigasyon ağı öncelikli.
const CACHE_NAME = 'satinalma-v3';
const BADGE_CACHE = 'satinalma-badge-v1';
const BADGE_KEY = 'badge-count';

const urlsToCache = ['/offline.html'];

function getNav() {
  try {
    return self.navigator || globalThis.navigator;
  } catch {
    return undefined;
  }
}

async function readStoredBadgeCount() {
  try {
    const cache = await caches.open(BADGE_CACHE);
    const res = await cache.match(BADGE_KEY);
    if (!res) return 0;
    const text = await res.text();
    const n = parseInt(text, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function writeStoredBadgeCount(count) {
  const safe = Math.max(0, Math.min(Number(count) || 0, 9999));
  try {
    const cache = await caches.open(BADGE_CACHE);
    await cache.put(BADGE_KEY, new Response(String(safe)));
    return safe;
  } catch {
    return safe;
  }
}

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== BADGE_CACHE) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// Fetch: API ve navigasyon her zaman ağ — oturum çerezleri ve middleware güvenilir kalsın.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  event.waitUntil(
    (async () => {
      let count = await readStoredBadgeCount();
      let notificationData = {};

      if (event.data) {
        try {
          notificationData = event.data.json();
        } catch {
          notificationData = {};
        }
      }

      if (typeof notificationData.badgeCount === 'number') {
        count = await writeStoredBadgeCount(notificationData.badgeCount);
      } else {
        count = await writeStoredBadgeCount(count + 1);
      }

      const options = {
        body: 'Yeni bir talep oluşturuldu!',
        icon: '/favicon-32x32.ico',
        badge: '/favicon-16x16.ico',
        vibrate: [200, 100, 200, 100, 200],
        silent: false,
        requireInteraction: true,
        data: {
          dateOfArrival: Date.now(),
          primaryKey: '1',
          count,
          ...(notificationData.data && typeof notificationData.data === 'object' ? notificationData.data : {})
        },
        actions: [
          {
            action: 'explore',
            title: 'Talebi Görüntüle',
            icon: '/favicon-16x16.ico'
          },
          {
            action: 'close',
            title: 'Kapat',
            icon: '/favicon-16x16.ico'
          }
        ],
        tag: 'purchase-request',
        renotify: true
      };

      if (notificationData.title || notificationData.body) {
        options.title = notificationData.title || 'Satın Alma Sistemi';
        options.body = notificationData.body || 'Yeni bir bildirim var!';
      } else {
        options.title = 'Satın Alma Sistemi';
      }

      if (notificationData.data?.type === 'urgent') {
        options.vibrate = [300, 100, 300, 100, 300, 100, 300];
        options.requireInteraction = true;
      }

      await Promise.all([
        self.registration.showNotification(options.title || 'Satın Alma Sistemi', options),
        updateBadge(count),
        playNotificationSound(notificationData.data?.type)
      ]);
    })()
  );
});

async function updateBadge(count) {
  const nav = getNav();
  try {
    if (nav && 'setAppBadge' in nav) {
      if (count > 0) {
        const display = count > 99 ? 99 : count;
        await nav.setAppBadge(display);
      } else if ('clearAppBadge' in nav) {
        await nav.clearAppBadge();
      } else {
        await nav.setAppBadge(0);
      }
    }
    await updateDocumentTitleViaClients(count);
  } catch (e) {
    console.log('Badge update failed, using client fallback:', e);
    await updateDocumentTitleViaClients(count);
  }
}

async function updateDocumentTitleViaClients(count) {
  try {
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    clientList.forEach((client) => {
      client.postMessage({
        type: 'UPDATE_BADGE',
        count
      });
    });
  } catch (error) {
    console.error('Error posting badge to clients:', error);
  }
}

async function playNotificationSound(type = 'default') {
  try {
    console.log('Playing notification sound for type:', type);
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    clientList.forEach((client) => {
      client.postMessage({
        type: 'PLAY_NOTIFICATION_SOUND',
        soundType: type
      });
    });
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}

self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);
  event.notification.close();

  event.waitUntil(
    (async () => {
      let count = await readStoredBadgeCount();
      if (count > 0) {
        count = await writeStoredBadgeCount(count - 1);
      }
      await updateBadge(count);

      if (event.action === 'explore') {
        await self.clients.openWindow('/dashboard/requests');
      } else if (event.action === 'close') {
        return;
      } else {
        await self.clients.openWindow('/');
      }
    })()
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(Promise.resolve());
  }
});

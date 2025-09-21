// Service Worker for PWA and Push Notifications

const CACHE_NAME = 'satinalma-v1';
const urlsToCache = [
  '/',
  '/dashboard',
  '/dashboard/requests',
  '/dashboard/suppliers',
  '/dashboard/offers',
  '/offline.html'
];

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

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Global notification counter
let notificationCount = 0;

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  // Increment notification counter
  notificationCount++;
  
  const options = {
    body: 'Yeni bir talep oluşturuldu!',
    icon: '/favicon-32x32.ico',
    badge: '/favicon-16x16.ico',
    vibrate: [200, 100, 200, 100, 200], // More noticeable vibration
    silent: false, // Ensure sound plays
    requireInteraction: true, // Keep notification visible until user interacts
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1',
      count: notificationCount
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
    tag: 'purchase-request', // Group similar notifications
    renotify: true // Play sound even if similar notification exists
  };

  if (event.data) {
    const notificationData = event.data.json();
    options.title = notificationData.title || 'Satın Alma Sistemi';
    options.body = notificationData.body || 'Yeni bir bildirim var!';
    options.data = { ...options.data, ...notificationData.data };
    
    // Set notification type for different sounds/styles
    if (notificationData.data?.type === 'urgent') {
      options.vibrate = [300, 100, 300, 100, 300, 100, 300];
      options.requireInteraction = true;
    }
  } else {
    options.title = 'Satın Alma Sistemi';
  }

  // Update browser badge with notification count
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(options.title, options),
      updateBadge(notificationCount),
      playNotificationSound(options.data?.type)
    ])
  );
});

// Function to update browser tab badge
async function updateBadge(count) {
  try {
    if ('setAppBadge' in navigator) {
      await navigator.setAppBadge(count);
    } else if ('setExperimentalAppBadge' in navigator) {
      await navigator.setExperimentalAppBadge(count);
    }
    
    // Update document title for desktop browsers
    await updateDocumentTitle(count);
  } catch (error) {
    console.log('Badge API not supported, using title fallback');
    await updateDocumentTitle(count);
  }
}

// Function to update document title with notification count
async function updateDocumentTitle(count) {
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    clients.forEach(client => {
      client.postMessage({
        type: 'UPDATE_BADGE',
        count: count
      });
    });
  } catch (error) {
    console.error('Error updating document title:', error);
  }
}

// Function to play notification sound
async function playNotificationSound(type = 'default') {
  try {
    // Browser will play default notification sound
    // For custom sounds, we'd need audio API in main thread
    console.log('Playing notification sound for type:', type);
    
    // Send message to main thread to play custom sound
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    clients.forEach(client => {
      client.postMessage({
        type: 'PLAY_NOTIFICATION_SOUND',
        soundType: type
      });
    });
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);
  
  event.notification.close();
  
  // Decrease notification count when clicked
  if (notificationCount > 0) {
    notificationCount--;
    updateBadge(notificationCount);
  }

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard/requests')
    );
  } else if (event.action === 'close') {
    // Just close the notification - badge already updated above
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync for offline requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle offline requests when connection is restored
  return Promise.resolve();
}

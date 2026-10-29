/**
 * Dream-It Service Worker (PWA)
 * Provides offline shell caching, instant 0ms asset loading, and network resilience.
 */

const CACHE_NAME = 'dreamit-pwa-v1.2';

// Critical core assets cached on initial install
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Install Event: Pre-cache core shell and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event: Clear stale caches and take immediate control of all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event: Cache strategies tailored by request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle standard HTTP/HTTPS GET requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Never intercept local development server requests (prevents stale dev bundle crashes)
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.local')) {
    return;
  }

  // 1. External APIs (Supabase, Clerk, Google AI) -> Network First / Only
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('clerk.accounts.dev') ||
    url.hostname.includes('googleapis.com')
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ offline: true, message: 'You are currently offline. Local changes will sync when connected.' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // 2. Navigation requests (HTML pages) -> Network-first with instant offline cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If valid response, clone and update cache
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          // Fallback to cached index.html so SPA router loads offline
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return new Response('Dream-It Offline: Please reconnect to load new pages.', {
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Images, Google Fonts, Woff2) -> Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. Default: Cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

// Push Event: Triggered by OS Push Service (Google FCM / WNS / Apple APNs)
// Wakes up background service worker even when phone is locked or browser is closed!
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Dream It • New Message',
    body: 'You received a new message.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'dreamit-chat-alert',
    data: {},
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'dreamit-chat-alert',
    renotify: true,
    // Vibration pattern for Android phone in pocket/locked screen: vibrate-pause-vibrate
    vibrate: [250, 100, 250, 100, 250],
    timestamp: Date.now(),
    requireInteraction: false,
    data: {
      url: payload.url || (payload.data && payload.data.url) || '/',
      friendId: payload.friendId || (payload.data && payload.data.friendId),
      messageId: payload.messageId || (payload.data && payload.data.messageId),
      ...(payload.data || {}),
    },
    actions: [
      { action: 'open_chat', title: '💬 Open Chat' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

// Notification Click Event: Focus existing window or open new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const data = event.notification.data || {};
  const friendId = data.friendId;
  const targetUrl = friendId ? `/?openChat=${encodeURIComponent(friendId)}` : (data.url || '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If an existing window/tab is open, focus it and tell it to open the chat
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (friendId) {
            client.postMessage({
              type: 'DREAMIT_OPEN_CHAT',
              friendId: friendId,
            });
          }
          return;
        }
      }
      // 2. Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});


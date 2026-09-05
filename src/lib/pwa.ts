/**
 * pwa.ts
 * Centralized utility for PWA Service Worker lifecycle, installation prompts,
 * and online/offline network detection.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// In-memory state
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();
const networkListeners = new Set<(isOnline: boolean) => void>();

/**
 * Registers the Dream-It Service Worker
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local');

  // In local development, proactively unregister workers and clear old cache to prevent blank screens
  if (isLocalhost) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().then(() => {
          console.log('[PWA] Unregistered stale service worker on localhost');
        });
      }
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key);
        }
      });
    }
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered with scope:', reg.scope);

        // Check for updates
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version available.');
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });

  // Capture beforeinstallprompt for Android, Chrome, Edge, Chromebooks
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installListeners.forEach((cb) => cb(true));
  });

  // Capture appinstalled
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((cb) => cb(false));
    console.log('[PWA] Dream-It was successfully installed!');
  });

  // Online / Offline listeners
  window.addEventListener('online', () => {
    networkListeners.forEach((cb) => cb(true));
  });
  window.addEventListener('offline', () => {
    networkListeners.forEach((cb) => cb(false));
  });
}

/**
 * Checks if the current app is running in standalone (installed PWA) mode
 */
export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Check if the device is iOS (Safari doesn't support beforeinstallprompt, requires manual 'Add to Home Screen')
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Subscribe to installability changes
 */
export function subscribePWAInstall(callback: (canInstall: boolean) => void): () => void {
  installListeners.add(callback);
  callback(deferredPrompt !== null);
  return () => {
    installListeners.delete(callback);
  };
}

/**
 * Subscribe to online/offline network changes
 */
export function subscribeNetworkStatus(callback: (isOnline: boolean) => void): () => void {
  networkListeners.add(callback);
  callback(typeof navigator !== 'undefined' ? navigator.onLine : true);
  return () => {
    networkListeners.delete(callback);
  };
}

/**
 * Triggers the native PWA install prompt
 */
export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
  if (!deferredPrompt) {
    return 'unsupported';
  }

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    deferredPrompt = null;
    installListeners.forEach((cb) => cb(false));
  }
  return choice.outcome;
}

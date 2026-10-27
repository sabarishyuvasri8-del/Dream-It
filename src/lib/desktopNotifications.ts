/**
 * Desktop & Outside Notifications Manager for Dream It
 * Enables native OS & browser notifications when users are in another tab or application.
 * Includes Web Audio chime, document title alert flashing, and Service Worker notificationclick routing.
 */

import { DirectMessage } from "./supabase";

// In-memory set of recent message IDs to prevent duplicate alerts
const seenMessageIds = new Set<string>();

// Keep track of tab title alert interval
let titleAlertInterval: any = null;
let originalDocumentTitle: string = "";

/**
 * Checks if the browser supports the Web Notification API
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Gets the current notification permission state
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Requests native notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn("[Notifications] Error requesting notification permission:", err);
    return Notification.permission;
  }
}

const NOTIF_MUTED_STORAGE_KEY = "dreamit_notifications_muted_v1";

/**
 * Checks if notifications are muted by user preference
 */
export function isNotificationsMuted(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  return localStorage.getItem(NOTIF_MUTED_STORAGE_KEY) === "true";
}

/**
 * Mutes or unmutes notifications and notifies all components across the app
 */
export function setNotificationsMuted(muted: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (muted) {
    localStorage.setItem(NOTIF_MUTED_STORAGE_KEY, "true");
  } else {
    localStorage.removeItem(NOTIF_MUTED_STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent("dreamit:notif-mute-change", { detail: { muted } }));
}

/**
 * Plays a pleasant, non-jarring synthesized audio chime via Web Audio API.
 * Requires zero external audio files and has zero network latency.
 */
let audioCtx: AudioContext | null = null;
export function playNotificationChime(): void {
  try {
    if (typeof window === "undefined") return;
    if (isNotificationsMuted()) return;
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;

    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const ctx = audioCtx;
    const now = ctx.currentTime;

    // Primary bell tone: 587.33 Hz (D5) -> 880 Hz (A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Subtle soft overtone: 1174.66 Hz (D6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174.66, now + 0.06);

    gain2.gain.setValueAtTime(0, now + 0.06);
    gain2.gain.linearRampToValueAtTime(0.08, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.35);
  } catch (err) {
    // Gracefully ignore audio errors (e.g. browser autoplay restrictions)
    console.debug("[Notifications] Audio chime note:", err);
  }
}

/**
 * Returns true if the user is currently on another tab, minimized, or viewing another app.
 */
export function isTabInactive(): boolean {
  if (typeof document === "undefined") return false;
  return document.hidden || document.visibilityState === "hidden" || !document.hasFocus();
}

/**
 * Starts flashing the document title when the user is in another tab
 */
export function startTabTitleAlert(senderName: string, snippet?: string): void {
  if (typeof document === "undefined") return;
  if (isNotificationsMuted()) return;

  if (!originalDocumentTitle) {
    originalDocumentTitle = document.title || "Dream It";
  }

  // Clear any existing title alert loop
  if (titleAlertInterval) {
    clearInterval(titleAlertInterval);
  }

  const alertTitle = `(1) 💬 ${senderName}: ${snippet ? snippet.slice(0, 24) : "New message"}`;
  let toggle = false;

  document.title = alertTitle;

  titleAlertInterval = setInterval(() => {
    if (!isTabInactive()) {
      stopTabTitleAlert();
      return;
    }
    toggle = !toggle;
    document.title = toggle ? alertTitle : `(1) 💬 New message • Dream It`;
  }, 1500);
}

/**
 * Restores original document title when user returns to tab
 */
export function stopTabTitleAlert(): void {
  if (titleAlertInterval) {
    clearInterval(titleAlertInterval);
    titleAlertInterval = null;
  }
  if (originalDocumentTitle && typeof document !== "undefined") {
    document.title = originalDocumentTitle;
  }
}

// Auto-register visibility and focus listeners to clear tab title alert
if (typeof window !== "undefined") {
  const handleUserReturned = () => {
    if (!isTabInactive()) {
      stopTabTitleAlert();
    }
  };
  window.addEventListener("focus", handleUserReturned);
  window.addEventListener("visibilitychange", handleUserReturned);

  // Listen for Service Worker postMessage routing
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "DREAMIT_OPEN_CHAT" && event.data.friendId) {
        window.dispatchEvent(
          new CustomEvent("dreamit:open-chat", {
            detail: { friendId: event.data.friendId },
          })
        );
      }
    });
  }
}

export interface PushMessageNotificationOptions {
  message: DirectMessage;
  senderName: string;
  senderAvatar?: string | null;
  onOpenChat?: (friendId: string) => void;
  forceShowOutside?: boolean;
}

/**
 * Pushes an outside OS/browser notification for an incoming direct message.
 * Formats snippet, plays chime, flashes tab title, and handles click-to-open.
 */
export async function pushMessageNotification({
  message,
  senderName,
  senderAvatar,
  onOpenChat,
  forceShowOutside = false,
}: PushMessageNotificationOptions): Promise<void> {
  // Deduplicate: avoid firing notification twice for same message
  if (message.id) {
    if (seenMessageIds.has(message.id)) return;
    seenMessageIds.add(message.id);
    // Limit memory footprint of seen IDs
    if (seenMessageIds.size > 200) {
      const first = seenMessageIds.values().next().value;
      if (first) seenMessageIds.delete(first);
    }
  }

  if (isNotificationsMuted()) return;

  const inactive = isTabInactive();

  // If tab is active and not forced, the message is visible in-app
  if (!inactive && !forceShowOutside) {
    return;
  }

  // 1. Play audio chime so user hears it even if working in another desktop window
  playNotificationChime();

  // 2. Format the message text snippet
  let bodySnippet = (message.content || "").trim();
  if (!bodySnippet) {
    const isAudio =
      message.file_type?.startsWith("audio/") ||
      message.file_name?.startsWith("voice_note_") ||
      message.file_name?.endsWith(".webm") ||
      message.file_name?.endsWith(".m4a") ||
      message.file_name?.endsWith(".mp3") ||
      message.file_name?.endsWith(".wav") ||
      message.file_name?.endsWith(".ogg");

    if (isAudio) {
      bodySnippet = "🎙️ Sent you a voice message";
    } else if (message.file_name) {
      bodySnippet = `📎 Sent a file: ${message.file_name}`;
    } else if (message.file_url) {
      bodySnippet = "📎 Sent an attachment";
    } else {
      bodySnippet = "Sent you a message";
    }
  }

  // 3. Start tab title alert flashing
  startTabTitleAlert(senderName, bodySnippet);

  // 4. Trigger Native Outside Desktop Notification
  if (!isNotificationSupported()) return;

  const permission = Notification.permission;
  if (permission !== "granted") {
    // If not granted, tab title alert and chime have already fired
    return;
  }

  const title = `${senderName} • Dream It`;
  const notificationOptions: NotificationOptions = {
    body: bodySnippet,
    icon: senderAvatar || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `dreamit-dm-${message.sender_id}`,
    renotify: true,
    data: {
      friendId: message.sender_id,
      messageId: message.id,
      url: typeof window !== "undefined" ? window.location.origin : "/",
    },
  };

  const handleNotificationClick = () => {
    try {
      window.focus();
    } catch {}
    stopTabTitleAlert();
    onOpenChat?.(message.sender_id);
    window.dispatchEvent(
      new CustomEvent("dreamit:open-chat", {
        detail: { friendId: message.sender_id },
      })
    );
  };

  // Try via ServiceWorkerRegistration (standard for modern PWAs & Chrome/Safari OS integration)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);
        return;
      }
    } catch (swErr) {
      console.warn("[Notifications] SW notification error, trying new Notification:", swErr);
    }
  }

  // Fallback to standard window.Notification constructor
  try {
    const notif = new Notification(title, notificationOptions);
    notif.onclick = () => {
      handleNotificationClick();
      try {
        notif.close();
      } catch {}
    };
  } catch (err) {
    console.warn("[Notifications] Notification constructor error:", err);
  }
}

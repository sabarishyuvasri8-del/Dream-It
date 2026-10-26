/**
 * src/lib/pushNotifications.ts
 * Cross-Platform Web Push Notification Manager for Dream It
 * Powers lock-screen notifications on Android phones, Windows Action Center, and macOS Notification Center.
 */

import { supabase } from "./supabase";

// Production VAPID Public Key for client push subscription
export const VAPID_PUBLIC_KEY =
  (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY ||
  "BMKEHNDgWBUAaPiWvn753OXxngSbuIFN2obnsGzYl4MeHDIDbFoPnf-NdpSMnA6VUfnRwR-8clEfK4RyRLPAleE";

/**
 * Checks if the current browser environment supports Push Notifications
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Detects the user's current operating system for optimized push payloads
 */
export function getDevicePlatform(): "android" | "windows" | "macos" | "ios" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/windows|win32|win64/.test(ua)) return "windows";
  if (/macintosh|mac os x/.test(ua) && !/iphone|ipad|ipod/.test(ua)) return "macos";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  return "other";
}

/**
 * Converts a URL-safe Base64 string into a Uint8Array for pushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Saves or updates a PushSubscription to the Supabase database
 */
export async function savePushSubscriptionToDatabase(
  userId: string,
  subscription: PushSubscription
): Promise<boolean> {
  if (!userId || !subscription) return false;

  try {
    const json = subscription.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      console.warn("[Push] Subscription missing required key components");
      return false;
    }

    const deviceType = getDevicePlatform();
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        device_type: deviceType,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      console.error("[Push] Error saving push subscription to Supabase:", error);
      return false;
    }

    console.log(`[Push] Successfully registered push subscription for device: ${deviceType}`);
    return true;
  } catch (err) {
    console.error("[Push] Exception saving push subscription:", err);
    return false;
  }
}

export interface RegisterPushResult {
  success: boolean;
  permission: NotificationPermission | "unsupported";
  subscription?: PushSubscription | null;
  error?: string;
}

/**
 * Registers Web Push Notifications with the browser and saves to Supabase.
 * Prompts user for permission if not yet granted.
 */
export async function registerPushNotifications(userId: string): Promise<RegisterPushResult> {
  if (!isPushSupported()) {
    return {
      success: false,
      permission: "unsupported",
      error: "Push notifications are not supported in this browser.",
    };
  }

  try {
    // 1. Request OS/browser notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        success: false,
        permission,
        error: "Notification permission was denied or dismissed.",
      };
    }

    // 2. Wait for Service Worker to be ready
    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
      return {
        success: false,
        permission,
        error: "Service worker registration not ready.",
      };
    }

    // 3. Check for existing subscription or create new one
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    // 4. Save subscription to database
    if (subscription && userId) {
      await savePushSubscriptionToDatabase(userId, subscription);
    }

    return {
      success: true,
      permission,
      subscription,
    };
  } catch (err: any) {
    console.error("[Push] Failed to register push notifications:", err);
    return {
      success: false,
      permission: Notification.permission,
      error: err?.message || "Failed to register push subscription.",
    };
  }
}

/**
 * Unregisters the push subscription from browser and removes it from database
 */
export async function unregisterPushNotifications(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      if (userId && endpoint) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint)
          .eq("user_id", userId);
      }
    }
    return true;
  } catch (err) {
    console.error("[Push] Failed to unregister push notifications:", err);
    return false;
  }
}

/**
 * Dispatches a background / lock-screen push notification to a recipient via /api/send-push
 */
export async function dispatchChatPushNotification(params: {
  recipientId: string;
  senderId: string;
  senderName: string;
  content?: string;
  fileMeta?: { name?: string; type?: string; url?: string };
}): Promise<void> {
  const { recipientId, senderId, senderName, content, fileMeta } = params;
  if (!recipientId || !senderId) return;

  // Format message snippet
  let snippet = (content || "").trim();
  if (!snippet) {
    if (fileMeta?.type?.startsWith("audio/") || fileMeta?.name?.startsWith("voice_note_")) {
      snippet = "🎙️ Sent you a voice message";
    } else if (fileMeta?.name) {
      snippet = `📎 Sent a file: ${fileMeta.name}`;
    } else if (fileMeta?.url) {
      snippet = "📎 Sent an attachment";
    } else {
      snippet = "Sent you a message";
    }
  }

  try {
    // Non-blocking fetch to backend serverless push dispatcher
    fetch("/api/send-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipientId,
        senderId,
        senderName: senderName || "Friend",
        bodySnippet: snippet,
      }),
    }).catch((err) => {
      console.debug("[Push] Push dispatch request silent catch:", err);
    });
  } catch (err) {
    console.debug("[Push] dispatchChatPushNotification error:", err);
  }
}

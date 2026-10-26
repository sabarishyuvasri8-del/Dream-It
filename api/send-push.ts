/**
 * api/send-push.ts
 * Serverless Web Push Dispatcher for Dream It.
 * Sends encrypted push notifications via Google FCM (Android/Chrome), Windows WNS, and Apple APNs.
 * Runs on Vercel Serverless Functions and local dev server.
 */

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Supabase project constants
const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || "ogukrtsucsnxvrudvobv";
const SUPABASE_URL = process.env.SUPABASE_URL || `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndWtydHN1Y3NueHZydWR2b2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDQ2MTksImV4cCI6MjEwMTE4MDYxOX0.cI7kzHbsSOYbiO3izp-sXhDinBMTCV5vmQXcllAfqy0";

// VAPID Credentials
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  "BMKEHNDgWBUAaPiWvn753OXxngSbuIFN2obnsGzYl4MeHDIDbFoPnf-NdpSMnA6VUfnRwR-8clEfK4RyRLPAleE";

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "9pXFfA-hfNMemTlefmPci2uKaRsWDT53knGkvO-ajQs";

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:support@dreamit.app";

// Initialize VAPID once
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.error("[api/send-push] Error setting VAPID details:", e);
}

export default async function handler(req: any, res?: any) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    if (res && typeof res.status === "function") {
      return res.status(204).end();
    }
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    const errorBody = JSON.stringify({ error: "Only POST is supported." });
    if (res && typeof res.status === "function") {
      return res.status(405).json({ error: "Only POST is supported." });
    }
    return new Response(errorBody, { status: 405, headers });
  }

  try {
    // 1. Parse payload
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body && typeof req.json === "function") {
      body = await req.json();
    }

    const { recipientId, senderId, senderName, bodySnippet } = body || {};

    if (!recipientId || !senderId) {
      const errRes = { error: "Missing recipientId or senderId" };
      if (res && typeof res.status === "function") {
        return res.status(400).json(errRes);
      }
      return new Response(JSON.stringify(errRes), { status: 400, headers });
    }

    // 2. Query push subscriptions for recipient from Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: subscriptions, error: dbError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", recipientId);

    if (dbError) {
      console.error("[api/send-push] Database query error:", dbError);
      // If table does not exist yet or error occurred, fail gracefully
      const errRes = { error: dbError.message, sentCount: 0 };
      if (res && typeof res.status === "function") {
        return res.status(200).json(errRes);
      }
      return new Response(JSON.stringify(errRes), { status: 200, headers });
    }

    if (!subscriptions || subscriptions.length === 0) {
      const emptyRes = { success: true, sentCount: 0, message: "No active push subscriptions" };
      if (res && typeof res.status === "function") {
        return res.status(200).json(emptyRes);
      }
      return new Response(JSON.stringify(emptyRes), { status: 200, headers });
    }

    // 3. Prepare Notification Payload
    const notificationPayload = JSON.stringify({
      title: `${senderName || "Friend"} • Dream It`,
      body: bodySnippet || "Sent you a message",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `dreamit-dm-${senderId}`,
      friendId: senderId,
      url: `/?openChat=${encodeURIComponent(senderId)}`,
    });

    let sentCount = 0;
    const expiredEndpoints: string[] = [];

    // 4. Send to all recipient devices (Android phone, Windows PC, Mac)
    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, notificationPayload, {
            TTL: 60 * 60 * 24, // 24 hours retention
            urgency: "high", // Ensures immediate heads-up lock screen wake on mobile
          });
          sentCount++;
        } catch (sendErr: any) {
          const statusCode = sendErr?.statusCode;
          console.warn(`[api/send-push] Push failed for endpoint (status ${statusCode}):`, sendErr?.message);
          // 410 Gone or 404 Not Found indicates user revoked permission or device uninstalled
          if (statusCode === 410 || statusCode === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // 5. Clean up expired subscriptions automatically
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints)
        .catch(() => {});
    }

    const successRes = { success: true, sentCount, totalRecipients: subscriptions.length };
    if (res && typeof res.status === "function") {
      return res.status(200).json(successRes);
    }
    return new Response(JSON.stringify(successRes), { status: 200, headers });
  } catch (err: any) {
    console.error("[api/send-push] Unexpected error:", err);
    const errRes = { error: err?.message || "Internal server error" };
    if (res && typeof res.status === "function") {
      return res.status(500).json(errRes);
    }
    return new Response(JSON.stringify(errRes), { status: 500, headers });
  }
}

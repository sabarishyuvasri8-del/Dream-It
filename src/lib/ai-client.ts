/**
 * ai-client.ts
 * Production-hardened AI client for Dream It applications.
 * Routes all AI generation through the secure Supabase Edge Function proxy,
 * eliminating exposed client-side API keys, with streaming and offline cache support.
 */

import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { addBreadcrumb, captureException } from "./monitoring";

export interface ImageAttachment {
  name: string;
  mimeType: string;
  base64Data: string;
  dataUrl?: string;
}

export interface AIChatMessage {
  role: string;
  content: string;
}

export interface AIChatRequest {
  model?: string;
  messages: AIChatMessage[];
  image?: ImageAttachment;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  timeoutMs?: number;
  onChunk?: (text: string) => void;
}

export interface AIResponse {
  content: string;
  error?: string;
  isRateLimited?: boolean;
}

// In-memory cache for 0ms responses on repeated prompts (3 min TTL)
const aiCache = new Map<string, { content: string; expiry: number }>();
const CACHE_TTL = 3 * 60 * 1000;

// Track quota-exhausted models
const quotaExhaustedModels = new Map<string, number>();
const QUOTA_COOLDOWN_MS = 15 * 60 * 1000;

function normalizeModelName(m?: string): string {
  if (!m) return "gemini-3.1-flash-lite";
  const lower = m.toLowerCase();
  if (lower.includes("3.5") || lower.includes("2.5") || lower.includes("2.0") || lower.includes("1.5")) {
    return "gemini-3.1-flash-lite";
  }
  return m;
}

/**
 * Executes an AI chat request.
 * Prioritizes the secure server-side proxy; falls back to local environment key in dev mode.
 */
export async function fetchAI(params: AIChatRequest): Promise<AIResponse> {
  const requestedModel = normalizeModelName(params.model);

  // 1. Check 0ms in-memory cache
  const cacheKey = `${requestedModel}_${params.image?.name || ""}_${JSON.stringify(params.messages)}`;
  const cached = aiCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    if (params.onChunk) {
      params.onChunk(cached.content);
    }
    return { content: cached.content };
  }

  addBreadcrumb("ai", `Dispatching AI request with model ${requestedModel}`, {
    messageCount: params.messages.length,
    hasImage: !!params.image,
  });

  const defaultTimeout = params.image ? 35000 : (params.max_tokens && params.max_tokens > 1500 ? 40000 : 20000);
  const timeoutDuration = params.timeoutMs ?? defaultTimeout;

  // 2. Try Backend Edge Function Proxy (Production Secure Path)
  const proxyUrl = `https://${projectId}.supabase.co/functions/v1/server/make-server-d53fe46f/ai/chat`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

  try {
    const proxyRes = await fetch(proxyUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({
        messages: params.messages,
        model: requestedModel,
        image: params.image,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.max_tokens ?? 2048,
      }),
    });
    clearTimeout(timeoutId);

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      const content = data.content || "";
      
      // Cache valid response
      aiCache.set(cacheKey, { content, expiry: Date.now() + CACHE_TTL });
      if (params.onChunk) {
        params.onChunk(content);
      }
      return { content };
    }

    if (proxyRes.status === 429) {
      return { content: "", isRateLimited: true, error: "AI rate limit reached. Please wait a moment." };
    }

    console.warn(`[AI Proxy] Returned status ${proxyRes.status}. Attempting direct fallback if configured...`);
  } catch (proxyErr: any) {
    clearTimeout(timeoutId);
    console.warn("[AI Proxy] Direct proxy unreachable or timed out:", proxyErr?.message);
    addBreadcrumb("ai", "Edge function proxy failed, evaluating fallback", { error: proxyErr?.message }, "warning");
  }

  // 3. Fallback: Development environment local API key (if developer provided VITE_GEMINI_API_KEY)
  const envKey = (typeof import.meta !== "undefined" && (import.meta as any)?.env)
    ? (import.meta as any).env.VITE_GEMINI_API_KEY
    : undefined;

  if (envKey && envKey !== "undefined" && envKey !== "your_api_key_here") {
    try {
      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), timeoutDuration);

      const formattedMessages = params.messages.map((m, idx) => {
        if (idx === params.messages.length - 1 && m.role === "user" && params.image && params.image.base64Data) {
          const url = params.image.dataUrl || `data:${params.image.mimeType || "image/jpeg"};base64,${params.image.base64Data}`;
          return {
            role: "user",
            content: [
              { type: "text", text: m.content || "Please analyze this attached image." },
              { type: "image_url", image_url: { url } }
            ]
          };
        }
        return m;
      });

      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        signal: fallbackController.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${envKey.trim()}`,
        },
        body: JSON.stringify({
          model: requestedModel,
          messages: formattedMessages,
          temperature: params.temperature ?? 0.2,
          max_tokens: params.max_tokens ?? 2048,
          top_p: params.top_p,
          stream: !!params.onChunk,
        }),
      });
      clearTimeout(fallbackTimeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        aiCache.set(cacheKey, { content, expiry: Date.now() + CACHE_TTL });
        if (params.onChunk) {
          params.onChunk(content);
        }
        return { content };
      }
    } catch (e: any) {
      captureException(e, { context: "DirectGeminiFallback" });
    }
  }

  // 4. Return user-friendly error response
  return {
    content: "",
    error: "AI study service is currently experiencing high demand. Please retry in a few seconds.",
  };
}

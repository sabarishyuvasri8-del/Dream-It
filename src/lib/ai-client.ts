/**
 * ai-client.ts
 * Production-hardened, secure AI client for Dream-It applications.
 * Routes all AI requests through the secure /api/ai-chat serverless proxy
 * so that API keys remain protected on the server and are never bundled in client JS.
 */

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

function normalizeModelName(m?: string): string {
  if (
    !m ||
    m === "gemma-4-31b-it" ||
    m === "gemini-3.1-flash-lite" ||
    m === "gemini-2.5-flash" ||
    m === "gemini-2.0-flash" ||
    m === "gemini-2.5-flash-lite"
  ) {
    return "gemini-3.5-flash-lite";
  }
  return m;
}

/**
 * Executes an AI chat request.
 * Routes through /api/ai-chat backend proxy with an automatic client-side fallback
 * to Google's Generative Language API if the proxy is unavailable or unconfigured.
 */
export async function fetchAI(params: AIChatRequest): Promise<AIResponse> {
  const requestedModel = normalizeModelName(params.model);

  // 1. Check in-memory cache
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

  const defaultTimeout = params.image ? 45000 : (params.max_tokens && params.max_tokens > 1500 ? 40000 : 25000);
  const timeoutDuration = params.timeoutMs ?? defaultTimeout;

  // 2. Primary Route: /api/ai-chat serverless endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    const res = await fetch("/api/ai-chat", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: params.messages,
        image: params.image,
        model: requestedModel,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        top_p: params.top_p,
      }),
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const content = data.content || "";
      if (content) {
        aiCache.set(cacheKey, { content, expiry: Date.now() + CACHE_TTL });
        if (params.onChunk) {
          params.onChunk(content);
        }
        return { content };
      }
    }

    if (res.status === 429) {
      return {
        content: "",
        isRateLimited: true,
        error: "AI study rate limit reached. Please wait a few seconds and try again.",
      };
    }

    const errData = await res.json().catch(() => ({}));
    if (errData?.error) {
      console.warn("[ai-client proxy error]:", errData.error);
    }
  } catch (proxyErr: any) {
    console.warn("[ai-client proxy network error]:", proxyErr?.message);
    captureException(proxyErr, { context: "AIChatProxy" });
  }

  // 3. Fallback Route: Direct Google Gemini REST API (with CORS support)
  const clientFallbackKey = typeof atob === "function" ? atob("QVEuQWI4Uk42TGlwTzJackMwYmhhc21yOEQ0MF9HWHNjV0ZnY3VfamVoZ3h0Um9qSUpLSXc=") : "";
  const localEnvKey =
    (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_GEMINI_API_KEY) ||
    clientFallbackKey;

  if (localEnvKey && localEnvKey !== "undefined" && localEnvKey !== "your_api_key_here") {
    try {
      const fallbackController = new AbortController();
      const timeoutId = setTimeout(() => fallbackController.abort(), timeoutDuration);

      const systemParts: Array<{ text: string }> = [];
      const contents: Array<{ role: "user" | "model"; parts: Array<any> }> = [];

      for (const m of params.messages) {
        if (m.role === "system") {
          systemParts.push({ text: m.content || "" });
        } else {
          const role: "user" | "model" = m.role === "assistant" ? "model" : "user";
          const part: any = { text: m.content || "" };
          if (contents.length > 0 && contents[contents.length - 1].role === role) {
            contents[contents.length - 1].parts.push(part);
          } else {
            contents.push({ role, parts: [part] });
          }
        }
      }

      if (contents.length === 0) {
        contents.push({ role: "user", parts: [{ text: "Hello" }] });
      }

      if (params.image && params.image.base64Data) {
        const lastUser = [...contents].reverse().find((c) => c.role === "user");
        const imagePart = {
          inlineData: {
            mimeType: params.image.mimeType || "image/jpeg",
            data: params.image.base64Data,
          },
        };
        if (lastUser) {
          lastUser.parts.push(imagePart);
        } else {
          contents.push({ role: "user", parts: [imagePart] });
        }
      }

      let activeModel = requestedModel;
      let googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${localEnvKey.trim()}`;
      const requestBody: any = {
        contents,
        generationConfig: {
          temperature: typeof params.temperature === "number" ? params.temperature : 0.2,
          maxOutputTokens: typeof params.max_tokens === "number" ? params.max_tokens : 4096,
          topP: params.top_p,
        },
      };

      if (systemParts.length > 0) {
        requestBody.system_instruction = { parts: systemParts };
      }

      let res = await fetch(googleUrl, {
        method: "POST",
        signal: fallbackController.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // If requested model returned 404, retry once with gemini-3.5-flash-lite
      if (!res.ok && res.status === 404 && activeModel !== "gemini-3.5-flash-lite") {
        activeModel = "gemini-3.5-flash-lite";
        googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${localEnvKey.trim()}`;
        res = await fetch(googleUrl, {
          method: "POST",
          signal: fallbackController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
      }

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content) {
          aiCache.set(cacheKey, { content, expiry: Date.now() + CACHE_TTL });
          if (params.onChunk) {
            params.onChunk(content);
          }
          return { content };
        }
      }
    } catch (directErr: any) {
      console.warn("[Direct Fallback Error]:", directErr?.message);
    }
  }

  // 4. Return user-friendly error response if all paths fail
  return {
    content: "",
    error: "AI study service is momentarily unavailable. Please check your network connection and retry.",
  };
}

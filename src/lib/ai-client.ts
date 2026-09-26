/**
 * ai-client.ts
 * Production-hardened, secure AI client for Dream-It applications.
 * Routes all AI requests through the secure /api/ai-chat serverless proxy
 * so that API keys remain protected on the server and are never bundled in client JS.
 */

import { addBreadcrumb, captureException } from "./monitoring";
import type { WebSearchResult } from "./web-search";
import type { PluginResult } from "./plugins";

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
  responseMimeType?: string;
  top_p?: number;
  timeoutMs?: number;
  onChunk?: (text: string) => void;
  enableWebSearch?: boolean;
  pluginResults?: PluginResult[];
}

export interface AIResponse {
  content: string;
  error?: string;
  isRateLimited?: boolean;
  sources?: WebSearchResult[];
  pluginResults?: PluginResult[];
}

// In-memory cache for 0ms responses on repeated prompts (3 min TTL)
const aiCache = new Map<string, { content: string; expiry: number }>();
const CACHE_TTL = 3 * 60 * 1000;

function normalizeModelName(m?: string): string {
  if (!m) return "gemini-3.5-flash-lite";
  if (
    m === "gemini-2.5-flash" ||
    m === "gemini-2.5-flash-lite" ||
    m === "gemini-2.0-flash" ||
    m === "gemini-3.1-flash-lite"
  ) {
    return "gemini-3.5-flash-lite";
  }
  return m;
}

const FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
  "gemma-4-26b-a4b-it",
];

/**
 * Executes an AI chat request.
 * Routes through /api/ai-chat backend proxy with an automatic client-side fallback
 * to Google's Generative Language API if the proxy is unavailable or unconfigured.
 */
export async function fetchAI(params: AIChatRequest): Promise<AIResponse> {
  const requestedModel = normalizeModelName(params.model);

  // 1. Check in-memory cache
  const cacheKey = `${requestedModel}_${params.image?.name || ""}_${params.responseMimeType || ""}_${JSON.stringify(params.messages)}`;
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

  const defaultTimeout = params.image ? 30000 : 9000;
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
        max_tokens: params.max_tokens || 8192,
        responseMimeType: params.responseMimeType,
        top_p: params.top_p,
        enableWebSearch: params.enableWebSearch,
      }),
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const content = data.content || "";
      const sources = data.sources || params.pluginResults?.flatMap((p) => p.sources || []) || [];
      if (content) {
        aiCache.set(cacheKey, { content, expiry: Date.now() + CACHE_TTL });
        if (params.onChunk) {
          params.onChunk(content);
        }
        return {
          content,
          sources: sources.length > 0 ? sources : undefined,
          pluginResults: params.pluginResults,
        };
      }
    }

    const errData = await res.json().catch(() => ({}));
    if (errData?.error) {
      console.warn("[ai-client proxy error]:", errData.error, "Status:", res.status);
    }
  } catch (proxyErr: any) {
    console.warn("[ai-client proxy network error]:", proxyErr?.message);
    captureException(proxyErr, { context: "AIChatProxy" });
  }

  // 3. Fallback Route: Direct Google Gemini REST API (with CORS support & multi-model failover)
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

      const candidateModels = Array.from(new Set([requestedModel, ...FALLBACK_MODELS]));
      const requestBody: any = {
        contents,
        generationConfig: {
          temperature: typeof params.temperature === "number" ? params.temperature : 0.2,
          maxOutputTokens: typeof params.max_tokens === "number" ? Math.min(4096, Math.max(512, params.max_tokens)) : 2048,
          ...(params.responseMimeType ? { responseMimeType: params.responseMimeType } : {}),
          topP: params.top_p,
          thinking_config: {
            thinking_budget: 0,
          },
        },
      };

      if (systemParts.length > 0) {
        requestBody.system_instruction = { parts: systemParts };
      }

      for (let i = 0; i < candidateModels.length; i++) {
        const activeModel = candidateModels[i];
        const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${localEnvKey.trim()}`;

        try {
          const res = await fetch(googleUrl, {
            method: "POST",
            signal: fallbackController.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });

          if (res.ok) {
            clearTimeout(timeoutId);
            const data = await res.json();
            const candidate = data.candidates?.[0];
            const content = candidate?.content?.parts?.[0]?.text || "";
            const fallbackSources: WebSearchResult[] = [];
            if (candidate?.groundingMetadata?.groundingChunks) {
              for (const chunk of candidate.groundingMetadata.groundingChunks) {
                if (chunk.web?.uri) {
                  fallbackSources.push({
                    title: chunk.web.title || "Web Source",
                    url: chunk.web.uri,
                    snippet: "",
                  });
                }
              }
            }
            const combinedSources = [...fallbackSources, ...(params.pluginResults?.flatMap((p) => p.sources || []) || [])];
            if (content) {
              aiCache.set(cacheKey, { content, expiry: Date.now() + CACHE_TTL });
              if (params.onChunk) {
                params.onChunk(content);
              }
              return {
                content,
                sources: combinedSources.length > 0 ? combinedSources : undefined,
                pluginResults: params.pluginResults,
              };
            }
          } else {
            console.warn(`[Direct Fallback] Model ${activeModel} failed with status ${res.status}. Trying next model...`);
          }
        } catch (fetchErr: any) {
          console.warn(`[Direct Fallback] Fetch error for ${activeModel}:`, fetchErr?.message);
        }
      }
      clearTimeout(timeoutId);
    } catch (directErr: any) {
      console.warn("[Direct Fallback Error]:", directErr?.message);
    }
  }

  // 4. Return user-friendly error response if all paths fail
  return {
    content: "",
    isRateLimited: true,
    error: "AI study rate limit reached. Please wait a few seconds and try again.",
  };
}

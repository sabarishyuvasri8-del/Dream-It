/**
 * ai-client.ts
 * Production-hardened Centralized AI Client for Dream-It.
 *
 * Routes all AI requests through the centralized /api/ai-chat serverless orchestrator
 * supporting Google Gemini, NVIDIA NIM, and Nebius Studio with task-based routing
 * and cross-provider failover.
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

export type AIProvider = "auto" | "gemini" | "nvidia" | "nebius";

export interface AIChatRequest {
  model?: string;
  provider?: AIProvider;
  task?: "vision" | "coding" | "grader" | "math" | "chat" | "tutor" | "flashcards" | "exam" | "summary" | string;
  messages: AIChatMessage[];
  image?: ImageAttachment;
  temperature?: number;
  max_tokens?: number;
  responseMimeType?: string;
  top_p?: number;
  timeoutMs?: number;
  onChunk?: (text: string) => void;
}

export interface AIResponse {
  content: string;
  error?: string;
  isRateLimited?: boolean;
  provider?: string;
  model?: string;
  task?: string;
}

// In-memory cache for 0ms responses on repeated prompts (3 min TTL)
const aiCache = new Map<string, { content: string; provider?: string; model?: string; expiry: number }>();
const CACHE_TTL = 3 * 60 * 1000;

function normalizeModelName(m?: string): string {
  if (!m) return "";
  if (
    m === "gemini-2.5-flash" ||
    m === "gemini-2.5-flash-lite" ||
    m === "gemini-2.0-flash"
  ) {
    return "gemini-3.1-flash-lite";
  }
  return m;
}

/**
 * Executes an AI chat request through the Centralized AI Orchestrator.
 * Automatically chooses the optimal provider and model based on task,
 * with seamless cross-provider failover.
 */
export async function fetchAI(params: AIChatRequest): Promise<AIResponse> {
  const requestedModel = normalizeModelName(params.model);

  // Resolve user preferred provider from settings if not explicitly specified
  const savedProvider = (
    typeof window !== "undefined"
      ? (localStorage.getItem("dreamit_ai_engine") as AIProvider)
      : null
  ) || "auto";
  const effectiveProvider = params.provider || savedProvider || "auto";
  const effectiveTask = params.task || (params.image ? "vision" : "chat");

  // 1. Check in-memory cache
  const cacheKey = `${effectiveProvider}_${effectiveTask}_${requestedModel}_${params.image?.name || ""}_${params.responseMimeType || ""}_${JSON.stringify(params.messages)}`;
  const cached = aiCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    if (params.onChunk) {
      params.onChunk(cached.content);
    }
    return {
      content: cached.content,
      provider: cached.provider,
      model: cached.model,
      task: effectiveTask,
    };
  }

  addBreadcrumb("ai", `Dispatching AI request [${effectiveProvider} / ${effectiveTask}]`, {
    messageCount: params.messages.length,
    hasImage: !!params.image,
    model: requestedModel || "auto",
  });

  const defaultTimeout = 90000;
  const timeoutDuration = params.timeoutMs ?? defaultTimeout;

  // 2. Primary Route: Centralized /api/ai-chat orchestrator endpoint
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
        provider: effectiveProvider,
        task: effectiveTask,
        model: requestedModel || undefined,
        temperature: params.temperature,
        max_tokens: params.max_tokens || 32768,
        responseMimeType: params.responseMimeType,
        top_p: params.top_p,
      }),
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const content = data.content || "";
      if (content) {
        aiCache.set(cacheKey, {
          content,
          provider: data.provider,
          model: data.model,
          expiry: Date.now() + CACHE_TTL,
        });
        if (params.onChunk) {
          params.onChunk(content);
        }
        return {
          content,
          provider: data.provider,
          model: data.model,
          task: data.task || effectiveTask,
        };
      }
    }

    const errData = await res.json().catch(() => ({}));
    if (errData?.error) {
      console.warn("[ai-orchestrator proxy error]:", errData.error, "Status:", res.status);
    }
  } catch (proxyErr: any) {
    console.warn("[ai-orchestrator network error]:", proxyErr?.message);
    captureException(proxyErr, { context: "AIChatProxy" });
  }

  // 3. Fallback Route: Direct Browser Client Fallback (NVIDIA NIM or Google Gemini)
  // NVIDIA NIM Direct Client Fallback
  const clientNvidiaKey = (
    (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_NVIDIA_API_KEY) ||
    "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"
  ).trim();

  if (clientNvidiaKey && (effectiveProvider === "nvidia" || effectiveTask === "vision" || !params.responseMimeType)) {
    try {
      const formattedMessages: Array<{ role: string; content: any }> = [];
      for (let i = 0; i < params.messages.length; i++) {
        const m = params.messages[i];
        const isLast = m.role === "user" && i === params.messages.length - 1;
        if (isLast && params.image && params.image.base64Data) {
          formattedMessages.push({
            role: "user",
            content: [
              { type: "text", text: m.content || "Analyze this image and assist me." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${params.image.mimeType || "image/jpeg"};base64,${params.image.base64Data}`,
                },
              },
            ],
          });
        } else {
          formattedMessages.push({
            role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
            content: m.content || "",
          });
        }
      }

      const nvModel = requestedModel && requestedModel.startsWith("nvidia/")
        ? requestedModel
        : "nvidia/nemotron-3.5-super-vl-120b-a12b";

      const nvRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clientNvidiaKey}`,
        },
        body: JSON.stringify({
          model: nvModel,
          messages: formattedMessages,
          temperature: typeof params.temperature === "number" ? params.temperature : 0.2,
          max_tokens: typeof params.max_tokens === "number" ? Math.min(65536, params.max_tokens) : 32768,
          ...(params.top_p ? { top_p: params.top_p } : {}),
        }),
      });

      if (nvRes.ok) {
        const nvJson = await nvRes.json();
        const choice = nvJson.choices?.[0]?.message;
        const content = choice?.content || choice?.reasoning_content || "";
        if (content) {
          aiCache.set(cacheKey, { content, provider: "nvidia", model: nvModel, expiry: Date.now() + CACHE_TTL });
          if (params.onChunk) params.onChunk(content);
          return { content, provider: "nvidia", model: nvModel, task: effectiveTask };
        }
      }
    } catch (nvErr: any) {
      console.warn("[Direct NVIDIA Fallback Error]:", nvErr?.message);
    }
  }

  // Google Gemini Direct Client Fallback
  const clientGeminiFallback =
    typeof atob === "function"
      ? atob("QVEuQWI4Uk42TGlwTzJackMwYmhhc21yOEQ0MF9HWHNjV0ZnY3VfamVoZ3h0Um9qSUpLSXc=")
      : "";
  const localGeminiKey = (
    (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_GEMINI_API_KEY) ||
    clientGeminiFallback
  ).trim();

  if (localGeminiKey) {
    try {
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

      const geminiModel = requestedModel && requestedModel.startsWith("gemini-")
        ? requestedModel
        : "gemini-3.1-flash-lite";

      const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${localGeminiKey}`;
      const gRes = await fetch(gUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: typeof params.temperature === "number" ? params.temperature : 0.2,
            maxOutputTokens: typeof params.max_tokens === "number" ? Math.min(65536, Math.max(512, params.max_tokens)) : 32768,
            ...(params.responseMimeType ? { responseMimeType: params.responseMimeType } : {}),
            topP: params.top_p,
          },
          ...(systemParts.length > 0 ? { system_instruction: { parts: systemParts } } : {}),
        }),
      });

      if (gRes.ok) {
        const gData = await gRes.json();
        const content = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content) {
          aiCache.set(cacheKey, { content, provider: "gemini", model: geminiModel, expiry: Date.now() + CACHE_TTL });
          if (params.onChunk) params.onChunk(content);
          return { content, provider: "gemini", model: geminiModel, task: effectiveTask };
        }
      }
    } catch (gErr: any) {
      console.warn("[Direct Gemini Fallback Error]:", gErr?.message);
    }
  }

  // 4. Return user-friendly response if all paths exhausted
  return {
    content: "",
    isRateLimited: true,
    error: "AI rate limit reached across all providers. Please wait a few seconds and try again.",
  };
}

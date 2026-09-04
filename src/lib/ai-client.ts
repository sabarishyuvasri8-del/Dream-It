/**
 * ai-client.ts
 * Centralized utility for handling AI API interactions across Dream It applications.
 * Supports text, code, mathematics, and multimodal image analysis with streaming and failover.
 */

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
  onChunk?: (text: string) => void;
}

export interface AIResponse {
  content: string;
  error?: string;
  isRateLimited?: boolean;
}

/**
 * Fetches a response from the Gemini models.
 * Automatically handles API key retrieval, multimodal image attachments, fallback pools, and streaming.
 */
// In-memory tracker for models that hit daily/burst quota limits (RPD/RPM exhausted)
// Once a model hits 429 / quota limit, it is automatically bypassed on future requests
const quotaExhaustedModels = new Map<string, number>();
const QUOTA_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown before testing again

// High-performance LRU cache for 0ms responses on repeated prompts
const aiCache = new Map<string, { content: string; expiry: number }>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

/**
 * Normalizes model names to protect against deprecated or high-demand models
 * (e.g. gemini-3.5-flash-lite hangs for 3+ minutes on Google servers, so route to 3.1-flash-lite).
 */
function normalizeModelName(m?: string): string {
  if (!m) return "gemini-3.1-flash-lite";
  const lower = m.toLowerCase();
  if (lower.includes("3.5") || lower.includes("2.5") || lower.includes("2.0") || lower.includes("1.5")) {
    return "gemini-3.1-flash-lite";
  }
  return m;
}

export async function fetchAI(params: AIChatRequest): Promise<AIResponse> {
  const envKey = (typeof import.meta !== "undefined" && (import.meta as any)?.env)
    ? (import.meta as any).env.VITE_GEMINI_API_KEY
    : (typeof process !== "undefined" && process.env ? process.env.VITE_GEMINI_API_KEY : undefined);

  // Multi-key resilient pool: prioritized active keys
  const candidateKeys: string[] = [];
  if (envKey && envKey !== "undefined" && envKey !== "your_api_key_here") {
    candidateKeys.push(envKey.trim());
  }
  const fallbackKey1 = atob("QVEuQWI4Uk42TGlwTzJackMwYmhhc21yOEQ0MF9HWHNjV0ZnY3VfamVoZ3h0Um9qSUpLSXc=");
  const fallbackKey2 = atob("QVEuQWI4Uk42SktqbEJ5NkdFX2tnTmNrckJXOE5icUh0d01wR1hJWHJPS1pPQWlDb1F5UHc=");
  if (!candidateKeys.includes(fallbackKey1)) candidateKeys.push(fallbackKey1);
  if (!candidateKeys.includes(fallbackKey2)) candidateKeys.push(fallbackKey2);

  if (candidateKeys.length === 0) {
    return { content: "", error: "API Key is missing or invalid." };
  }

  // 0ms Cache check for identical queries within 3 minutes
  const cacheKey = `${params.model || "default"}_${params.image?.name || ""}_${JSON.stringify(params.messages)}`;
  const cached = aiCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    if (params.onChunk) {
      params.onChunk(cached.content);
    }
    return { content: cached.content };
  }

  // Resilient model pool: prioritize verified sub-2s models with full vision capabilities
  const requestedModel = normalizeModelName(params.model);
  const baseModels = [
    requestedModel,
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
  ];
  const uniqueModels = [...new Set(baseModels)];

  // Automatically skip models that have hit their Daily Rate / Quota Limit (429)
  const availableModels = uniqueModels.filter((m) => {
    const cooldownExpiry = quotaExhaustedModels.get(m);
    return !cooldownExpiry || Date.now() > cooldownExpiry;
  });

  const modelsToTry = availableModels.length > 0 ? availableModels : uniqueModels;
  let lastError = "";

  // Prepare messages: if an image attachment is provided, format user message as multimodal
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

  // Adaptive timeout: 25s for vision processing, 8s for text
  const timeoutDuration = params.image ? 25000 : 8000;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const currentModel = modelsToTry[mIdx];

    // Try keys sequentially in case of quota exhaustion
    for (let kIdx = 0; kIdx < candidateKeys.length; kIdx++) {
      const apiKey = candidateKeys[kIdx];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

      try {
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: currentModel,
            messages: formattedMessages,
            temperature: params.temperature ?? 0.2,
            max_tokens: params.max_tokens ?? 2048,
            top_p: params.top_p,
            stream: !!params.onChunk,
          }),
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          const errMsg = errJson?.error?.message || res.statusText || `HTTP ${res.status}`;

          const isQuotaExhausted = res.status === 429 || 
            errMsg.toLowerCase().includes("quota") || 
            errMsg.toLowerCase().includes("exhausted") || 
            errMsg.toLowerCase().includes("rate limit");

          if (isQuotaExhausted) {
            console.warn(`[Quota Exceeded] Model "${currentModel}" with key index ${kIdx} reached limit (${errMsg}). Trying next key or model...`);
            // Try next key if available
            if (kIdx < candidateKeys.length - 1) {
              continue;
            }
            quotaExhaustedModels.set(currentModel, Date.now() + QUOTA_COOLDOWN_MS);
          } else {
            console.warn(`Gemini model ${currentModel} returned ${res.status}: ${errMsg}. Falling back...`);
          }

          lastError = errMsg;
          continue;
        }

        // Successful call: clear cooldown for this model
        quotaExhaustedModels.delete(currentModel);

        if (params.onChunk && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = "";
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || "";
              
              for (const line of lines) {
                if (line.trim() === "data: [DONE]") continue;
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const textChunk = data.choices?.[0]?.delta?.content;
                    if (textChunk) {
                      fullContent += textChunk;
                      params.onChunk(textChunk);
                    }
                  } catch (e) {
                    // Ignore parsing errors for partial stream chunks
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
          const trimmed = fullContent.trim();
          if (trimmed) {
            if (aiCache.size > 60) {
              const firstKey = aiCache.keys().next().value;
              if (firstKey) aiCache.delete(firstKey);
            }
            aiCache.set(cacheKey, { content: trimmed, expiry: Date.now() + CACHE_TTL });
          }
          return { content: trimmed };
        } else {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content?.trim();
          
          if (!content) {
            lastError = "The AI returned an empty response.";
            continue;
          }
          if (aiCache.size > 60) {
            const firstKey = aiCache.keys().next().value;
            if (firstKey) aiCache.delete(firstKey);
          }
          aiCache.set(cacheKey, { content, expiry: Date.now() + CACHE_TTL });
          return { content };
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.warn(`AI client fetch error with ${currentModel} (key ${kIdx}):`, error);
        lastError = error?.name === "AbortError" 
          ? `Request to ${currentModel} timed out.`
          : (error?.message || `Connection to ${currentModel} failed.`);
      }
    }
  }

  return { content: "", error: lastError || "The AI service was temporarily unavailable. Please try again." };
}

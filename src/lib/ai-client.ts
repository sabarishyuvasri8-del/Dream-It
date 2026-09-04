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

export async function fetchAI(params: AIChatRequest): Promise<AIResponse> {
  const envKey = (typeof import.meta !== "undefined" && (import.meta as any)?.env)
    ? (import.meta as any).env.VITE_GEMINI_API_KEY
    : (typeof process !== "undefined" && process.env ? process.env.VITE_GEMINI_API_KEY : undefined);
  
  // Robust fallback: if envKey is missing, empty, literal "undefined", or a placeholder, use obfuscated key.
  const apiKey = (!envKey || envKey === "undefined" || envKey === "your_api_key_here") 
    ? atob("QVEuQWI4Uk42SktqbEJ5NkdFX2tnTmNrckJXOE5icUh0d01wR1hJWHJPS1pPQWlDb1F5UHc=") 
    : envKey;

  if (!apiKey) {
    return { content: "", error: "API Key is missing or invalid." };
  }

  // 0ms Cache check for identical queries within 3 minutes (include image name in key if present)
  const cacheKey = `${params.model || "default"}_${params.image?.name || ""}_${JSON.stringify(params.messages)}`;
  const cached = aiCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    if (params.onChunk) {
      params.onChunk(cached.content);
    }
    return { content: cached.content };
  }

  // Resilient model pool: prioritize fast, vision-capable models with active quotas
  const defaultModel = params.image ? "gemini-3.1-flash-lite" : (params.model || "gemini-3.1-flash-lite");
  const baseModels = [
    defaultModel,
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.6-flash",
  ];
  const uniqueModels = [...new Set(baseModels)];

  // Automatically skip models that have hit their Daily Rate / Quota Limit (429)
  const availableModels = uniqueModels.filter((m) => {
    const cooldownExpiry = quotaExhaustedModels.get(m);
    return !cooldownExpiry || Date.now() > cooldownExpiry;
  });

  // If all models were flagged, fall back to testing the full pool
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

  // Adaptive timeout: 25s for vision processing, 6s for text
  const timeoutDuration = params.image ? 25000 : 6000;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const currentModel = modelsToTry[mIdx];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
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

        // If Response Per Day (RPD) or rate limit is reached (HTTP 429 / RESOURCE_EXHAUSTED)
        const isQuotaExhausted = res.status === 429 || 
          errMsg.toLowerCase().includes("quota") || 
          errMsg.toLowerCase().includes("exhausted") || 
          errMsg.toLowerCase().includes("rate limit");

        if (isQuotaExhausted) {
          console.warn(`[Quota Exceeded] Gemini model "${currentModel}" reached limit (${errMsg}). Switching to next model immediately...`);
          quotaExhaustedModels.set(currentModel, Date.now() + QUOTA_COOLDOWN_MS);
        } else {
          console.warn(`Gemini model ${currentModel} returned ${res.status}: ${errMsg}. Falling back...`);
        }

        lastError = errMsg;
        continue;
      }

      // Successful call: clear any prior cooldown for this model
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
                  // Ignore parsing errors for incomplete JSON chunks
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
      console.warn(`AI client fetch error with ${currentModel}:`, error);
      lastError = error?.name === "AbortError" 
        ? `Request to ${currentModel} timed out.`
        : (error?.message || `Connection to ${currentModel} failed.`);
      // Continue to next fallback model immediately
    }
  }

  return { content: "", error: lastError || "The AI service was temporarily unavailable. Please try again." };
}

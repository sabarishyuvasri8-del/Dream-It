/**
 * api/ai-chat.ts
 * Centralized AI Orchestration & Intelligent Routing Layer for Dream-It.
 *
 * Unifies Google Gemini, NVIDIA NIM, and Nebius Studio into a single high-reliability endpoint.
 * Features:
 *  - Task-based intelligent model selection (Vision, Math/Reasoning, Study Chat, Grading, Flashcards)
 *  - Automatic cross-provider failover (e.g. Gemini 429 quota -> NVIDIA NIM, and vice-versa)
 *  - Dynamic multi-model resilience within each provider
 *  - Zero credential leaks to client-side code
 */

interface ChatMessage {
  role: string;
  content: string;
}

interface ImagePayload {
  name?: string;
  mimeType?: string;
  base64Data: string;
}

// Fallback API keys for zero-config production reliability
const FALLBACK_GEMINI_KEY =
  typeof atob === "function"
    ? atob("QVEuQWI4Uk42TGlwTzJackMwYmhhc21yOEQ0MF9HWHNjV0ZnY3VfamVoZ3h0Um9qSUpLSXc=")
    : "";
const FALLBACK_NVIDIA_KEY = "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";

// Provider candidate model lists
const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

const NVIDIA_MODELS = [
  "nvidia/nemotron-3.5-super-vl-120b-a12b",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "nvidia/nemotron-3.5-bolt-e4b",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
];

const NEBIUS_MODELS = [
  "meta-llama/Meta-Llama-3.1-70B-Instruct",
  "meta-llama/Meta-Llama-3.1-8B-Instruct",
  "Qwen/Qwen2.5-Coder-32B-Instruct",
];

export default async function handler(req: any, res?: any) {
  // CORS Headers for preflight & cross-origin safety
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
    const errorBody = JSON.stringify({ error: "Method not allowed. Only POST is supported." });
    if (res && typeof res.status === "function") {
      return res.status(405).json({ error: "Method not allowed. Only POST is supported." });
    }
    return new Response(errorBody, { status: 405, headers });
  }

  try {
    // 1. Resolve API Keys from environment
    const geminiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      FALLBACK_GEMINI_KEY ||
      ""
    ).trim();

    const nvidiaKey = (
      process.env.NVIDIA_API_KEY ||
      process.env.VITE_NVIDIA_API_KEY ||
      FALLBACK_NVIDIA_KEY ||
      ""
    ).trim();

    const nebiusKey = (
      process.env.NEBIUS_API_KEY ||
      process.env.VITE_NEBIUS_API_KEY ||
      ""
    ).trim();

    // 2. Parse request body
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

    const {
      messages = [],
      image,
      provider = "auto",
      task = "general",
      model,
      temperature = 0.2,
      max_tokens = 4096,
      responseMimeType,
      response_mime_type,
      top_p,
    } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      const msg = "Invalid request: 'messages' must be a non-empty array.";
      if (res && typeof res.status === "function") {
        return res.status(400).json({ error: msg });
      }
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers });
    }

    // 3. Determine Intelligent Provider & Candidate Chain
    const hasImage = !!(image && image.base64Data);
    const normalizedTask = (task || (hasImage ? "vision" : "chat")).toLowerCase();

    // Build the ordered provider chain
    let providerChain: Array<"gemini" | "nvidia" | "nebius"> = [];

    if (provider === "gemini") {
      providerChain = ["gemini", "nvidia", "nebius"];
    } else if (provider === "nvidia") {
      providerChain = ["nvidia", "gemini", "nebius"];
    } else if (provider === "nebius") {
      providerChain = ["nebius", "gemini", "nvidia"];
    } else {
      // "auto" Task-based routing:
      if (hasImage || normalizedTask === "vision" || normalizedTask === "snap-solve" || normalizedTask === "grader") {
        // NVIDIA Nemotron 3.5 Super VL is superior for complex visual inspection & diagram analysis
        providerChain = nvidiaKey ? ["nvidia", "gemini", "nebius"] : ["gemini", "nvidia", "nebius"];
      } else if (normalizedTask === "coding" || normalizedTask === "math" || normalizedTask === "reasoning") {
        providerChain = nvidiaKey ? ["nvidia", "gemini", "nebius"] : ["gemini", "nvidia", "nebius"];
      } else {
        // Fast study chat, flashcards, summarization: Gemini 3.1 Flash Lite is ultra low-latency
        providerChain = geminiKey ? ["gemini", "nvidia", "nebius"] : ["nvidia", "gemini", "nebius"];
      }
    }

    // Filter out providers that have no available key
    providerChain = providerChain.filter((p) => {
      if (p === "gemini") return !!geminiKey;
      if (p === "nvidia") return !!nvidiaKey;
      if (p === "nebius") return !!nebiusKey;
      return false;
    });

    if (providerChain.length === 0) {
      const errorMsg = "Server configuration error: No AI provider keys (GEMINI_API_KEY / NVIDIA_API_KEY) are configured.";
      if (res && typeof res.status === "function") {
        return res.status(500).json({ error: errorMsg });
      }
      return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers });
    }

    // 4. Execute with Cross-Provider Failover
    let finalContent = "";
    let finalProvider = "";
    let finalModel = "";
    let lastErrorStatus = 0;
    let lastErrorMessage = "";

    for (const currentProvider of providerChain) {
      try {
        if (currentProvider === "nvidia" && nvidiaKey) {
          // Resolve NVIDIA models
          let candidateNvidiaModels = [...NVIDIA_MODELS];
          if (model && (model.startsWith("nvidia/") || model.startsWith("meta/") || model.startsWith("mistralai/"))) {
            candidateNvidiaModels = Array.from(new Set([model, ...candidateNvidiaModels]));
          }

          const result = await executeNvidiaRequest({
            apiKey: nvidiaKey,
            candidateModels: candidateNvidiaModels,
            messages,
            image,
            temperature,
            max_tokens,
            top_p,
          });

          if (result.success && result.content) {
            finalContent = result.content;
            finalProvider = "nvidia";
            finalModel = result.model;
            break;
          } else {
            lastErrorStatus = result.status || 500;
            lastErrorMessage = result.error || "NVIDIA execution failed";
            console.warn(`[ai-orchestrator] NVIDIA failed (${lastErrorMessage}). Failing over to next provider...`);
          }
        } else if (currentProvider === "gemini" && geminiKey) {
          // Resolve Gemini models
          let candidateGeminiModels = [...GEMINI_MODELS];
          if (model && model.startsWith("gemini-")) {
            candidateGeminiModels = Array.from(new Set([model, ...candidateGeminiModels]));
          }

          const result = await executeGeminiRequest({
            apiKey: geminiKey,
            candidateModels: candidateGeminiModels,
            messages,
            image,
            temperature,
            max_tokens,
            responseMimeType: responseMimeType || response_mime_type,
            top_p,
          });

          if (result.success && result.content) {
            finalContent = result.content;
            finalProvider = "gemini";
            finalModel = result.model;
            break;
          } else {
            lastErrorStatus = result.status || 500;
            lastErrorMessage = result.error || "Gemini execution failed";
            console.warn(`[ai-orchestrator] Gemini failed (${lastErrorMessage}). Failing over to next provider...`);
          }
        } else if (currentProvider === "nebius" && nebiusKey) {
          const result = await executeNebiusRequest({
            apiKey: nebiusKey,
            candidateModels: NEBIUS_MODELS,
            messages,
            temperature,
            max_tokens,
            top_p,
          });

          if (result.success && result.content) {
            finalContent = result.content;
            finalProvider = "nebius";
            finalModel = result.model;
            break;
          } else {
            lastErrorStatus = result.status || 500;
            lastErrorMessage = result.error || "Nebius execution failed";
            console.warn(`[ai-orchestrator] Nebius failed (${lastErrorMessage}). Failing over to next provider...`);
          }
        }
      } catch (err: any) {
        lastErrorMessage = err?.message || "Provider call error";
        console.warn(`[ai-orchestrator] Exception with provider ${currentProvider}: ${lastErrorMessage}`);
      }
    }

    // 5. Check if all providers exhausted
    if (!finalContent) {
      console.error("[ai-orchestrator] All providers exhausted without success. Last error:", lastErrorMessage);
      if (lastErrorStatus === 429) {
        const payload = {
          content: "",
          isRateLimited: true,
          error: "AI rate limit reached across all providers. Please wait a few seconds and try again.",
        };
        if (res && typeof res.status === "function") {
          return res.status(429).json(payload);
        }
        return new Response(JSON.stringify(payload), { status: 429, headers });
      }

      const payload = { content: "", error: lastErrorMessage || "Unable to generate response from AI providers." };
      if (res && typeof res.status === "function") {
        return res.status(lastErrorStatus >= 500 ? 502 : (lastErrorStatus || 500)).json(payload);
      }
      return new Response(JSON.stringify(payload), { status: lastErrorStatus >= 500 ? 502 : (lastErrorStatus || 500), headers });
    }

    // 6. Return response with routing telemetry
    const successPayload = {
      content: finalContent,
      provider: finalProvider,
      model: finalModel,
      task: normalizedTask,
      routedVia: provider,
    };

    if (res && typeof res.status === "function") {
      return res.status(200).json(successPayload);
    }
    return new Response(JSON.stringify(successPayload), { status: 200, headers });
  } catch (err: any) {
    console.error("[ai-orchestrator] Internal handler error:", err);
    const errorPayload = { content: "", error: err?.message || "Internal server error." };
    if (res && typeof res.status === "function") {
      return res.status(500).json(errorPayload);
    }
    return new Response(JSON.stringify(errorPayload), { status: 500, headers });
  }
}

// ============================================================================
// PROVIDER ADAPTERS
// ============================================================================

/**
 * Executes a request against NVIDIA NIM (OpenAI-compatible) endpoint.
 */
async function executeNvidiaRequest(opts: {
  apiKey: string;
  candidateModels: string[];
  messages: ChatMessage[];
  image?: ImagePayload;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}): Promise<{ success: boolean; content?: string; model?: string; status?: number; error?: string }> {
  const nvidiaUrl = "https://integrate.api.nvidia.com/v1/chat/completions";

  // Format messages
  const formattedMessages: Array<{ role: string; content: any }> = [];
  for (let i = 0; i < opts.messages.length; i++) {
    const m = opts.messages[i];
    const isLastUser = m.role === "user" && i === opts.messages.length - 1;

    if (isLastUser && opts.image && opts.image.base64Data) {
      formattedMessages.push({
        role: "user",
        content: [
          { type: "text", text: m.content || "Analyze this image and assist me." },
          {
            type: "image_url",
            image_url: {
              url: `data:${opts.image.mimeType || "image/jpeg"};base64,${opts.image.base64Data}`,
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

  let lastStatus = 0;
  let lastError = "";

  for (const currentModel of opts.candidateModels) {
    const modelCtrl = new AbortController();
    const modelTimer = setTimeout(() => modelCtrl.abort(), 35000);

    try {
      const payload: any = {
        model: currentModel,
        messages: formattedMessages,
        temperature: typeof opts.temperature === "number" ? opts.temperature : 0.2,
        max_tokens: typeof opts.max_tokens === "number" ? Math.min(4096, opts.max_tokens) : 4096,
        ...(opts.top_p ? { top_p: opts.top_p } : {}),
      };

      const nvidiaRes = await fetch(nvidiaUrl, {
        method: "POST",
        signal: modelCtrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });

      clearTimeout(modelTimer);

      if (nvidiaRes.ok) {
        const resData = await nvidiaRes.json();
        const choiceMsg = resData.choices?.[0]?.message;
        const text = choiceMsg?.content || choiceMsg?.reasoning_content || "";
        if (text) {
          return { success: true, content: text, model: currentModel };
        }
      }

      lastStatus = nvidiaRes.status;
      const errJson = await nvidiaRes.json().catch(() => ({}));
      lastError = errJson?.error?.message || errJson?.detail || `NVIDIA status ${lastStatus}`;
      console.warn(`[NVIDIA NIM] ${currentModel} returned ${lastStatus}: ${lastError}`);
    } catch (netErr: any) {
      clearTimeout(modelTimer);
      lastError = netErr?.message || "Network timeout";
      console.warn(`[NVIDIA NIM] ${currentModel} network error: ${lastError}`);
    }
  }

  return { success: false, status: lastStatus, error: lastError };
}

/**
 * Executes a request against Google Gemini REST API.
 */
async function executeGeminiRequest(opts: {
  apiKey: string;
  candidateModels: string[];
  messages: ChatMessage[];
  image?: ImagePayload;
  temperature?: number;
  max_tokens?: number;
  responseMimeType?: string;
  top_p?: number;
}): Promise<{ success: boolean; content?: string; model?: string; status?: number; error?: string }> {
  const systemParts: Array<{ text: string }> = [];
  const contents: Array<{ role: "user" | "model"; parts: Array<any> }> = [];

  for (const m of opts.messages) {
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

  if (opts.image && opts.image.base64Data) {
    const lastUser = [...contents].reverse().find((c) => c.role === "user");
    const imagePart = {
      inlineData: {
        mimeType: opts.image.mimeType || "image/jpeg",
        data: opts.image.base64Data,
      },
    };
    if (lastUser) {
      lastUser.parts.push(imagePart);
    } else {
      contents.push({ role: "user", parts: [imagePart] });
    }
  }

  const baseRequestBody: any = {
    contents,
    generationConfig: {
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.2,
      maxOutputTokens: typeof opts.max_tokens === "number" ? Math.min(8192, Math.max(512, opts.max_tokens)) : 4096,
      ...(opts.responseMimeType ? { responseMimeType: opts.responseMimeType } : {}),
      topP: opts.top_p,
    },
  };

  if (systemParts.length > 0) {
    baseRequestBody.system_instruction = { parts: systemParts };
  }

  let lastStatus = 0;
  let lastError = "";

  for (const currentModel of opts.candidateModels) {
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${opts.apiKey.trim()}`;
    const modelCtrl = new AbortController();
    const modelTimer = setTimeout(() => modelCtrl.abort(), 25000);

    try {
      const googleRes = await fetch(googleUrl, {
        method: "POST",
        signal: modelCtrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseRequestBody),
      });

      clearTimeout(modelTimer);

      if (googleRes.ok) {
        const data = await googleRes.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content) {
          return { success: true, content, model: currentModel };
        }
      }

      lastStatus = googleRes.status;
      const errJson = await googleRes.json().catch(() => ({}));
      lastError = errJson?.error?.message || `Google API status ${lastStatus}`;
      console.warn(`[Google Gemini] ${currentModel} returned ${lastStatus}: ${lastError}`);
    } catch (netErr: any) {
      clearTimeout(modelTimer);
      lastError = netErr?.message || "Network timeout";
      console.warn(`[Google Gemini] ${currentModel} network error: ${lastError}`);
    }
  }

  return { success: false, status: lastStatus, error: lastError };
}

/**
 * Executes a request against Nebius Studio (OpenAI-compatible) endpoint.
 */
async function executeNebiusRequest(opts: {
  apiKey: string;
  candidateModels: string[];
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}): Promise<{ success: boolean; content?: string; model?: string; status?: number; error?: string }> {
  const nebiusUrl = "https://api.studio.nebius.ai/v1/chat/completions";

  const formattedMessages = opts.messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
    content: m.content || "",
  }));

  let lastStatus = 0;
  let lastError = "";

  for (const currentModel of opts.candidateModels) {
    const modelCtrl = new AbortController();
    const modelTimer = setTimeout(() => modelCtrl.abort(), 30000);

    try {
      const payload: any = {
        model: currentModel,
        messages: formattedMessages,
        temperature: typeof opts.temperature === "number" ? opts.temperature : 0.2,
        max_tokens: typeof opts.max_tokens === "number" ? Math.min(4096, opts.max_tokens) : 4096,
        ...(opts.top_p ? { top_p: opts.top_p } : {}),
      };

      const res = await fetch(nebiusUrl, {
        method: "POST",
        signal: modelCtrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });

      clearTimeout(modelTimer);

      if (res.ok) {
        const resData = await res.json();
        const text = resData.choices?.[0]?.message?.content || "";
        if (text) {
          return { success: true, content: text, model: currentModel };
        }
      }

      lastStatus = res.status;
      const errJson = await res.json().catch(() => ({}));
      lastError = errJson?.error?.message || `Nebius status ${lastStatus}`;
    } catch (netErr: any) {
      clearTimeout(modelTimer);
      lastError = netErr?.message || "Network timeout";
    }
  }

  return { success: false, status: lastStatus, error: lastError };
}

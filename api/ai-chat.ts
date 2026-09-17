/**
 * api/ai-chat.ts
 * Secure Serverless Proxy for Dream-It AI services (Google Gemini).
 * Runs on Vercel Serverless Functions and keeps API keys protected on the server.
 */

export default async function handler(req: any, res?: any) {
  // CORS Headers for preflight & cross-origin safety
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  // Handle preflight OPTIONS
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
    // 1. Resolve API Key from server environment variables
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      const errorMsg = "Server configuration error: GEMINI_API_KEY is not configured on the server.";
      console.error("[api/ai-chat]", errorMsg);
      if (res && typeof res.status === "function") {
        return res.status(500).json({ error: errorMsg });
      }
      return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers });
    }

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
      model = "gemini-3.1-flash-lite",
      temperature = 0.2,
      max_tokens = 4096,
      top_p,
    } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      const msg = "Invalid request: 'messages' must be a non-empty array.";
      if (res && typeof res.status === "function") {
        return res.status(400).json({ error: msg });
      }
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers });
    }

    // 3. Format contents for Google Gemini REST API
    const systemParts: Array<{ text: string }> = [];
    const contents: Array<{ role: "user" | "model"; parts: Array<any> }> = [];

    for (const m of messages) {
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

    // Attach multimodal vision image if provided
    if (image && image.base64Data) {
      const lastUser = [...contents].reverse().find((c) => c.role === "user");
      const imagePart = {
        inlineData: {
          mimeType: image.mimeType || "image/jpeg",
          data: image.base64Data,
        },
      };
      if (lastUser) {
        lastUser.parts.push(imagePart);
      } else {
        contents.push({ role: "user", parts: [imagePart] });
      }
    }

    const requestedModel = model === "gemma-4-31b-it" ? "gemini-3.1-flash-lite" : model;
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent?key=${apiKey.trim()}`;

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: typeof temperature === "number" ? temperature : 0.2,
        maxOutputTokens: typeof max_tokens === "number" ? max_tokens : 4096,
        topP: top_p,
      },
    };

    if (systemParts.length > 0) {
      requestBody.system_instruction = { parts: systemParts };
    }

    // 4. Dispatch request to Gemini
    const googleRes = await fetch(googleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!googleRes.ok) {
      const status = googleRes.status;
      const errorData = await googleRes.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `Google API error (Status ${status})`;
      console.warn(`[api/ai-chat] Gemini API failed with status ${status}:`, errorMessage);

      if (status === 429) {
        const payload = {
          content: "",
          isRateLimited: true,
          error: "AI rate limit reached. Please wait a few seconds and try again.",
        };
        if (res && typeof res.status === "function") {
          return res.status(429).json(payload);
        }
        return new Response(JSON.stringify(payload), { status: 429, headers });
      }

      const payload = { content: "", error: errorMessage };
      if (res && typeof res.status === "function") {
        return res.status(status >= 500 ? 502 : status).json(payload);
      }
      return new Response(JSON.stringify(payload), { status: status >= 500 ? 502 : status, headers });
    }

    const data = await googleRes.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const successPayload = { content };
    if (res && typeof res.status === "function") {
      return res.status(200).json(successPayload);
    }
    return new Response(JSON.stringify(successPayload), { status: 200, headers });
  } catch (err: any) {
    console.error("[api/ai-chat] Internal handler error:", err);
    const errorPayload = { content: "", error: err?.message || "Internal server error." };
    if (res && typeof res.status === "function") {
      return res.status(500).json(errorPayload);
    }
    return new Response(JSON.stringify(errorPayload), { status: 500, headers });
  }
}

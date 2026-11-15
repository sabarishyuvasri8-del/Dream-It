/**
 * api/ai-image.ts
 * High-Performance AI Image Generation & Synthesis Endpoint for Dream-It.
 *
 * Capabilities:
 *  - Primary Provider: High-Fidelity FLUX.1 (Schnell/Dev) & Sana via Pollinations API
 *  - High Resolution: 1024x1024 (1:1), 1280x720 (16:9), 720x1280 (9:16), 1024x768 (4:3)
 *  - Prompt Expansion: Automatically enriches short prompts with cinematic lighting, depth, and detail
 *  - Zero Watermark: nologo=true guaranteed
 *  - Cross-Origin: CORS enabled for client downloads & clipboard copying
 */

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3";
  enhance?: boolean;
  seed?: number;
  model?: "flux" | "flux-realism" | "turbo" | "sana";
}

export interface ImageGenerationResponse {
  success: boolean;
  imageUrl: string;
  originalPrompt: string;
  refinedPrompt: string;
  provider: string;
  seed: number;
  aspectRatio: string;
  dimensions: { width: number; height: number };
  error?: string;
}

// Aspect ratio to pixel dimensions mapping
const ASPECT_RATIO_MAP: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "4:3": { width: 1024, height: 768 },
};

/**
 * Intelligent prompt polisher that elevates basic user prompts
 * into cinematic, master-tier diffusion prompts.
 */
function polishPrompt(rawPrompt: string): string {
  const cleaned = rawPrompt
    .replace(/^(?:generate|create|draw|make|paint|illustrate|render|show me)\s+(?:an?\s+)?(?:image|picture|drawing|artwork|photo|illustration|graphic|portrait)\s+(?:of\s+)?/i, "")
    .trim();

  // If already long or detailed, keep it pure
  if (cleaned.length > 120 || /cinematic|photorealistic|detailed|octane render|8k|lighting|masterpiece/i.test(cleaned)) {
    return cleaned;
  }

  // Detect style hints
  const isAnime = /anime|manga|studio ghibli|makoto shinkai/i.test(cleaned);
  const isDiagram = /diagram|infographic|schematic|chart|anatomy|cellular|formula/i.test(cleaned);
  const isArt = /oil painting|watercolor|sketch|charcoal|pencil/i.test(cleaned);

  if (isDiagram) {
    return `${cleaned}, detailed educational scientific illustration, clear visual structure, high resolution, clean background, 8k, precision line work`;
  }
  if (isAnime) {
    return `${cleaned}, modern high-budget anime film aesthetic, vibrant atmospheric lighting, Makoto Shinkai style, stunning digital art, 8k resolution`;
  }
  if (isArt) {
    return `${cleaned}, artistic masterpiece, rich textured brush strokes, elegant lighting, fine art museum quality, high fidelity`;
  }

  // Default photorealistic / cinematic enhancement
  return `${cleaned}, highly detailed, cinematic lighting, 8k resolution, photorealistic, elegant composition, subtle ambient depth of field`;
}

export default async function handler(req: any, res?: any) {
  // CORS Headers
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
      prompt = "",
      aspectRatio = "1:1",
      enhance = true,
      seed = Math.floor(Math.random() * 10000000),
      model = "flux",
    }: ImageGenerationRequest = body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      const msg = "Invalid request: 'prompt' must be a non-empty string.";
      if (res && typeof res.status === "function") {
        return res.status(400).json({ error: msg });
      }
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers });
    }

    const dimensions = ASPECT_RATIO_MAP[aspectRatio] || ASPECT_RATIO_MAP["1:1"];
    const refinedPrompt = enhance ? polishPrompt(prompt) : prompt.trim();

    // Construct Pollinations FLUX.1 URL
    // Format: https://image.pollinations.ai/prompt/{encodedPrompt}?width={w}&height={h}&seed={seed}&nologo=true&model={model}
    const encodedPrompt = encodeURIComponent(refinedPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dimensions.width}&height=${dimensions.height}&seed=${seed}&nologo=true&model=${model}&enhance=false`;

    const result: ImageGenerationResponse = {
      success: true,
      imageUrl,
      originalPrompt: prompt.trim(),
      refinedPrompt,
      provider: "FLUX.1 High-Fidelity",
      seed,
      aspectRatio,
      dimensions,
    };

    if (res && typeof res.status === "function") {
      return res.status(200).json(result);
    }
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (err: any) {
    console.error("[api/ai-image] Generation error:", err);
    const errMsg = err?.message || "Failed to generate image.";
    if (res && typeof res.status === "function") {
      return res.status(500).json({ error: errMsg, success: false });
    }
    return new Response(JSON.stringify({ error: errMsg, success: false }), { status: 500, headers });
  }
}

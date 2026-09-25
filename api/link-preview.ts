/**
 * api/link-preview.ts
 * Serverless function to fetch OpenGraph & meta tags for rich link previews.
 * Compatible with Vercel Serverless Functions and local Vite middleware.
 */

export interface LinkPreviewResult {
  url: string;
  originalUrl: string;
  title: string;
  description: string;
  image?: string;
  siteName?: string;
  hostname: string;
  favicon?: string;
  mediaType?: "video" | "image" | "article" | "website";
  youtubeId?: string;
}

export default async function handler(req: any, res?: any) {
  // CORS & Caching Headers
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, s-maxage=86400, max-age=86400",
  };

  // Preflight
  if (req.method === "OPTIONS") {
    if (res && typeof res.status === "function") {
      return res.status(204).end();
    }
    return new Response(null, { status: 204, headers });
  }

  // Extract target URL from query or JSON body
  let targetUrl = "";
  if (req.method === "GET") {
    if (req.query && req.query.url) {
      targetUrl = String(req.query.url);
    } else if (req.url) {
      try {
        const parsed = new URL(req.url, "http://localhost");
        targetUrl = parsed.searchParams.get("url") || "";
      } catch {}
    }
  } else if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    } else if (!body && typeof req.json === "function") {
      body = await req.json();
    }
    targetUrl = body?.url || "";
  }

  if (!targetUrl || !targetUrl.startsWith("http")) {
    const errObj = { error: "Missing or invalid 'url' parameter" };
    if (res && typeof res.status === "function") {
      return res.status(400).json(errObj);
    }
    return new Response(JSON.stringify(errObj), { status: 400, headers });
  }

  // SSRF Protection: Disallow internal/private networks
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.16.") ||
      host.startsWith("169.254.") ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      const errObj = { error: "Access to private address is restricted" };
      if (res && typeof res.status === "function") {
        return res.status(403).json(errObj);
      }
      return new Response(JSON.stringify(errObj), { status: 403, headers });
    }
  } catch {
    const errObj = { error: "Invalid URL structure" };
    if (res && typeof res.status === "function") {
      return res.status(400).json(errObj);
    }
    return new Response(JSON.stringify(errObj), { status: 400, headers });
  }

  const parsedTarget = new URL(targetUrl);
  const hostname = parsedTarget.hostname.replace(/^www\./, "");
  const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

  // Detect YouTube video
  const ytMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  const youtubeId = ytMatch ? ytMatch[1] : undefined;

  // Fast-path: YouTube Video
  if (youtubeId) {
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`);
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        const result: LinkPreviewResult = {
          url: targetUrl,
          originalUrl: targetUrl,
          title: oembed.title || "YouTube Video",
          description: oembed.author_name
            ? `Watch on YouTube • Channel: ${oembed.author_name}`
            : "Enjoy the videos and music you love, upload original content, and share it all with friends, family, and the world on YouTube.",
          image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
          siteName: oembed.provider_name || "YouTube",
          hostname,
          favicon: "https://www.youtube.com/s/desktop/f7129524/img/favicon.ico",
          youtubeId,
          mediaType: "video",
        };
        if (res && typeof res.status === "function") {
          return res.status(200).json(result);
        }
        return new Response(JSON.stringify(result), { status: 200, headers });
      }
    } catch {}
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const fetchRes = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    const contentType = fetchRes.headers.get("content-type") || "";

    // Direct Image Link
    if (contentType.startsWith("image/")) {
      const result: LinkPreviewResult = {
        url: targetUrl,
        originalUrl: targetUrl,
        title: parsedTarget.pathname.split("/").pop() || "Image Preview",
        description: `Image on ${hostname}`,
        image: targetUrl,
        siteName: hostname,
        hostname,
        favicon,
        mediaType: "image",
      };
      if (res && typeof res.status === "function") {
        return res.status(200).json(result);
      }
      return new Response(JSON.stringify(result), { status: 200, headers });
    }

    const htmlText = await fetchRes.text();
    // Only inspect first 250KB for speed
    const html = htmlText.slice(0, 250000);

    const getMeta = (prop: string): string | null => {
      const r1 = new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
      const r2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
      const m = html.match(r1) || html.match(r2);
      return m ? decodeHtmlEntities(m[1].trim()) : null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const rawTitle =
      getMeta("og:title") ||
      getMeta("twitter:title") ||
      (titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "") ||
      hostname;

    const rawDesc =
      getMeta("og:description") ||
      getMeta("twitter:description") ||
      getMeta("description") ||
      "";

    let rawImage =
      getMeta("og:image") ||
      getMeta("og:image:secure_url") ||
      getMeta("twitter:image") ||
      getMeta("twitter:image:src") ||
      "";

    // If YouTube ID exists, prioritize the high-res YouTube video cover
    if (youtubeId && (!rawImage || rawImage.includes("hqdefault"))) {
      rawImage = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    }

    // Resolve relative image URLs to absolute
    if (rawImage && !rawImage.startsWith("http://") && !rawImage.startsWith("https://")) {
      try {
        rawImage = new URL(rawImage, targetUrl).href;
      } catch {}
    }

    const siteName = getMeta("og:site_name") || hostname;

    const result: LinkPreviewResult = {
      url: targetUrl,
      originalUrl: targetUrl,
      title: rawTitle,
      description: rawDesc,
      image: rawImage || undefined,
      siteName,
      hostname,
      favicon,
      youtubeId,
      mediaType: youtubeId ? "video" : undefined,
    };

    if (res && typeof res.status === "function") {
      return res.status(200).json(result);
    }
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch {
    // Graceful fallback on network timeout or fetch error
    const fallback: LinkPreviewResult = {
      url: targetUrl,
      originalUrl: targetUrl,
      title: hostname,
      description: targetUrl,
      image: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : undefined,
      hostname,
      siteName: hostname,
      favicon,
      youtubeId,
      mediaType: youtubeId ? "video" : undefined,
    };

    if (res && typeof res.status === "function") {
      return res.status(200).json(fallback);
    }
    return new Response(JSON.stringify(fallback), { status: 200, headers });
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

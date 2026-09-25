/**
 * Utility for extracting URLs and fetching rich metadata for link previews.
 * Supports instant client-side YouTube resolution (thumbnail, title, channel)
 * plus full server-side OpenGraph scraping for any arbitrary link.
 */

export interface LinkPreviewData {
  url: string;
  originalUrl: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  hostname: string;
  favicon?: string;
  mediaType?: "video" | "image" | "article" | "website";
  youtubeId?: string;
}

// In-memory cache for fast retrieval during the session
const previewCache = new Map<string, LinkPreviewData>();

// Local storage key for persistent caching
const STORAGE_KEY = "dreamit_link_previews_v2";

function loadStorageCache(): Record<string, LinkPreviewData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorageCache(url: string, data: LinkPreviewData) {
  try {
    const current = loadStorageCache();
    // Keep max 150 cached items to prevent storage bloat
    const keys = Object.keys(current);
    if (keys.length > 150) {
      delete current[keys[0]];
    }
    current[url] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore quota errors
  }
}

/**
 * Extracts all URLs from a text string.
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  const matches = text.match(urlRegex);
  if (!matches) return [];
  // Return unique URLs
  return Array.from(new Set(matches));
}

/**
 * Extracts the YouTube video ID from various YouTube URL formats:
 * - youtu.be/VIDEO_ID
 * - youtube.com/watch?v=VIDEO_ID
 * - youtube.com/shorts/VIDEO_ID
 * - youtube.com/embed/VIDEO_ID
 */
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1).split("?")[0].split("/")[0];
      return id && id.length >= 8 ? id : null;
    }
    
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/v/")) {
        const parts = parsed.pathname.split("/").filter(Boolean);
        return parts[1] || null;
      }
    }
  } catch {
    // regex fallback
  }

  const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

/**
 * Resolves a hostname for display (e.g. "youtu.be", "github.com")
 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Fetches rich preview data for any given URL.
 * Automatically tries client-side YouTube oEmbed first for instant speed and zero CORS,
 * then falls back to /api/link-preview or public oEmbed.
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  const cleanUrl = url.trim();
  
  // 1. Check in-memory cache
  if (previewCache.has(cleanUrl)) {
    return previewCache.get(cleanUrl)!;
  }

  // 2. Check localStorage cache
  const storageCache = loadStorageCache();
  if (storageCache[cleanUrl]) {
    previewCache.set(cleanUrl, storageCache[cleanUrl]);
    return storageCache[cleanUrl];
  }

  const hostname = getHostname(cleanUrl);
  const youtubeId = extractYouTubeId(cleanUrl);

  // 3. Fast Path: YouTube Link
  if (youtubeId) {
    try {
      // YouTube oEmbed is public and has CORS enabled (*), responding in ~100ms
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`
      );
      
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        const data: LinkPreviewData = {
          url: cleanUrl,
          originalUrl: cleanUrl,
          title: oembed.title || "YouTube Video",
          description: oembed.author_name 
            ? `Watch on YouTube • Channel: ${oembed.author_name}` 
            : "Enjoy the videos and music you love, upload original content, and share it all with friends on YouTube.",
          image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
          siteName: oembed.provider_name || "YouTube",
          hostname,
          favicon: "https://www.youtube.com/s/desktop/f7129524/img/favicon.ico",
          mediaType: "video",
          youtubeId,
        };
        previewCache.set(cleanUrl, data);
        saveToStorageCache(cleanUrl, data);
        return data;
      }
    } catch {
      // fallback to computed preview
    }

    // Direct YouTube fallback
    const directData: LinkPreviewData = {
      url: cleanUrl,
      originalUrl: cleanUrl,
      title: "YouTube Video",
      description: "Enjoy the videos and music you love, upload original content, and share it all with friends on YouTube.",
      image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
      siteName: "YouTube",
      hostname,
      favicon: "https://www.google.com/s2/favicons?domain=youtube.com&sz=64",
      mediaType: "video",
      youtubeId,
    };
    previewCache.set(cleanUrl, directData);
    saveToStorageCache(cleanUrl, directData);
    return directData;
  }

  // 4. General Link: Query /api/link-preview
  try {
    const apiRes = await fetch(`/api/link-preview?url=${encodeURIComponent(cleanUrl)}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.title) {
        const previewResult: LinkPreviewData = {
          url: cleanUrl,
          originalUrl: cleanUrl,
          title: data.title,
          description: data.description || "",
          image: data.image || undefined,
          siteName: data.siteName || hostname,
          hostname: data.hostname || hostname,
          favicon: data.favicon || `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
          mediaType: data.mediaType || "website",
          youtubeId: data.youtubeId,
        };
        previewCache.set(cleanUrl, previewResult);
        saveToStorageCache(cleanUrl, previewResult);
        return previewResult;
      }
    }
  } catch {
    // If backend endpoint is unavailable, continue to public fallback
  }

  // 5. Fallback: try public noembed for services like Vimeo, Twitter, Flickr
  try {
    const noembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`);
    if (noembedRes.ok) {
      const noembed = await noembedRes.json();
      if (noembed.title) {
        const data: LinkPreviewData = {
          url: cleanUrl,
          originalUrl: cleanUrl,
          title: noembed.title,
          description: noembed.author_name ? `By ${noembed.author_name} on ${noembed.provider_name || hostname}` : "",
          image: noembed.thumbnail_url || undefined,
          siteName: noembed.provider_name || hostname,
          hostname,
          favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
          mediaType: noembed.type === "video" ? "video" : "website",
        };
        previewCache.set(cleanUrl, data);
        saveToStorageCache(cleanUrl, data);
        return data;
      }
    }
  } catch {
    // ignore
  }

  // 6. Graceful minimum fallback
  const fallbackData: LinkPreviewData = {
    url: cleanUrl,
    originalUrl: cleanUrl,
    title: hostname,
    description: cleanUrl,
    hostname,
    siteName: hostname,
    favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
    mediaType: "website",
  };
  previewCache.set(cleanUrl, fallbackData);
  saveToStorageCache(cleanUrl, fallbackData);
  return fallbackData;
}

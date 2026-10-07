/**
 * Robust clipboard extraction utility for Dream It.
 * Handles:
 * 1. Native clipboard files (screenshots, image files, documents)
 * 2. DataTransfer items (kind === 'file')
 * 3. Modern Async Clipboard API fallback (navigator.clipboard.read)
 * 4. Web images copied from websites / Instagram / Google (HTML <img src="...">)
 * 5. Direct base64 data URLs & image URLs
 * 6. Detection of macOS Finder file copies (file:///...) to inform user to drag-and-drop
 */

export interface ExtractedClipboardResult {
  files: File[];
  isLocalFinderFile?: boolean;
  localFileName?: string;
}

/**
 * Extracts any files, images, or documents from a paste event or clipboard.
 */
export async function extractFilesFromClipboard(
  e?: ClipboardEvent | React.ClipboardEvent
): Promise<ExtractedClipboardResult> {
  const result: ExtractedClipboardResult = { files: [] };
  const clipboardData = e?.clipboardData;

  // 1. Direct files from clipboardData.files (FileList)
  if (clipboardData?.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const f = clipboardData.files[i];
      if (f && f.size > 0) {
        result.files.push(f);
      }
    }
  }

  // 2. Direct items from clipboardData.items (kind === "file")
  if (clipboardData?.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === "file") {
        try {
          const f = item.getAsFile();
          if (f && f.size > 0 && !result.files.some(existing => existing.name === f.name && existing.size === f.size)) {
            result.files.push(f);
          }
        } catch (err) {
          console.warn("[Clipboard] Error getting file from item:", err);
        }
      }
    }
  }

  // 3. Navigator.clipboard.read() Fallback (Chrome / Safari / Edge modern async API)
  // Essential when browser sandboxing blocks synchronous e.clipboardData.files
  if (result.files.length === 0 && typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.read) {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/") || type.startsWith("application/pdf")) {
            try {
              const blob = await item.getType(type);
              if (blob && blob.size > 0) {
                const ext = type.split("/")[1]?.replace("+xml", "") || "png";
                const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                const file = new File([blob], `pasted-${dateStr}.${ext}`, { type });
                result.files.push(file);
                break;
              }
            } catch (err) {
              console.debug("[Clipboard] Error reading type:", type, err);
            }
          }
        }
      }
    } catch (err) {
      console.debug("[Clipboard] navigator.clipboard.read() fallback skipped:", err);
    }
  }

  // 4. HTML <img src="..."> Extraction (when user right-clicks "Copy Image" on web / Instagram / Google)
  if (result.files.length === 0 && clipboardData) {
    const html = clipboardData.getData("text/html");
    if (html) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1]) {
        const src = match[1];
        if (src.startsWith("data:image/")) {
          try {
            const res = await fetch(src);
            const blob = await res.blob();
            const ext = blob.type.split("/")[1]?.replace("+xml", "") || "png";
            const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const file = new File([blob], `pasted-${dateStr}.${ext}`, { type: blob.type || "image/png" });
            result.files.push(file);
          } catch (err) {
            console.warn("[Clipboard] Error converting data URL img:", err);
          }
        } else if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:")) {
          try {
            const res = await fetch(src, { mode: "cors" });
            if (res.ok) {
              const blob = await res.blob();
              if (blob.type.startsWith("image/") || blob.size > 0) {
                const ext = blob.type.split("/")[1]?.replace("+xml", "") || "png";
                const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                const file = new File([blob], `web-image-${dateStr}.${ext}`, { type: blob.type || "image/png" });
                result.files.push(file);
              }
            }
          } catch (fetchErr) {
            console.debug("[Clipboard] Cross-origin fetch blocked for img src:", fetchErr);
          }
        }
      }
    }
  }

  // 5. Plain text data URL or Direct Image URL
  if (result.files.length === 0 && clipboardData) {
    const text = clipboardData.getData("text/plain")?.trim();
    if (text) {
      if (text.startsWith("data:image/")) {
        try {
          const res = await fetch(text);
          const blob = await res.blob();
          const ext = blob.type.split("/")[1]?.replace("+xml", "") || "png";
          const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const file = new File([blob], `pasted-${dateStr}.${ext}`, { type: blob.type || "image/png" });
          result.files.push(file);
        } catch (err) {
          console.warn("[Clipboard] Error parsing text data URL:", err);
        }
      } else if (/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i.test(text)) {
        try {
          const res = await fetch(text, { mode: "cors" });
          if (res.ok) {
            const blob = await res.blob();
            if (blob.type.startsWith("image/")) {
              const ext = blob.type.split("/")[1]?.replace("+xml", "") || "png";
              const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
              const file = new File([blob], `pasted-${dateStr}.${ext}`, { type: blob.type || "image/png" });
              result.files.push(file);
            }
          }
        } catch (err) {
          console.debug("[Clipboard] Failed fetching direct image URL:", err);
        }
      }

      // 6. Check for macOS Finder / Windows Explorer file copy
      if (text.startsWith("file://") || clipboardData.getData("text/uri-list")?.startsWith("file://")) {
        result.isLocalFinderFile = true;
        const rawPath = text.startsWith("file://") ? text : clipboardData.getData("text/uri-list");
        result.localFileName = decodeURIComponent(rawPath.split("/").pop() || "file");
      }
    }
  }

  // Normalize filenames for pasted items (e.g. image.png, blob)
  result.files = result.files.map((f) => {
    if (!f.name || f.name === "image.png" || f.name === "blob") {
      const ext = f.type ? f.type.split("/")[1]?.replace("+xml", "") || "png" : "png";
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      return new File([f], `pasted-${dateStr}.${ext}`, { type: f.type || "image/png" });
    }
    return f;
  });

  return result;
}

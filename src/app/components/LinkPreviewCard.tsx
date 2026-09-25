import React, { useState, useEffect } from "react";
import { ExternalLink, Play, X, Globe, Loader2 } from "lucide-react";
import { fetchLinkPreview, LinkPreviewData, extractYouTubeId } from "../utils/linkPreview";

interface LinkPreviewCardProps {
  url: string;
  isMe?: boolean;
  compact?: boolean;
  onDismiss?: () => void;
}

export default function LinkPreviewCard({
  url,
  isMe = false,
  compact = false,
  onDismiss,
}: LinkPreviewCardProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setImageError(false);
    setIsPlayingVideo(false);

    fetchLinkPreview(url)
      .then((data) => {
        if (isMounted) {
          setPreview(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  const youtubeId = preview?.youtubeId || extractYouTubeId(url);

  // Loading skeleton
  if (loading && !preview) {
    return (
      <div
        className={`w-full rounded-2xl overflow-hidden animate-pulse border transition-all ${
          isMe
            ? "bg-black/20 border-white/15"
            : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
        }`}
      >
        <div className="w-full aspect-video bg-black/15 dark:bg-white/10 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin opacity-40" />
        </div>
        <div className="p-3 space-y-2">
          <div className="h-4 bg-current opacity-20 rounded w-3/4" />
          <div className="h-3 bg-current opacity-15 rounded w-full" />
          <div className="h-3 bg-current opacity-10 rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (!preview) return null;

  // Inline YouTube Video Player
  if (isPlayingVideo && youtubeId) {
    return (
      <div
        className={`relative w-full rounded-2xl overflow-hidden shadow-md border ${
          isMe
            ? "bg-black/30 border-white/20"
            : "bg-black/10 dark:bg-white/10 border-black/15 dark:border-white/15"
        }`}
      >
        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
            title={preview.title || "YouTube video"}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPlayingVideo(false);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition shadow z-10"
            title="Close video preview"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-2.5 flex items-center justify-between text-xs">
          <span className="font-semibold truncate flex-1 pr-2">{preview.title}</span>
          <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 opacity-70 hover:opacity-100 font-bold shrink-0 transition"
          >
            Open YouTube <ExternalLink size={12} />
          </a>
        </div>
      </div>
    );
  }

  const hasImage = Boolean(preview.image && !imageError);

  return (
    <div
      className={`group relative w-full rounded-2xl overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md border text-left cursor-pointer ${
        isMe
          ? "bg-black/25 hover:bg-black/35 border-white/20 text-white"
          : "bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border-black/10 dark:border-white/10"
      }`}
      onClick={() => {
        window.open(preview.url, "_blank", "noopener,noreferrer");
      }}
    >
      {/* Optional dismiss button for draft input */}
      {onDismiss && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="absolute top-2 right-2 z-20 p-1 rounded-full bg-black/70 hover:bg-black text-white transition"
          title="Remove preview"
        >
          <X size={14} />
        </button>
      )}

      {/* Cover Image / Video Thumbnail */}
      {hasImage && (
        <div className="relative w-full aspect-video overflow-hidden bg-black/40">
          <img
            src={preview.image}
            alt={preview.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            onError={(e) => {
              // If YouTube maxresdefault fails, try hqdefault fallback once
              if (youtubeId && !e.currentTarget.dataset.fallbackTried) {
                e.currentTarget.dataset.fallbackTried = "true";
                e.currentTarget.src = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
              } else {
                setImageError(true);
              }
            }}
          />

          {/* YouTube / Video Overlay Badge */}
          {youtubeId && (
            <>
              {/* Center Play Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlayingVideo(true);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/40 transition-colors"
                title="Play video right here"
              >
                <div className="size-12 sm:size-14 rounded-full bg-red-600/95 hover:bg-red-600 text-white shadow-xl flex items-center justify-center pl-1 transition-transform group-hover:scale-110">
                  <Play size={24} fill="currentColor" />
                </div>
              </button>

              {/* YouTube badge */}
              <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-white text-[11px] font-bold flex items-center gap-1.5 shadow">
                <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                <span>YouTube</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Text Details */}
      <div className="p-3 sm:p-3.5 flex flex-col gap-1.5">
        <h4 className="font-bold text-sm leading-snug line-clamp-2 transition-colors">
          {preview.title}
        </h4>

        {preview.description && !compact && (
          <p className="text-xs leading-relaxed opacity-75 line-clamp-2">
            {preview.description}
          </p>
        )}

        {/* Domain & Link Footer */}
        <div className="mt-1 pt-2 border-t border-current/10 flex items-center justify-between text-[11px] font-medium opacity-75 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5 min-w-0">
            {preview.favicon ? (
              <img
                src={preview.favicon}
                alt=""
                className="size-3.5 rounded-sm object-contain shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <Globe size={13} className="shrink-0" />
            )}
            <span className="truncate">{preview.hostname}</span>
          </div>

          <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0 ml-2">
            Open <ExternalLink size={11} />
          </span>
        </div>
      </div>
    </div>
  );
}

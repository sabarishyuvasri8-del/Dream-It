import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Download,
  Copy,
  Check,
  Maximize2,
  RotateCw,
  Share2,
  BookOpen,
  X,
  Layers,
  Cpu,
  Eye,
  Sliders,
} from "lucide-react";

export interface AIImageCardData {
  status: "generating" | "ready" | "error";
  prompt: string;
  refinedPrompt?: string;
  imageUrl?: string;
  provider?: string;
  seed?: number;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3";
  dimensions?: { width: number; height: number };
  durationMs?: number;
  error?: string;
}

interface AIImageGenerationCardProps {
  data: AIImageCardData;
  onRegenerate?: (prompt: string, seed?: number) => void;
  onSaveToNotes?: (title: string, content: string, imageUrl: string) => void;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

const TELEMETRY_STAGES = [
  { label: "Interpreting semantic prompt & style nuances...", progress: 15, icon: "🧠" },
  { label: "Seeding latent diffusion noise vector...", progress: 38, icon: "🌌" },
  { label: "Diffusing structural geometry & ambient lighting...", progress: 65, icon: "🎨" },
  { label: "Synthesizing high-frequency details & 4K textures...", progress: 88, icon: "🔬" },
  { label: "Finalizing neural color grading & render...", progress: 98, icon: "✨" },
];

export const AIImageGenerationCard: React.FC<AIImageGenerationCardProps> = ({
  data,
  onRegenerate,
  onSaveToNotes,
  showToast,
}) => {
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [progressPercent, setProgressPercent] = useState(12);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<any>(null);

  const isReady = data.status === "ready" && !!data.imageUrl;
  const isGenerating = data.status === "generating" || (isReady && !isImageLoaded);

  // ─── Live Telemetry Simulation while generating or preloading ───
  useEffect(() => {
    if (!isReady || !isImageLoaded) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);

        // Progress curve interpolation
        if (elapsed < 1200) {
          setCurrentStageIdx(0);
          setProgressPercent(Math.min(25, Math.floor(10 + (elapsed / 1200) * 15)));
        } else if (elapsed < 2800) {
          setCurrentStageIdx(1);
          setProgressPercent(Math.min(50, Math.floor(25 + ((elapsed - 1200) / 1600) * 25)));
        } else if (elapsed < 4800) {
          setCurrentStageIdx(2);
          setProgressPercent(Math.min(75, Math.floor(50 + ((elapsed - 2800) / 2000) * 25)));
        } else if (elapsed < 7000) {
          setCurrentStageIdx(3);
          setProgressPercent(Math.min(92, Math.floor(75 + ((elapsed - 4800) / 2200) * 17)));
        } else {
          setCurrentStageIdx(4);
          setProgressPercent(Math.min(98, Math.floor(92 + ((elapsed - 7000) / 3000) * 6)));
        }
      }, 100);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setProgressPercent(100);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isReady, isImageLoaded]);

  // ─── Preload Image into browser cache before unveiling ───
  useEffect(() => {
    if (data.imageUrl) {
      setIsImageLoaded(false);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = data.imageUrl;
      img.onload = () => {
        setIsImageLoaded(true);
        setProgressPercent(100);
      };
      img.onerror = () => {
        // Even if crossOrigin fails, display direct
        setIsImageLoaded(true);
        setProgressPercent(100);
      };
    }
  }, [data.imageUrl]);

  // Aspect ratio classes
  const aspectClass =
    data.aspectRatio === "16:9"
      ? "aspect-video"
      : data.aspectRatio === "9:16"
        ? "aspect-[9/16]"
        : data.aspectRatio === "4:3"
          ? "aspect-[4/3]"
          : "aspect-square";

  // Format elapsed time (00:03.4s)
  const formatTime = (ms: number) => {
    const totalSec = ms / 1000;
    return `${totalSec.toFixed(1)}s`;
  };

  // ─── Download Action ───
  const handleDownload = async () => {
    if (!data.imageUrl) return;
    setIsDownloading(true);
    try {
      const response = await fetch(data.imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const cleanSlug = (data.prompt || "ai-artwork")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40);
      link.href = blobUrl;
      link.download = `dreamit-${cleanSlug}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      if (showToast) showToast("Image downloaded successfully! ⬇️", "success");
    } catch (err) {
      // Fallback: Open in new window
      window.open(data.imageUrl, "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Copy Image to Clipboard ───
  const handleCopyImage = async () => {
    if (!data.imageUrl) return;
    try {
      const response = await fetch(data.imageUrl);
      const blob = await response.blob();
      
      // Convert to PNG for clipboard compatibility if needed
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(async (pngBlob) => {
          if (pngBlob && navigator.clipboard && (window as any).ClipboardItem) {
            await navigator.clipboard.write([
              new (window as any).ClipboardItem({ "image/png": pngBlob }),
            ]);
            setIsCopied(true);
            if (showToast) showToast("Image copied to clipboard! 📋", "success");
            setTimeout(() => setIsCopied(false), 2000);
          } else {
            // Fallback to copying image URL
            await navigator.clipboard.writeText(data.imageUrl!);
            setIsCopied(true);
            if (showToast) showToast("Image link copied to clipboard! 🔗", "success");
            setTimeout(() => setIsCopied(false), 2000);
          }
        }, "image/png");
      }
    } catch (err) {
      console.warn("Failed to copy image blob, falling back to URL:", err);
      try {
        await navigator.clipboard.writeText(data.imageUrl);
        setIsCopied(true);
        if (showToast) showToast("Image link copied to clipboard! 🔗", "success");
        setTimeout(() => setIsCopied(false), 2000);
      } catch (e) {
        if (showToast) showToast("Failed to copy image", "error");
      }
    }
  };

  // ─── Save to Notes Tab ───
  const handleSaveToNotesAction = () => {
    if (!data.imageUrl) return;
    const title = `AI Visual: ${data.prompt.slice(0, 45)}`;
    const content = `### ${data.prompt}\n\n![${data.prompt}](${data.imageUrl})\n\n*Generated with ${data.provider || "FLUX.1"} on ${new Date().toLocaleDateString()}*\n\n**Refined Prompt:**\n${data.refinedPrompt || data.prompt}`;
    if (onSaveToNotes) {
      onSaveToNotes(title, content, data.imageUrl);
      if (showToast) showToast("Saved to your study notes! 📖", "success");
    }
  };

  const stage = TELEMETRY_STAGES[currentStageIdx] || TELEMETRY_STAGES[0];

  return (
    <div className="w-full max-w-2xl my-3 select-none">
      {/* Outer Card Container */}
      <div
        className="relative overflow-hidden rounded-3xl transition-all duration-500 shadow-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(20, 22, 28, 0.95), rgba(12, 14, 18, 0.98))",
          border: isGenerating
            ? "1px solid rgba(139, 92, 246, 0.35)"
            : "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: isGenerating
            ? "0 0 35px -5px rgba(139, 92, 246, 0.25), 0 20px 40px -15px rgba(0, 0, 0, 0.8)"
            : "0 20px 40px -15px rgba(0, 0, 0, 0.7)",
        }}
      >
        {/* Animated Conic Border Beam during Generation */}
        {isGenerating && (
          <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
            <div
              className="absolute -inset-[150%] opacity-40 animate-[spin_8s_linear_infinite]"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0 300deg, #8b5cf6 330deg, #06b6d4 360deg)",
              }}
            />
          </div>
        )}

        {/* Header Bar */}
        <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 backdrop-blur-md bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`size-7 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                isGenerating
                  ? "bg-gradient-to-tr from-violet-600 to-cyan-500 animate-pulse text-white"
                  : "bg-white/10 text-violet-400"
              }`}
            >
              <Sparkles size={14} className={isGenerating ? "animate-spin [animation-duration:3s]" : ""} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold tracking-wide text-white/90 font-[Roboto_Slab]">
                  Dream It Diffusion
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium tracking-tight bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {data.provider || "FLUX.1"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-white/60">
            {isGenerating ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                <span className="size-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>{formatTime(elapsedMs)}</span>
              </div>
            ) : (
              <span className="text-white/50 text-[11px]">1024 × 1024</span>
            )}
          </div>
        </div>

        {/* ─── Main Visual Frame ─── */}
        <div className={`relative w-full ${aspectClass} overflow-hidden bg-black/60 flex items-center justify-center`}>
          {/* Ambient Glowing Mesh Orbs (Background depth) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            <div className="absolute top-1/4 left-1/4 size-48 rounded-full bg-violet-600/40 blur-3xl animate-pulse [animation-duration:4s]" />
            <div className="absolute bottom-1/4 right-1/4 size-48 rounded-full bg-cyan-500/40 blur-3xl animate-pulse [animation-duration:5s]" />
          </div>

          {/* ─── Ready State: High-Res Image with Reveal Unveil Effect ─── */}
          {data.imageUrl && (
            <img
              src={data.imageUrl}
              alt={data.prompt}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out cursor-pointer ${
                isImageLoaded
                  ? "blur-0 scale-100 opacity-100"
                  : "blur-2xl scale-105 opacity-0"
              }`}
              onClick={() => setIsLightboxOpen(true)}
            />
          )}

          {/* Shimmer Sweep Effect upon complete reveal */}
          {isReady && isImageLoaded && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
              <div className="w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-25 -translate-x-full animate-[shimmerSweep_2.5s_ease-out_1]" />
            </div>
          )}

          {/* ─── Generating State: Professional Diffusion Lattice & Laser Scanner ─── */}
          {isGenerating && (
            <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center w-full h-full">
              {/* Raster Scanner Beam */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div
                  className="w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-[scanBeam_2.8s_easeInOut_infinite]"
                  style={{
                    animation: "scanBeam 3s ease-in-out infinite alternate",
                  }}
                />
              </div>

              {/* Pulsing Neural Diffusion Core */}
              <div className="relative size-24 sm:size-28 flex items-center justify-center mb-5">
                {/* Outer rotating dashed ring */}
                <div className="absolute inset-0 rounded-full border border-dashed border-violet-400/40 animate-[spin_12s_linear_infinite]" />
                {/* Middle pulsing ring */}
                <div className="absolute inset-2 rounded-full border border-cyan-400/30 animate-ping [animation-duration:2.5s]" />
                {/* Inner glowing sphere */}
                <div className="size-14 sm:size-16 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.6)] animate-pulse">
                  <Cpu size={26} className="text-white animate-spin [animation-duration:6s]" />
                </div>
              </div>

              {/* Live Stage Status Text */}
              <div className="flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                <span className="text-sm">{stage.icon}</span>
                <span className="text-xs font-medium text-white/90 tracking-wide animate-fade-in">
                  {stage.label}
                </span>
              </div>

              {/* Smooth Progress Bar with Glowing Head */}
              <div className="w-56 sm:w-72 h-1.5 bg-white/10 rounded-full overflow-hidden relative mb-2 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 transition-all duration-300 rounded-full relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 size-2 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
                </div>
              </div>

              <div className="flex items-center justify-between w-56 sm:w-72 text-[10px] font-mono text-white/50">
                <span>SYNTHESIZING</span>
                <span className="text-cyan-300 font-bold">{progressPercent}%</span>
              </div>
            </div>
          )}

          {/* ─── Ready State Overlay Controls (Hover & Touch) ─── */}
          {isReady && isImageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-between pointer-events-auto">
              {/* Top Action Badges */}
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full text-[10.5px] font-mono bg-black/60 text-white/90 backdrop-blur-md border border-white/15">
                  Seed #{data.seed || "42"}
                </span>

                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="p-2 rounded-xl bg-black/60 text-white/90 hover:text-white hover:bg-black/80 backdrop-blur-md border border-white/15 transition transform hover:scale-105"
                  title="Expand to Fullscreen Lightbox"
                >
                  <Maximize2 size={15} />
                </button>
              </div>

              {/* Bottom Quick Actions Toolbar */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <div className="text-[11px] text-white/80 line-clamp-1 max-w-[65%] drop-shadow-md">
                  {data.prompt}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Copy Image Button */}
                  <button
                    type="button"
                    onClick={handleCopyImage}
                    disabled={isCopied}
                    className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition shadow-md hover:scale-105 active:scale-95"
                    title="Copy Image to Clipboard"
                  >
                    {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>

                  {/* Download Button */}
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition shadow-md hover:scale-105 active:scale-95"
                    title="Download High-Resolution Image"
                  >
                    <Download size={14} />
                  </button>

                  {/* Save to Notes */}
                  {onSaveToNotes && (
                    <button
                      type="button"
                      onClick={handleSaveToNotesAction}
                      className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition shadow-md hover:scale-105 active:scale-95"
                      title="Save to Study Notes"
                    >
                      <BookOpen size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info & Prompt Bar */}
        <div className="p-3.5 sm:p-4 bg-white/[0.03] border-t border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <p className="text-xs sm:text-[13px] font-medium text-white/90 leading-relaxed break-words font-[DM_Sans]">
                {data.prompt}
              </p>
              {data.refinedPrompt && data.refinedPrompt !== data.prompt && (
                <p className="text-[11px] text-white/40 line-clamp-1 italic font-mono">
                  Refined: {data.refinedPrompt}
                </p>
              )}
            </div>

            {/* Regenerate Button */}
            {isReady && onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(data.prompt, Math.floor(Math.random() * 10000000))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 transition shrink-0 hover:scale-102 active:scale-98 shadow-sm"
                title="Regenerate with a new seed"
              >
                <RotateCw size={12} />
                <span>Re-roll</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Full-Resolution Lightbox Modal ─── */}
      {isLightboxOpen && data.imageUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-xl animate-fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Controls */}
            <div className="absolute -top-12 right-0 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyImage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-md border border-white/20 transition"
              >
                {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{isCopied ? "Copied" : "Copy"}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium shadow-lg transition"
              >
                <Download size={13} />
                <span>Download</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition ml-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* High-Res Image Display */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/15 max-h-[80vh] flex items-center justify-center bg-black/50">
              <img
                src={data.imageUrl}
                alt={data.prompt}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-2xl"
              />
            </div>

            {/* Prompt Caption */}
            <div className="mt-3 text-center max-w-2xl px-4">
              <p className="text-xs sm:text-sm text-white/80 font-medium">{data.prompt}</p>
              <p className="text-[11px] text-white/40 font-mono mt-0.5">
                {data.provider || "FLUX.1"} • 1024 × 1024
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIImageGenerationCard;


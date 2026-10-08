import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

interface VoiceMessagePlayerProps {
  audioUrl: string;
  isMe: boolean;
  createdAt?: string;
}

function formatDuration(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function VoiceMessagePlayer({
  audioUrl,
  isMe,
  createdAt,
}: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);

  // Format timestamp (e.g. 7:15 PM)
  const formattedTime = React.useMemo(() => {
    if (!createdAt) return "";
    try {
      return new Date(createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  }, [createdAt]);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (!duration && audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn("Failed to play audio:", err);
      });
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressContainerRef.current || !audioRef.current || !duration) return;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Waveform visualization bars
  const WAVE_BARS = [35, 60, 45, 90, 75, 40, 65, 85, 50, 95, 70, 40, 80, 60, 45, 70, 90, 50, 35, 65, 80, 40, 60, 75];

  return (
    <div className="flex flex-col gap-1.5 w-64 sm:w-72 select-none py-0.5">
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="size-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 shadow-xs"
          style={{
            backgroundColor: isMe ? "rgba(255, 255, 255, 0.2)" : "var(--m-primary)",
            color: isMe ? "white" : "var(--m-primary-text)",
          }}
          aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        >
          {isPlaying ? (
            <Pause size={17} className="fill-current" />
          ) : (
            <Play size={17} className="fill-current translate-x-0.5" />
          )}
        </button>

        {/* Waveform Scrubber */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div
            ref={progressContainerRef}
            onClick={handleSeek}
            className="h-8 flex items-center gap-[3px] cursor-pointer group px-0.5"
            title="Click to seek"
          >
            {WAVE_BARS.map((heightPct, idx) => {
              const barPercent = (idx / WAVE_BARS.length) * 100;
              const isFilled = progressPercent >= barPercent;

              return (
                <div
                  key={idx}
                  className="flex-1 rounded-full transition-all group-hover:opacity-90"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: isFilled
                      ? isMe
                        ? "white"
                        : "var(--m-primary)"
                      : isMe
                      ? "rgba(255, 255, 255, 0.35)"
                      : "rgba(128, 128, 128, 0.3)",
                  }}
                />
              );
            })}
          </div>

          {/* Time & Speed Controls */}
          <div className="flex items-center justify-between text-[11px] font-mono opacity-80 leading-none">
            <span>{isPlaying || currentTime > 0 ? formatDuration(currentTime) : formatDuration(duration)}</span>
            
            <button
              type="button"
              onClick={cycleSpeed}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md transition hover:opacity-100 opacity-75"
              style={{
                backgroundColor: isMe ? "rgba(255, 255, 255, 0.15)" : "var(--m-surface-alt)",
                border: "1px solid currentColor",
              }}
              title="Change playback speed"
            >
              {playbackRate}x
            </button>
          </div>
        </div>
      </div>

      {/* Message timestamp */}
      {formattedTime && (
        <div className="text-[10px] self-end opacity-60 font-medium select-none -mt-0.5">
          {formattedTime}
        </div>
      )}
    </div>
  );
}

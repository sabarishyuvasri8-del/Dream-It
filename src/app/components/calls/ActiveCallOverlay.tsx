import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Minimize2,
  Maximize2,
  Volume2,
  ShieldCheck,
} from "lucide-react";
import { ActiveCallSession, CallState } from "./useWebRTCCall";

interface ActiveCallOverlayProps {
  session: ActiveCallSession;
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  remoteHasVideo: boolean;
  durationSeconds: number;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function ActiveCallOverlay({
  session,
  callState,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  isScreenSharing,
  remoteHasVideo,
  durationSeconds,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
}: ActiveCallOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Robust video element attachers: guarantees srcObject is attached as soon as the element exists
  const setRemoteVideoEl = useCallback(
    (el: HTMLVideoElement | null) => {
      remoteVideoRef.current = el;
      if (el && remoteStream) {
        el.srcObject = remoteStream;
        el.play().catch(() => {});
      }
    },
    [remoteStream]
  );

  const setLocalVideoEl = useCallback(
    (el: HTMLVideoElement | null) => {
      localVideoRef.current = el;
      if (el && localStream) {
        el.srcObject = localStream;
        el.play().catch(() => {});
      }
    },
    [localStream]
  );

  // Attach remote stream to hidden audio element
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Keep video playback active when streams update
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, remoteHasVideo]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoOff, isScreenSharing]);

  const hasLocalVideo = (!isVideoOff || isScreenSharing) && Boolean(localStream?.getVideoTracks().length);
  const isRinging = callState === "outgoing_ringing";

  // Dedicated audio element ensures audio never gets dropped
  const hiddenAudioElement = (
    <audio ref={remoteAudioRef} autoPlay playsInline />
  );

  // ─── Minimized Floating Pill View (Theme-Adaptive) ───
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-2.5 pr-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom-4 duration-150"
        style={{
          backgroundColor: "var(--m-surface-solid, #ffffff)",
          borderColor: "var(--m-border, rgba(0, 0, 0, 0.12))",
          boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.35)",
          color: "var(--m-text, #1e293b)",
        }}
      >
        {hiddenAudioElement}

        {/* Small Avatar */}
        <div className="relative shrink-0">
          {session.friendImage ? (
            <img
              src={session.friendImage}
              alt={session.friendName}
              className="size-10 rounded-full object-cover border-2 shadow-sm"
              style={{ borderColor: "var(--m-primary, #6366f1)" }}
            />
          ) : (
            <div
              className="size-10 rounded-full grid place-items-center text-sm font-bold text-white border-2 shadow-sm"
              style={{
                backgroundColor: "var(--m-primary, #6366f1)",
                borderColor: "var(--m-primary, #6366f1)",
              }}
            >
              {session.friendName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />
        </div>

        {/* Name & Duration */}
        <div className="min-w-0 pr-1 text-left">
          <p
            className="text-xs font-bold truncate max-w-[120px]"
            style={{ color: "var(--m-text-heading, #0f172a)" }}
          >
            {session.friendName}
          </p>
          <p
            className="text-[11px] font-mono font-semibold"
            style={{ color: "var(--m-primary, #4338ca)" }}
          >
            {isRinging ? "Calling..." : formatDuration(durationSeconds)}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1.5 ml-1">
          <button
            type="button"
            onClick={onToggleMute}
            className="p-2 rounded-xl transition cursor-pointer"
            style={
              isMuted
                ? {
                    backgroundColor: "var(--m-danger-bg, #fee2e2)",
                    color: "var(--m-danger-text, #b91c1c)",
                  }
                : {
                    backgroundColor: "var(--m-surface-alt, #f1f5f9)",
                    color: "var(--m-text, #1e293b)",
                  }
            }
            title={isMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-2 rounded-xl transition hover:opacity-80 cursor-pointer"
            style={{
              backgroundColor: "var(--m-surface-alt, #f1f5f9)",
              color: "var(--m-text, #1e293b)",
            }}
            title="Expand Call"
          >
            <Maximize2 size={15} />
          </button>

          <button
            type="button"
            onClick={onEndCall}
            className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm cursor-pointer"
            title="End Call"
          >
            <PhoneOff size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ─── Full Overlay View (Theme-Adaptive & Responsive) ───
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-lg animate-in fade-in duration-200"
      style={{ backgroundColor: "var(--m-modal-overlay, rgba(0, 0, 0, 0.65))" }}
    >
      {hiddenAudioElement}

      <div
        className="w-full max-w-3xl h-[600px] max-h-[92vh] rounded-3xl flex flex-col relative overflow-hidden shadow-2xl border"
        style={{
          backgroundColor: "var(--m-surface-solid, #ffffff)",
          borderColor: "var(--m-border, rgba(0, 0, 0, 0.14))",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
          color: "var(--m-text, #1e293b)",
        }}
      >
        {/* Top Header Bar */}
        <div
          className="flex items-center justify-between p-4 px-6 z-20 border-b shrink-0"
          style={{
            backgroundColor: "var(--m-surface-solid, #ffffff)",
            borderColor: "var(--m-border-light, rgba(0, 0, 0, 0.08))",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="size-2.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" />
            <div className="text-left">
              <h4
                className="text-sm font-bold truncate"
                style={{ color: "var(--m-text-heading, #0f172a)" }}
              >
                {session.friendName}
              </h4>
              <p
                className="text-[11px] font-mono font-semibold"
                style={{ color: "var(--m-text-sub, #64748b)" }}
              >
                {isRinging ? "Ringing..." : formatDuration(durationSeconds)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold"
              style={{
                backgroundColor: "var(--m-surface-alt, #f1f5f9)",
                borderColor: "var(--m-border-light, rgba(0, 0, 0, 0.08))",
                color: "var(--m-primary, #4338ca)",
              }}
            >
              <ShieldCheck size={13} />
              <span>P2P Encrypted • Zero Storage</span>
            </div>

            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-xl border transition hover:opacity-80 cursor-pointer"
              style={{
                backgroundColor: "var(--m-surface-alt, #f1f5f9)",
                borderColor: "var(--m-border-light, rgba(0, 0, 0, 0.08))",
                color: "var(--m-text, #1e293b)",
              }}
              title="Minimize to floating window"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Center Canvas: Remote Video / Screen Share OR Audio Avatar Waveform */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black/90">
          {remoteHasVideo ? (
            <video
              ref={setRemoteVideoEl}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center text-center p-6 w-full h-full"
              style={{ backgroundColor: "var(--m-surface-alt, #f8fafc)" }}
            >
              {/* Pulsing Avatar */}
              <div className="relative mb-6 flex items-center justify-center">
                <div
                  className="absolute size-36 rounded-full animate-ping opacity-25"
                  style={{ backgroundColor: "var(--m-primary, #6366f1)" }}
                />
                <div
                  className="absolute size-32 rounded-full animate-pulse opacity-30"
                  style={{ backgroundColor: "var(--m-primary, #6366f1)" }}
                />

                {session.friendImage ? (
                  <img
                    src={session.friendImage}
                    alt={session.friendName}
                    className="relative size-24 rounded-full object-cover shadow-2xl border-4"
                    style={{ borderColor: "var(--m-primary, #6366f1)" }}
                  />
                ) : (
                  <div
                    className="relative size-24 rounded-full grid place-items-center text-3xl font-bold shadow-2xl border-4 text-white"
                    style={{
                      backgroundColor: "var(--m-primary, #6366f1)",
                      borderColor: "var(--m-primary, #6366f1)",
                    }}
                  >
                    {session.friendName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <h3
                className="text-2xl font-bold font-[Roboto_Slab]"
                style={{ color: "var(--m-text-heading, #0f172a)" }}
              >
                {session.friendName}
              </h3>

              <p
                className="text-xs font-medium mt-2 flex items-center gap-1.5"
                style={{ color: "var(--m-text-sub, #64748b)" }}
              >
                <Volume2 size={14} className="animate-pulse" style={{ color: "var(--m-primary)" }} />
                <span>{isRinging ? "Calling friend..." : "Connected • Voice Active"}</span>
              </p>
            </div>
          )}

          {/* Picture-in-Picture Local Self Preview (When camera or screen is streaming) */}
          {hasLocalVideo && (
            <div className="absolute bottom-4 right-4 z-20 w-36 h-28 sm:w-48 sm:h-36 rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black">
              <video
                ref={setLocalVideoEl}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isScreenSharing ? "" : "-scale-x-100"}`}
              />
              <span className="absolute bottom-1.5 left-2 text-[10px] font-mono bg-black/70 px-2 py-0.5 rounded text-white font-semibold">
                {isScreenSharing ? "You (Sharing Screen)" : "You"}
              </span>
            </div>
          )}
        </div>

        {/* Bottom Call Controls Toolbar (Theme-Adaptive) */}
        <div
          className="p-4 sm:p-5 flex items-center justify-center gap-3 sm:gap-6 z-20 border-t shrink-0"
          style={{
            backgroundColor: "var(--m-surface-solid, #ffffff)",
            borderColor: "var(--m-border-light, rgba(0, 0, 0, 0.08))",
          }}
        >
          {/* Mute Mic */}
          <button
            type="button"
            onClick={onToggleMute}
            className="p-3.5 rounded-2xl transition shadow-sm flex items-center justify-center cursor-pointer border"
            style={
              isMuted
                ? {
                    backgroundColor: "var(--m-danger-bg, #fee2e2)",
                    color: "var(--m-danger-text, #b91c1c)",
                    borderColor: "var(--m-danger-border, #fca5a5)",
                  }
                : {
                    backgroundColor: "var(--m-surface-alt, #f1f5f9)",
                    color: "var(--m-text, #1e293b)",
                    borderColor: "var(--m-border-light, rgba(0, 0, 0, 0.08))",
                  }
            }
            title={isMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Toggle Camera */}
          <button
            type="button"
            onClick={onToggleVideo}
            className="p-3.5 rounded-2xl transition shadow-sm flex items-center justify-center cursor-pointer border"
            style={
              !isVideoOff
                ? {
                    backgroundColor: "var(--m-primary, #4338ca)",
                    color: "var(--m-primary-text, #ffffff)",
                    borderColor: "transparent",
                  }
                : {
                    backgroundColor: "var(--m-surface-alt, #f1f5f9)",
                    color: "var(--m-text, #1e293b)",
                    borderColor: "var(--m-border-light, rgba(0, 0, 0, 0.08))",
                  }
            }
            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          {/* Toggle Screen Share (With Tab/System Audio!) */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            className="p-3.5 rounded-2xl transition shadow-sm flex items-center justify-center cursor-pointer border"
            style={
              isScreenSharing
                ? {
                    backgroundColor: "var(--m-primary, #4338ca)",
                    color: "var(--m-primary-text, #ffffff)",
                    borderColor: "transparent",
                  }
                : {
                    backgroundColor: "var(--m-surface-alt, #f1f5f9)",
                    color: "var(--m-text, #1e293b)",
                    borderColor: "var(--m-border-light, rgba(0, 0, 0, 0.08))",
                  }
            }
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen with Sound"}
          >
            <Monitor size={20} />
          </button>

          {/* End Call / Hangup (Red Pill) */}
          <button
            type="button"
            onClick={onEndCall}
            className="p-3.5 px-6 sm:px-8 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer active:scale-95"
            title="End Call"
          >
            <PhoneOff size={20} />
            <span className="text-xs sm:text-sm font-bold">End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}

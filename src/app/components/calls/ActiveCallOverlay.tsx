import React, { useEffect, useRef, useState } from "react";
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
  Wifi,
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
  durationSeconds,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
}: ActiveCallOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Bind local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoOff, isScreenSharing]);

  // Bind remote stream to remote video & audio elements
  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream]);

  const hasRemoteVideo =
    remoteStream &&
    remoteStream.getVideoTracks().length > 0 &&
    remoteStream.getVideoTracks().some((t) => t.enabled);

  const hasLocalVideo =
    localStream &&
    localStream.getVideoTracks().length > 0 &&
    !isVideoOff;

  const isRinging = callState === "outgoing_ringing";

  // Hidden audio element for receiving audio safely
  const audioElement = <audio ref={remoteAudioRef} autoPlay playsInline />;

  // ─── Minimized Floating Pill View (lets users study / text while calling) ───
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-2.5 pr-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom-4 duration-150"
        style={{
          backgroundColor: "var(--m-surface-solid, #18181b)",
          borderColor: "var(--m-border, rgba(255,255,255,0.15))",
          boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.7)",
        }}
      >
        {audioElement}

        {/* Small Avatar */}
        <div className="relative">
          {session.friendImage ? (
            <img
              src={session.friendImage}
              alt={session.friendName}
              className="size-10 rounded-full object-cover border border-emerald-400"
            />
          ) : (
            <div
              className="size-10 rounded-full grid place-items-center text-sm font-bold text-white border border-emerald-400"
              style={{ backgroundColor: "var(--m-primary, #6366f1)" }}
            >
              {session.friendName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-black" />
        </div>

        {/* Name & Timer */}
        <div className="min-w-0 pr-1">
          <p className="text-xs font-bold text-white truncate max-w-[110px]">{session.friendName}</p>
          <p className="text-[11px] font-mono font-semibold text-emerald-400">
            {isRinging ? "Calling..." : formatDuration(durationSeconds)}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1.5 ml-1">
          <button
            type="button"
            onClick={onToggleMute}
            className={`p-2 rounded-xl transition ${
              isMuted ? "bg-rose-500/20 text-rose-400" : "bg-white/10 hover:bg-white/20 text-zinc-300"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 transition"
            title="Expand Call"
          >
            <Maximize2 size={15} />
          </button>

          <button
            type="button"
            onClick={onEndCall}
            className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm"
            title="End Call"
          >
            <PhoneOff size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ─── Fullscreen / Modal In-Call Overlay ───
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-lg animate-in fade-in duration-200">
      {audioElement}

      <div
        className="w-full max-w-2xl h-[560px] max-h-[92vh] rounded-3xl flex flex-col relative overflow-hidden shadow-2xl border"
        style={{
          backgroundColor: "#0f172a",
          borderColor: "rgba(255, 255, 255, 0.14)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9)",
        }}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-4 px-6 z-20 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="size-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-left">
              <h4 className="text-sm font-bold text-white truncate">{session.friendName}</h4>
              <p className="text-[11px] font-mono text-zinc-400">
                {isRinging ? "Ringing..." : formatDuration(durationSeconds)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[10px] text-zinc-300 font-mono">
              <Wifi size={12} className="text-emerald-400" />
              <span>P2P Encrypted</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-xl hover:bg-white/15 text-zinc-300 hover:text-white transition"
              title="Minimize to floating window"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Center Canvas: Video Feed or Audio Avatar Waveform */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950">
          {hasRemoteVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6">
              {/* Pulsing Avatar */}
              <div className="relative mb-6 flex items-center justify-center">
                <div className="absolute size-36 rounded-full bg-indigo-500/15 animate-ping opacity-60" />
                <div className="absolute size-32 rounded-full bg-indigo-500/20 animate-pulse" />

                {session.friendImage ? (
                  <img
                    src={session.friendImage}
                    alt={session.friendName}
                    className="relative size-24 rounded-full object-cover shadow-2xl border-2 border-indigo-400"
                  />
                ) : (
                  <div
                    className="relative size-24 rounded-full grid place-items-center text-3xl font-bold shadow-2xl border-2 border-indigo-400 text-white"
                    style={{ backgroundColor: "var(--m-primary, #6366f1)" }}
                  >
                    {session.friendName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <h3 className="text-xl font-bold text-white font-[Roboto_Slab]">{session.friendName}</h3>
              <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5">
                <Volume2 size={14} className="text-indigo-400 animate-pulse" />
                <span>{isRinging ? "Calling friend..." : "Connected • Voice Active"}</span>
              </p>
            </div>
          )}

          {/* Picture-in-Picture Local Self Preview (shown when video is active) */}
          {hasLocalVideo && (
            <div className="absolute bottom-4 right-4 z-20 w-36 h-28 sm:w-44 sm:h-32 rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              <span className="absolute bottom-1.5 left-2 text-[9px] font-mono bg-black/60 px-1.5 py-0.5 rounded text-white/80">
                You
              </span>
            </div>
          )}
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div className="p-4 sm:p-5 flex items-center justify-center gap-4 sm:gap-6 z-20 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`p-3.5 rounded-2xl transition shadow-lg flex items-center justify-center ${
              isMuted
                ? "bg-rose-500/25 text-rose-400 border border-rose-500/40 hover:bg-rose-500/35"
                : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
            }`}
            title={isMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Toggle Camera */}
          <button
            type="button"
            onClick={onToggleVideo}
            className={`p-3.5 rounded-2xl transition shadow-lg flex items-center justify-center ${
              isVideoOff
                ? "bg-rose-500/25 text-rose-400 border border-rose-500/40 hover:bg-rose-500/35"
                : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
            }`}
            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          {/* Toggle Screen Share */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`p-3.5 rounded-2xl transition shadow-lg flex items-center justify-center ${
              isScreenSharing
                ? "bg-indigo-500 text-white shadow-indigo-500/30 hover:bg-indigo-600"
                : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
            }`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen for Study"}
          >
            <Monitor size={20} />
          </button>

          {/* End Call / Hangup (Red) */}
          <button
            type="button"
            onClick={onEndCall}
            className="p-3.5 sm:px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer active:scale-95"
            title="End Call"
          >
            <PhoneOff size={20} />
            <span className="hidden sm:inline text-xs">End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}

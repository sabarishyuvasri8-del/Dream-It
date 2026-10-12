import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Smile,
  Hand,
  MoreVertical,
  Info,
  Users,
  MessageSquare,
  LayoutGrid,
  Lock,
  Maximize2,
  Minimize2,
  ShieldCheck,
  ChevronDown,
  Captions,
  Volume2,
} from "lucide-react";
import { ActiveCallSession, CallState, FloatingReaction } from "./useWebRTCCall";

interface ActiveCallOverlayProps {
  session: ActiveCallSession;
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  remoteHasVideo: boolean;
  remoteIsScreenSharing?: boolean;
  remoteIsMuted?: boolean;
  handRaised?: boolean;
  remoteHandRaised?: boolean;
  reactions?: FloatingReaction[];
  myUserName?: string;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onSendReaction?: (emoji: string) => void;
  onToggleHandRaise?: () => void;
}

const EMOJI_LIST = ["💖", "👍", "🎉", "👏", "😂", "😮", "😢", "🤔", "🔥"];

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Isolated duration timer leaf component:
 * Updates ONLY this small text element every second.
 * Zero CPU overhead and ZERO re-renders of the parent overlay or Dashboard!
 */
const CallDurationDisplay = React.memo(function CallDurationDisplay({
  startedAt,
  isRinging,
}: {
  startedAt?: number;
  isRinging: boolean;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (isRinging || !startedAt) {
      setSeconds(0);
      return;
    }
    const update = () => {
      setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, isRinging]);

  if (isRinging) {
    return (
      <span className="px-3 py-1 rounded-full bg-[#3c4043] text-amber-300 text-xs font-medium">
        Calling friend...
      </span>
    );
  }

  return (
    <span className="px-3 py-1 rounded-full bg-[#3c4043]/80 text-neutral-300 text-xs font-mono font-medium">
      {formatDuration(seconds)}
    </span>
  );
});

/**
 * Isolated live clock leaf component:
 * Updates its text span once every 10 seconds instead of every second.
 * Prevents re-rendering the parent overlay!
 */
const MeetLiveClock = React.memo(function MeetLiveClock() {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      );
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  return <span className="font-mono text-neutral-200 font-semibold">{timeStr || "19:09"}</span>;
});

const ActiveCallOverlay = React.memo(function ActiveCallOverlay({
  session,
  callState,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  isScreenSharing,
  remoteHasVideo,
  remoteIsScreenSharing = false,
  remoteIsMuted = false,
  handRaised = false,
  remoteHandRaised = false,
  reactions = [],
  myUserName = "You",
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onSendReaction,
  onToggleHandRaise,
}: ActiveCallOverlayProps) {
  const [isPipMode, setIsPipMode] = useState(false);
  const [showReactionsBar, setShowReactionsBar] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [captionsActive, setCaptionsActive] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipRemoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Guarantee remote stream audio playback with dedicated hidden audio tag & autoplay unlocker
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      const audioEl = remoteAudioRef.current;
      audioEl.srcObject = remoteStream;
      audioEl.muted = false;
      audioEl.volume = 1.0;

      const tryPlay = () => {
        audioEl.play().catch(() => {});
      };

      tryPlay();

      // Window-level interaction listener to unlock autoplay immediately on any click or keypress
      const unlockAudio = () => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.volume = 1.0;
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      window.addEventListener("click", unlockAudio);
      window.addEventListener("touchstart", unlockAudio);
      window.addEventListener("keydown", unlockAudio);

      return () => {
        window.removeEventListener("click", unlockAudio);
        window.removeEventListener("touchstart", unlockAudio);
        window.removeEventListener("keydown", unlockAudio);
      };
    }
  }, [remoteStream]);

  // Synchronize main remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, remoteHasVideo, isPipMode]);

  // Synchronize PiP floating remote video element
  useEffect(() => {
    if (pipRemoteVideoRef.current && remoteStream) {
      if (pipRemoteVideoRef.current.srcObject !== remoteStream) {
        pipRemoteVideoRef.current.srcObject = remoteStream;
      }
      pipRemoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, remoteHasVideo, isPipMode]);

  // Synchronize local preview video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoOff, isScreenSharing]);

  const hasLocalVideo = (!isVideoOff || isScreenSharing) && Boolean(localStream?.getVideoTracks().length);
  const isRinging = callState === "outgoing_ringing";

  // Google Meet meeting code slug formatted from session
  const meetingCodeSlug =
    session.sessionId
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 9)
      .match(/.{1,3}/g)
      ?.join("-") || "acn-nied-vom";

  const friendInitial = session.friendName.charAt(0).toUpperCase() || "S";
  const myInitial = myUserName.charAt(0).toUpperCase() || "Y";

  const hiddenAudioElement = (
    <audio ref={remoteAudioRef} autoPlay playsInline />
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // VIEW 1: GOOGLE MEET PICTURE-IN-PICTURE (PiP) FLOATING MINI-PLAYER (Image 3)
  // ══════════════════════════════════════════════════════════════════════════════
  if (isPipMode) {
    return (
      <div
        className="fixed bottom-5 right-5 z-50 w-[330px] sm:w-[360px] h-[390px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#3c4043]"
        style={{
          backgroundColor: "#202124",
          color: "#e8eaed",
          contain: "layout paint",
          transform: "translateZ(0)",
        }}
      >
        {hiddenAudioElement}

        {/* PiP Header: meet.google.com + mic + expand icon */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#171717] border-b border-[#3c4043]/60 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="13" height="14" rx="2" fill="#00897B" />
              <polygon points="17,9 22,5 22,19 17,15" fill="#00897B" />
            </svg>
            <span className="text-xs font-medium text-neutral-300 font-sans tracking-tight truncate max-w-[150px]">
              meet.google.com
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isMuted ? (
              <MicOff size={14} className="text-[#ea4335]" />
            ) : (
              <Mic size={14} className="text-neutral-400" />
            )}
            <button
              type="button"
              onClick={() => setIsPipMode(false)}
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-[#3c4043] transition cursor-pointer"
              title="Expand to Full Meeting"
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>

        {/* PiP Center Tile (Google Meet Brown Tile / Live Video) */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden m-2 rounded-xl"
          style={{ backgroundColor: "#382820" }}
        >
          {/* Live Remote Video */}
          <video
            ref={pipRemoteVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${remoteHasVideo ? "block" : "hidden"}`}
          />

          {/* Fallback Google Meet Avatar Tile */}
          {!remoteHasVideo && (
            <div className="flex flex-col items-center justify-center select-none">
              {session.friendImage ? (
                <img
                  src={session.friendImage}
                  alt={session.friendName}
                  className="size-24 rounded-full object-cover shadow-xl border-2 border-white/20"
                />
              ) : (
                <div className="size-24 rounded-full bg-[#5f6368] text-white flex items-center justify-center text-3xl font-normal shadow-xl">
                  {friendInitial}
                </div>
              )}
              {isRinging && (
                <p className="text-xs text-neutral-300 mt-2 font-medium">
                  Calling...
                </p>
              )}
            </div>
          )}

          {/* Bottom-Left Participant Name Tag */}
          <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 text-white text-xs font-medium">
            <span className="truncate max-w-[180px]">
              {session.friendName}
              {remoteIsScreenSharing && " (Presentation)"}
            </span>
            {remoteIsMuted && <MicOff size={12} className="text-[#ea4335]" />}
          </div>
        </div>

        {/* PiP Bottom Controls Bar */}
        <div className="px-3 py-2.5 bg-[#171717] flex items-center justify-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            className={`p-2.5 rounded-full transition cursor-pointer ${
              isMuted ? "bg-[#ea4335] text-white" : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
            }`}
            title={isMuted ? "Turn on microphone" : "Turn off microphone"}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <button
            type="button"
            onClick={onToggleVideo}
            className={`p-2.5 rounded-full transition cursor-pointer ${
              isVideoOff ? "bg-[#ea4335] text-white" : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
            }`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
          </button>

          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`p-2.5 rounded-full transition cursor-pointer ${
              isScreenSharing ? "bg-[#8ab4f8] text-[#202124]" : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
            }`}
            title={isScreenSharing ? "Stop presenting" : "Present screen"}
          >
            <MonitorUp size={16} />
          </button>

          <button
            type="button"
            onClick={onEndCall}
            className="p-2.5 px-4 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white transition shadow cursor-pointer"
            title="Leave call"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // VIEW 2: GOOGLE MEET FULL VIEW (Image 2 - Solid High-Performance 120 FPS)
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none overflow-hidden"
      style={{
        backgroundColor: "#202124",
        color: "#e8eaed",
        fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
        contain: "strict",
        transform: "translateZ(0)",
      }}
    >
      {hiddenAudioElement}

      {/* ─── Google Meet Top Bar ─── */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20 bg-[#202124]">
        {/* Left: Time | meeting-code ⓘ */}
        <div className="flex items-center gap-3 text-sm font-medium text-neutral-300">
          <MeetLiveClock />
          <span className="text-neutral-500">|</span>
          <span className="font-mono text-neutral-200 tracking-wide font-medium">
            {meetingCodeSlug}
          </span>
          <button
            type="button"
            className="p-1 rounded-full hover:bg-[#3c4043] text-neutral-400 hover:text-white transition cursor-pointer"
            title="Meeting details"
          >
            <Info size={16} />
          </button>
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3c4043]/60 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
            <ShieldCheck size={12} />
            <span>P2P Encrypted • Zero Storage</span>
          </div>
        </div>

        {/* Center: Isolated Duration Timer (No parent re-renders!) */}
        <div className="flex items-center gap-2">
          <CallDurationDisplay startedAt={session.startedAt} isRinging={isRinging} />
        </div>

        {/* Right: Participant Badge & PiP Minimize Button */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3c4043] text-neutral-200 text-xs font-medium cursor-pointer hover:bg-[#474a4d] transition"
            title="Participants"
          >
            <div className="size-5 rounded-full bg-[#5f6368] text-white flex items-center justify-center text-[10px] font-bold">
              {myInitial}
            </div>
            <span>2</span>
          </div>

          <button
            type="button"
            onClick={() => setIsPipMode(true)}
            className="p-2 rounded-full hover:bg-[#3c4043] text-neutral-300 hover:text-white transition cursor-pointer"
            title="Open Picture-in-Picture floating player"
          >
            <Minimize2 size={18} />
          </button>
        </div>
      </header>

      {/* ─── Main Meeting Stage (Google Meet Brown Tile) ─── */}
      <main className="flex-1 relative flex items-center justify-center p-3 sm:p-5 overflow-hidden">
        <div
          className="w-full h-full rounded-2xl sm:rounded-3xl relative flex items-center justify-center overflow-hidden shadow-2xl transition-all"
          style={{ backgroundColor: "#382820" }}
        >
          {/* Live Remote Video Stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${remoteHasVideo ? "block" : "hidden"}`}
            style={{ transform: "translateZ(0)" }}
          />

          {/* Remote Video OFF: Google Meet Signature Avatar Tile */}
          {!remoteHasVideo && (
            <div className="flex flex-col items-center justify-center select-none text-center p-6">
              <div className="relative flex items-center justify-center mb-3">
                {session.friendImage ? (
                  <img
                    src={session.friendImage}
                    alt={session.friendName}
                    className="relative size-28 sm:size-36 rounded-full object-cover shadow-2xl border-4 border-black/20"
                  />
                ) : (
                  <div className="relative size-28 sm:size-36 rounded-full bg-[#5f6368] text-white flex items-center justify-center text-5xl sm:text-6xl font-normal shadow-2xl">
                    {friendInitial}
                  </div>
                )}
              </div>

              {isRinging && (
                <p className="text-sm font-medium text-neutral-300 mt-2 flex items-center gap-1.5">
                  <Volume2 size={15} />
                  <span>Ringing...</span>
                </p>
              )}
            </div>
          )}

          {/* Bottom-Left Participant Name Tag */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 text-white text-sm font-medium shadow-md">
            <span>
              {session.friendName}
              {remoteIsScreenSharing && " (Presentation)"}
            </span>
            {remoteIsMuted && (
              <span className="p-0.5 rounded bg-[#ea4335]/90 text-white">
                <MicOff size={13} />
              </span>
            )}
          </div>

          {/* Friend Hand Raised Floating Badge */}
          {remoteHandRaised && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#fbbc04] text-neutral-900 font-bold text-xs shadow-lg">
              <Hand size={15} />
              <span>{session.friendName} raised a hand</span>
            </div>
          )}

          {/* Floating Emoji Reactions Stream */}
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            {reactions.map((r) => (
              <div
                key={r.id}
                className="absolute bottom-16 text-3xl sm:text-4xl"
                style={{
                  left: `${r.leftPercent}%`,
                  animation: "floatUp 2.2s ease-out forwards",
                }}
              >
                {r.emoji}
              </div>
            ))}
          </div>

          {/* ─── Self Preview Picture-in-Picture Tile (Bottom-Right) ─── */}
          <div className="absolute bottom-4 right-4 z-20 w-36 h-28 sm:w-56 sm:h-36 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#202124] flex items-center justify-center">
            {hasLocalVideo ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isScreenSharing ? "" : "-scale-x-100"}`}
                style={{ transform: "translateZ(0)" }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center">
                <div className="size-14 rounded-full bg-[#5f6368] text-white flex items-center justify-center text-xl font-medium shadow">
                  {myInitial}
                </div>
              </div>
            )}

            <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded bg-black/70 text-white text-[11px] font-medium flex items-center gap-1">
              <span>{isScreenSharing ? "You (Presentation)" : "You"}</span>
              {isMuted && <MicOff size={11} className="text-[#ea4335]" />}
            </div>
          </div>
        </div>
      </main>

      {/* ─── Floating Emojis Picker Bar ─── */}
      {showReactionsBar && (
        <div className="flex items-center justify-center z-30 mb-2">
          <div className="flex items-center gap-1 p-2 rounded-full bg-[#3c4043] border border-white/10 shadow-2xl">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSendReaction?.(emoji);
                  setShowReactionsBar(false);
                }}
                className="p-2 hover:scale-125 rounded-full transition text-2xl cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Google Meet Bottom Control Toolbar ─── */}
      <footer className="h-20 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20 relative bg-[#202124]">
        {/* Left Space (Meeting details) */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400 font-mono">
          <span>{meetingCodeSlug}</span>
        </div>

        {/* Center: Google Meet Signature Control Buttons */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mx-auto">
          <button
            type="button"
            className="hidden sm:flex items-center justify-center size-10 rounded-full text-neutral-400 hover:text-white hover:bg-[#3c4043] transition cursor-pointer"
            title="Audio settings"
          >
            <ChevronDown size={18} />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className={`size-12 rounded-full flex items-center justify-center transition shadow cursor-pointer active:scale-95 ${
              isMuted
                ? "bg-[#ea4335] text-white hover:bg-[#d93025]"
                : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
            }`}
            title={isMuted ? "Turn on microphone" : "Turn off microphone"}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            type="button"
            onClick={onToggleVideo}
            className={`size-12 rounded-full flex items-center justify-center transition shadow cursor-pointer active:scale-95 ${
              isVideoOff
                ? "bg-[#ea4335] text-white hover:bg-[#d93025]"
                : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
            }`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`size-12 rounded-full flex items-center justify-center transition shadow cursor-pointer active:scale-95 ${
              isScreenSharing
                ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#a8c7fa]"
                : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
            }`}
            title={isScreenSharing ? "Stop presenting" : "Present screen (with audio)"}
          >
            <MonitorUp size={20} />
          </button>

          <button
            type="button"
            onClick={() => setShowReactionsBar(!showReactionsBar)}
            className={`size-12 rounded-full flex items-center justify-center transition shadow cursor-pointer active:scale-95 ${
              showReactionsBar
                ? "bg-[#8ab4f8] text-[#202124]"
                : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
            }`}
            title="Send a reaction"
          >
            <Smile size={20} />
          </button>

          <button
            type="button"
            onClick={() => setCaptionsActive(!captionsActive)}
            className={`hidden sm:flex size-12 rounded-full items-center justify-center transition shadow cursor-pointer active:scale-95 ${
              captionsActive
                ? "bg-[#8ab4f8] text-[#202124]"
                : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
            }`}
            title={captionsActive ? "Turn off captions" : "Turn on captions"}
          >
            <Captions size={20} />
          </button>

          <button
            type="button"
            onClick={onToggleHandRaise}
            className={`size-12 rounded-full flex items-center justify-center transition shadow cursor-pointer active:scale-95 ${
              handRaised
                ? "bg-[#fbbc04] text-neutral-900"
                : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
            }`}
            title={handRaised ? "Lower hand" : "Raise hand"}
          >
            <Hand size={20} />
          </button>

          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="hidden sm:flex size-12 rounded-full items-center justify-center bg-[#3c4043] text-white hover:bg-[#474a4d] transition shadow cursor-pointer"
            title="More options"
          >
            <MoreVertical size={20} />
          </button>

          <button
            type="button"
            onClick={onEndCall}
            className="h-12 px-7 sm:px-9 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95 ml-1 sm:ml-2"
            title="Leave call"
          >
            <PhoneOff size={20} />
          </button>
        </div>

        {/* Right Utility Icons */}
        <div className="hidden lg:flex items-center gap-3 text-neutral-400">
          <button
            type="button"
            className="p-2.5 rounded-full hover:bg-[#3c4043] hover:text-white transition cursor-pointer"
            title="Meeting details"
          >
            <Info size={19} />
          </button>
          <button
            type="button"
            className="p-2.5 rounded-full hover:bg-[#3c4043] hover:text-white transition cursor-pointer relative"
            title="People (2)"
          >
            <Users size={19} />
          </button>
          <button
            type="button"
            className="p-2.5 rounded-full hover:bg-[#3c4043] hover:text-white transition cursor-pointer"
            title="Chat with everyone"
          >
            <MessageSquare size={19} />
          </button>
          <button
            type="button"
            className="p-2.5 rounded-full hover:bg-[#3c4043] hover:text-white transition cursor-pointer"
            title="Activities"
          >
            <LayoutGrid size={19} />
          </button>
          <button
            type="button"
            className="p-2.5 rounded-full hover:bg-[#3c4043] hover:text-white transition cursor-pointer"
            title="Host controls"
          >
            <Lock size={19} />
          </button>
        </div>
      </footer>

      {/* Floating Reaction Emojis Animation */}
      <style>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(0.8);
          }
          50% {
            opacity: 1;
            transform: translateY(-120px) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translateY(-220px) scale(1.4);
          }
        }
      `}</style>
    </div>
  );
});

export default ActiveCallOverlay;

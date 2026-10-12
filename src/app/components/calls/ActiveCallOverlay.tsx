import React, { useEffect, useRef, useState, useCallback } from "react";
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
  Users,
  MessageSquare,
  LayoutGrid,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Captions,
  Volume2,
  Settings,
  X,
  Send,
  Search,
  Sparkles,
  VolumeX,
  Check,
  Radio,
  Sliders,
  HelpCircle,
} from "lucide-react";
import { ActiveCallSession, CallState, FloatingReaction, InCallMessage } from "./useWebRTCCall";

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
  inCallMessages?: InCallMessage[];
  myUserName?: string;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onSendReaction?: (emoji: string) => void;
  onToggleHandRaise?: () => void;
  onSendInCallMessage?: (text: string) => void;
  onChangeAudioInput?: (deviceId: string) => Promise<void>;
  onChangeVideoInput?: (deviceId: string) => Promise<void>;
}

const EMOJI_LIST = ["💖", "👍", "🎉", "👏", "😂", "😮", "😢", "🤔", "🔥"];

type StageTheme = "green" | "brown" | "charcoal" | "navy";

const THEME_COLORS: Record<StageTheme, { bg: string; name: string }> = {
  green: { bg: "#3d5a22", name: "Moss Green (Default)" },
  brown: { bg: "#382820", name: "Warm Brown" },
  charcoal: { bg: "#282a2d", name: "Charcoal Slate" },
  navy: { bg: "#1e2a38", name: "Midnight Navy" },
};

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Isolated duration timer leaf component:
 * Updates ONLY this text element every second. ZERO re-renders of the parent overlay!
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
 * Updates once every 10 seconds. ZERO re-renders of the parent!
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

  return <span className="font-mono text-neutral-200 font-semibold">{timeStr || "19:38"}</span>;
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
  inCallMessages = [],
  myUserName = "Sabarish Yuvasri",
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onSendReaction,
  onToggleHandRaise,
  onSendInCallMessage,
  onChangeAudioInput,
  onChangeVideoInput,
}: ActiveCallOverlayProps) {
  // Modal & Sidebar states
  const [isPipMode, setIsPipMode] = useState(false);
  const [showReactionsBar, setShowReactionsBar] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [captionsActive, setCaptionsActive] = useState(false);
  const [showDeviceBar, setShowDeviceBar] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"audio" | "video" | "general">("audio");
  const [activeSidebar, setActiveSidebar] = useState<"none" | "people" | "chat">("none");
  const [stageTheme, setStageTheme] = useState<StageTheme>("green");
  const [showHandToast, setShowHandToast] = useState(false);
  const [inCallText, setInCallText] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");

  // Media Devices list
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>("");
  const [selectedCamId, setSelectedCamId] = useState<string>("");
  const [showMicDropdown, setShowMicDropdown] = useState(false);
  const [showSpeakerDropdown, setShowSpeakerDropdown] = useState(false);
  const [showCamDropdown, setShowCamDropdown] = useState(false);

  // Video and Audio element refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipRemoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const settingsPreviewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Enumerate hardware devices
  useEffect(() => {
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const aIns = devices.filter((d) => d.kind === "audioinput");
        const aOuts = devices.filter((d) => d.kind === "audiooutput");
        const vIns = devices.filter((d) => d.kind === "videoinput");

        setAudioInputs(aIns);
        setAudioOutputs(aOuts);
        setVideoInputs(vIns);

        if (aIns.length > 0 && !selectedMicId) setSelectedMicId(aIns[0].deviceId);
        if (aOuts.length > 0 && !selectedSpeakerId) setSelectedSpeakerId(aOuts[0].deviceId);
        if (vIns.length > 0 && !selectedCamId) setSelectedCamId(vIns[0].deviceId);
      } catch (err) {
        console.warn("[WebRTC] Could not enumerate devices:", err);
      }
    }
    loadDevices();
  }, [selectedMicId, selectedSpeakerId, selectedCamId]);

  // Hand raised toast simulation (Screenshot 2: "It sounds like you've said something, so your hand will be lowered")
  useEffect(() => {
    if (handRaised) {
      const timer = setTimeout(() => {
        setShowHandToast(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowHandToast(false);
    }
  }, [handRaised]);

  // Audio stream playback & autoplay unlocker
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      const audioEl = remoteAudioRef.current;
      audioEl.srcObject = remoteStream;
      audioEl.muted = false;
      audioEl.volume = 1.0;

      audioEl.play().catch(() => {});

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

  // Synchronize remote video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, remoteHasVideo, isPipMode]);

  // Synchronize PiP remote video
  useEffect(() => {
    if (pipRemoteVideoRef.current && remoteStream) {
      if (pipRemoteVideoRef.current.srcObject !== remoteStream) {
        pipRemoteVideoRef.current.srcObject = remoteStream;
      }
      pipRemoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, remoteHasVideo, isPipMode]);

  // Synchronize local preview
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoOff, isScreenSharing]);

  // Synchronize settings modal preview
  useEffect(() => {
    if (settingsPreviewVideoRef.current && localStream) {
      settingsPreviewVideoRef.current.srcObject = localStream;
      settingsPreviewVideoRef.current.play().catch(() => {});
    }
  }, [showSettingsModal, localStream]);

  // Speaker change handler (setSinkId)
  const handleSpeakerChange = useCallback((deviceId: string) => {
    setSelectedSpeakerId(deviceId);
    setShowSpeakerDropdown(false);
    if (remoteAudioRef.current && (remoteAudioRef.current as any).setSinkId) {
      (remoteAudioRef.current as any).setSinkId(deviceId).catch(() => {});
    }
  }, []);

  // Mic change handler
  const handleMicChange = useCallback(
    (deviceId: string) => {
      setSelectedMicId(deviceId);
      setShowMicDropdown(false);
      onChangeAudioInput?.(deviceId);
    },
    [onChangeAudioInput]
  );

  // Camera change handler
  const handleCameraChange = useCallback(
    (deviceId: string) => {
      setSelectedCamId(deviceId);
      setShowCamDropdown(false);
      onChangeVideoInput?.(deviceId);
    },
    [onChangeVideoInput]
  );

  // Test sound generator for audio settings
  const handleTestAudioSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.15); // A5 note
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  // Fullscreen toggle
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    setShowMoreMenu(false);
  }, []);

  // Send in-call chat message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inCallText.trim()) return;
    onSendInCallMessage?.(inCallText);
    setInCallText("");
  };

  const hasLocalVideo = (!isVideoOff || isScreenSharing) && Boolean(localStream?.getVideoTracks().length);
  const isRinging = callState === "outgoing_ringing";

  const friendInitial = session.friendName.charAt(0).toLowerCase() || "j";
  const myInitial = myUserName.charAt(0).toUpperCase() || "S";

  // Active Device Names
  const activeMicName =
    audioInputs.find((d) => d.deviceId === selectedMicId)?.label ||
    "MacBook Air Microphone (Built-in)";
  const activeSpeakerName =
    audioOutputs.find((d) => d.deviceId === selectedSpeakerId)?.label ||
    "External Headphones (Built-in)";

  const hiddenAudioElement = <audio ref={remoteAudioRef} autoPlay playsInline />;

  // ══════════════════════════════════════════════════════════════════════════════
  // VIEW 1: GOOGLE MEET PICTURE-IN-PICTURE (PiP) FLOATING MINI-PLAYER
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
              {session.friendName}
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

        {/* PiP Center Tile */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden m-2 rounded-xl"
          style={{ backgroundColor: THEME_COLORS[stageTheme].bg }}
        >
          <video
            ref={pipRemoteVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${remoteHasVideo ? "block" : "hidden"}`}
          />

          {!remoteHasVideo && (
            <div className="flex flex-col items-center justify-center select-none">
              {session.friendImage ? (
                <img
                  src={session.friendImage}
                  alt={session.friendName}
                  className="size-24 rounded-full object-cover shadow-xl border-2 border-white/20"
                />
              ) : (
                <div className="size-20 rounded-full bg-[#66bb6a] text-white flex items-center justify-center text-3xl font-medium shadow-xl">
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
              isVideoOff ? "bg-[#f9d8d6] text-[#ea4335]" : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
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
  // VIEW 2: GOOGLE MEET FULL VIEW (Matches Screenshots 1, 2, 3, and 4)
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
        {/* Left: Time */}
        <div className="flex items-center gap-3 text-sm font-medium text-neutral-300">
          <MeetLiveClock />
        </div>

        {/* Center: Duration */}
        <div className="flex items-center gap-2">
          <CallDurationDisplay startedAt={session.startedAt} isRinging={isRinging} />
        </div>

        {/* Right: Hand Raised Badge (Screenshot 2) & Contributors Badge */}
        <div className="flex items-center gap-2.5">
          {/* Green Hand Capsule Badge (Screenshot 2 match) */}
          {handRaised && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c4eed0] text-[#072711] text-xs font-semibold shadow-sm animate-in fade-in duration-150">
              <Hand size={14} className="fill-[#072711]" />
              <span>{myUserName}</span>
            </div>
          )}

          {/* Contributors count badge (Screenshot 2: S 2) */}
          <div
            onClick={() => setActiveSidebar(activeSidebar === "people" ? "none" : "people")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3c4043] text-neutral-200 text-xs font-medium cursor-pointer hover:bg-[#474a4d] transition"
            title="People (2)"
          >
            <div className="size-5 rounded-full bg-[#795548] text-white flex items-center justify-center text-[10px] font-bold">
              {myInitial}
            </div>
            <span>2</span>
          </div>

          {/* Minimize to PiP */}
          <button
            type="button"
            onClick={() => setIsPipMode(true)}
            className="p-2 rounded-full hover:bg-[#3c4043] text-neutral-300 hover:text-white transition cursor-pointer"
            title="Open picture-in-picture mode"
          >
            <Minimize2 size={18} />
          </button>
        </div>
      </header>

      {/* ─── Main Content Row (Stage + Optional Sidebar) ─── */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Center Meeting Stage (Participant Tile) */}
        <main className="flex-1 relative flex items-center justify-center p-3 sm:p-5 overflow-hidden">
          <div
            className="w-full h-full rounded-2xl sm:rounded-3xl relative flex items-center justify-center overflow-hidden shadow-2xl transition-all"
            style={{ backgroundColor: THEME_COLORS[stageTheme].bg }}
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

            {/* Remote Video OFF: Google Meet Signature Avatar Tile (Screenshot 2 Match) */}
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
                    <div className="relative size-28 sm:size-36 rounded-full bg-[#66bb6a] text-white flex items-center justify-center text-5xl sm:text-6xl font-normal shadow-2xl">
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

            {/* Bottom-Left Participant Name Tag (Screenshot 2: "john bernard") */}
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

            {/* Google Meet Hand Lowering Toast (Screenshot 2 match) */}
            {showHandToast && (
              <div className="absolute bottom-16 left-4 z-30 flex items-center gap-3 px-4 py-3 rounded-lg bg-[#282a2d] border border-white/10 text-neutral-200 text-xs shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
                <span>It sounds like you've said something, so your hand will be lowered.</span>
                <button
                  type="button"
                  onClick={() => setShowHandToast(false)}
                  className="text-[#8ab4f8] hover:text-[#a8c7fa] font-semibold cursor-pointer underline text-xs"
                >
                  Keep it raised
                </button>
              </div>
            )}

            {/* Friend Hand Raised Floating Badge */}
            {remoteHandRaised && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#c4eed0] text-[#072711] font-bold text-xs shadow-lg animate-bounce">
                <Hand size={15} className="fill-[#072711]" />
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

            {/* ─── Self Preview Picture-in-Picture Tile (Bottom-Right, Screenshot 2 Match) ─── */}
            <div
              className="absolute bottom-4 right-4 z-20 w-44 h-28 sm:w-56 sm:h-36 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#f28b82]/40 flex items-center justify-center"
              style={{ backgroundColor: "#4a3525" }}
            >
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
                  <div className="size-14 rounded-full bg-[#795548] text-white flex items-center justify-center text-xl font-normal shadow">
                    {myInitial}
                  </div>
                </div>
              )}

              {/* Bottom tag inside self tile (Screenshot 2: Green hand capsule badge if raised, else name) */}
              <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                {handRaised ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c4eed0] text-[#072711] text-[10px] font-bold shadow-xs">
                    <Hand size={11} className="fill-[#072711]" />
                    <span>{myUserName}</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium flex items-center gap-1">
                    <span>{isScreenSharing ? "You (Presentation)" : myUserName}</span>
                    {isMuted && <MicOff size={10} className="text-[#ea4335]" />}
                  </span>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ─── Google Meet Right Sidebar (People / Chat / Info) (Screenshot 4) ─── */}
        {activeSidebar !== "none" && (
          <aside
            className="w-80 sm:w-96 bg-[#202124] border-l border-[#3c4043] flex flex-col z-30 shrink-0 animate-in slide-in-from-right duration-150"
            style={{ contain: "layout paint" }}
          >
            {/* Sidebar Header */}
            <div className="h-16 px-6 flex items-center justify-between border-b border-[#3c4043]/60">
              <h3 className="text-base font-medium text-neutral-200">
                {activeSidebar === "people" && "People"}
                {activeSidebar === "chat" && "In-call messages"}
              </h3>
              <button
                type="button"
                onClick={() => setActiveSidebar("none")}
                className="p-1.5 rounded-full hover:bg-[#3c4043] text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* ─── SIDEBAR VIEW 1: PEOPLE (Screenshot 4 Match) ─── */}
            {activeSidebar === "people" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Search Bar (Screenshot 4) */}
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-3 text-neutral-400" />
                  <input
                    type="text"
                    value={peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                    placeholder="Search for people"
                    className="w-full bg-[#303134] text-neutral-200 text-xs rounded-full pl-9 pr-4 py-2.5 border border-transparent focus:border-[#8ab4f8] outline-hidden placeholder:text-neutral-400"
                  />
                </div>

                {/* Section Header */}
                <div className="text-[11px] font-bold text-neutral-400 tracking-wider uppercase px-2">
                  In the meeting
                </div>

                {/* Contributors Accordion (Screenshot 4) */}
                <div className="rounded-xl border border-[#3c4043]/60 bg-[#282a2d] overflow-hidden">
                  <div className="px-3.5 py-2.5 flex items-center justify-between text-xs text-neutral-300 font-medium border-b border-[#3c4043]/40">
                    <span>Contributors</span>
                    <span className="flex items-center gap-1 text-neutral-400">
                      2 <ChevronDown size={14} />
                    </span>
                  </div>

                  {/* Participant 1: You */}
                  <div className="p-3 flex items-center justify-between hover:bg-[#303134] transition">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-[#795548] text-white flex items-center justify-center text-xs font-bold">
                        {myInitial}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-medium text-neutral-200">
                          {myUserName} (You)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      {isMuted ? <MicOff size={14} className="text-[#ea4335]" /> : <Mic size={14} />}
                      <MoreVertical size={14} className="cursor-pointer" />
                    </div>
                  </div>

                  {/* Participant 2: Friend */}
                  <div className="p-3 flex items-center justify-between hover:bg-[#303134] transition border-t border-[#3c4043]/40">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-[#66bb6a] text-white flex items-center justify-center text-xs font-bold">
                        {friendInitial}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-medium text-neutral-200">
                          {session.friendName}
                        </p>
                        <p className="text-[10px] text-neutral-400">Meeting participant</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      {remoteIsMuted ? <MicOff size={14} className="text-[#ea4335]" /> : <Mic size={14} />}
                      <MoreVertical size={14} className="cursor-pointer" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── SIDEBAR VIEW 2: IN-CALL MESSAGES / CHAT ─── */}
            {activeSidebar === "chat" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3 text-[11px] text-neutral-400 bg-[#282a2d] border-b border-[#3c4043] leading-relaxed text-center">
                  Messages can only be seen by people in the call and are deleted when the call ends.
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {inCallMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 text-xs">
                      <MessageSquare size={32} className="opacity-40 mb-2" />
                      <p>No messages yet</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">Send a message to your friend</p>
                    </div>
                  ) : (
                    inCallMessages.map((msg) => {
                      const isMe = msg.senderId === session.friendId ? false : true;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col text-left ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-0.5">
                            <span className="font-medium text-neutral-300">{msg.senderName}</span>
                            <span>•</span>
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div
                            className={`p-2.5 px-3 rounded-2xl text-xs max-w-[85%] break-words ${
                              isMe
                                ? "bg-[#8ab4f8] text-[#202124] rounded-tr-xs"
                                : "bg-[#303134] text-neutral-200 rounded-tl-xs"
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message Input */}
                <form
                  onSubmit={handleSendChat}
                  className="p-3 border-t border-[#3c4043] flex items-center gap-2 bg-[#202124]"
                >
                  <input
                    type="text"
                    value={inCallText}
                    onChange={(e) => setInCallText(e.target.value)}
                    placeholder="Send a message to everyone"
                    className="flex-1 bg-[#303134] text-neutral-200 text-xs rounded-full px-4 py-2.5 outline-hidden focus:border-[#8ab4f8] border border-transparent placeholder:text-neutral-400"
                  />
                  <button
                    type="submit"
                    disabled={!inCallText.trim()}
                    className="p-2.5 rounded-full bg-[#8ab4f8] text-[#202124] hover:bg-[#a8c7fa] disabled:opacity-40 disabled:hover:bg-[#8ab4f8] transition cursor-pointer"
                  >
                    <Send size={15} />
                  </button>
                </form>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ─── Device Selection Floating Bar (Screenshot 1 Match) ─── */}
      {showDeviceBar && (
        <div className="mx-auto mb-2 px-4 py-2.5 rounded-2xl bg-[#171717] border border-[#3c4043] shadow-2xl flex items-center gap-3 z-30 animate-in slide-in-from-bottom-2 duration-150">
          {/* Mic Selector Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowMicDropdown(!showMicDropdown);
                setShowSpeakerDropdown(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#202124] hover:bg-[#303134] text-xs text-neutral-200 border border-[#3c4043] transition cursor-pointer max-w-[220px]"
            >
              <Mic size={14} className="text-[#8ab4f8] shrink-0" />
              <span className="truncate">{activeMicName}</span>
              <ChevronDown size={14} className="shrink-0 text-neutral-400" />
            </button>

            {showMicDropdown && (
              <div className="absolute bottom-full mb-2 left-0 w-64 bg-[#303134] border border-[#3c4043] rounded-xl shadow-2xl overflow-hidden py-1 z-40 text-left text-xs">
                {audioInputs.length === 0 ? (
                  <div className="p-2.5 text-neutral-400">Default Microphone</div>
                ) : (
                  audioInputs.map((d) => (
                    <button
                      key={d.deviceId}
                      type="button"
                      onClick={() => handleMicChange(d.deviceId)}
                      className="w-full px-3 py-2 text-left hover:bg-[#3c4043] flex items-center justify-between text-neutral-200 cursor-pointer"
                    >
                      <span className="truncate">{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</span>
                      {selectedMicId === d.deviceId && <Check size={14} className="text-[#8ab4f8]" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Speaker Selector Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowSpeakerDropdown(!showSpeakerDropdown);
                setShowMicDropdown(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#202124] hover:bg-[#303134] text-xs text-neutral-200 border border-[#3c4043] transition cursor-pointer max-w-[220px]"
            >
              <Volume2 size={14} className="text-[#8ab4f8] shrink-0" />
              <span className="truncate">{activeSpeakerName}</span>
              <ChevronDown size={14} className="shrink-0 text-neutral-400" />
            </button>

            {showSpeakerDropdown && (
              <div className="absolute bottom-full mb-2 left-0 w-64 bg-[#303134] border border-[#3c4043] rounded-xl shadow-2xl overflow-hidden py-1 z-40 text-left text-xs">
                {audioOutputs.length === 0 ? (
                  <div className="p-2.5 text-neutral-400">Default Speaker / Headphones</div>
                ) : (
                  audioOutputs.map((d) => (
                    <button
                      key={d.deviceId}
                      type="button"
                      onClick={() => handleSpeakerChange(d.deviceId)}
                      className="w-full px-3 py-2 text-left hover:bg-[#3c4043] flex items-center justify-between text-neutral-200 cursor-pointer"
                    >
                      <span className="truncate">{d.label || `Speaker ${d.deviceId.slice(0, 5)}`}</span>
                      {selectedSpeakerId === d.deviceId && <Check size={14} className="text-[#8ab4f8]" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Settings Gear */}
          <button
            type="button"
            onClick={() => {
              setShowSettingsModal(true);
              setShowDeviceBar(false);
            }}
            className="p-2 rounded-full hover:bg-[#303134] text-neutral-300 hover:text-white transition cursor-pointer"
            title="Audio & Video Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      )}

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

      {/* ─── Google Meet Bottom Control Toolbar (Exact Match to Screenshot 1 & 2) ─── */}
      <footer className="h-20 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20 relative bg-[#202124]">
        {/* Left Space: Friend Name */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400">
          <span className="font-medium text-neutral-300">{session.friendName}</span>
        </div>

        {/* Center: Google Meet Controls (Screenshot 1 & 2 Match) */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mx-auto">
          {/* Quick Audio Chevron */}
          <button
            type="button"
            onClick={() => setShowDeviceBar(!showDeviceBar)}
            className="hidden sm:flex items-center justify-center size-10 rounded-full text-neutral-400 hover:text-white hover:bg-[#3c4043] transition cursor-pointer"
            title="Audio & Video Devices"
          >
            {showDeviceBar ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>

          {/* Split / Combined Microphone Button (Screenshot 1: Chevron + Mic) */}
          <div className="flex items-center rounded-full bg-[#3c4043] p-0.5">
            <button
              type="button"
              onClick={() => setShowDeviceBar(!showDeviceBar)}
              className="p-2.5 rounded-l-full hover:bg-[#474a4d] text-neutral-300 transition cursor-pointer"
              title="Microphone settings"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className={`size-11 rounded-full flex items-center justify-center transition shadow cursor-pointer active:scale-95 ${
                isMuted
                  ? "bg-[#ea4335] text-white hover:bg-[#d93025]"
                  : "bg-transparent text-white hover:bg-[#474a4d]"
              }`}
              title={isMuted ? "Turn on microphone" : "Turn off microphone"}
            >
              {isMuted ? <MicOff size={19} /> : <Mic size={19} />}
            </button>
          </div>

          {/* Split / Combined Camera Button (Screenshot 1: Chevron + Light Red Pill when Off) */}
          <div className="flex items-center rounded-full bg-[#3c4043] p-0.5">
            <button
              type="button"
              onClick={() => setShowCamDropdown(!showCamDropdown)}
              className="p-2.5 rounded-l-full hover:bg-[#474a4d] text-neutral-300 transition cursor-pointer"
              title="Camera settings"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={onToggleVideo}
              className={`h-11 px-3.5 rounded-full flex items-center justify-center transition shadow cursor-pointer active:scale-95 ${
                isVideoOff
                  ? "bg-[#f9d8d6] text-[#ea4335] hover:bg-[#fbd0cd]"
                  : "bg-transparent text-white hover:bg-[#474a4d]"
              }`}
              title={isVideoOff ? "Turn on camera" : "Turn off camera"}
            >
              {isVideoOff ? <VideoOff size={19} /> : <Video size={19} />}
            </button>
          </div>

          {/* Screen Share Button */}
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
            <MonitorUp size={19} />
          </button>

          {/* Reactions Button */}
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
            <Smile size={19} />
          </button>

          {/* Closed Captions Button (CC) */}
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
            <Captions size={19} />
          </button>

          {/* Hand Raise Button (Screenshot 2: Filled Light Blue #a8c7fa when raised!) */}
          <button
            type="button"
            onClick={onToggleHandRaise}
            className={`size-12 rounded-full flex items-center justify-center transition shadow cursor-pointer active:scale-95 ${
              handRaised
                ? "bg-[#a8c7fa] text-[#041e49]"
                : "bg-[#3c4043] text-white hover:bg-[#474a4d]"
            }`}
            title={handRaised ? "Lower hand" : "Raise hand"}
          >
            <Hand size={19} className={handRaised ? "fill-[#041e49]" : ""} />
          </button>

          {/* More Options Button (Opens Screenshot 3 Menu) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="size-12 rounded-full flex items-center justify-center bg-[#3c4043] text-white hover:bg-[#474a4d] transition shadow cursor-pointer"
              title="More options"
            >
              <MoreVertical size={19} />
            </button>

            {/* ─── More Options Popup Menu (Screenshot 3 Match) ─── */}
            {showMoreMenu && (
              <div
                className="absolute bottom-full mb-3 right-0 w-72 bg-[#282a2d] border border-[#3c4043] rounded-2xl shadow-2xl py-2 z-50 text-left text-xs text-neutral-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                style={{ contain: "layout paint" }}
              >
                {/* Disabled Header: Recording unavailable (Screenshot 3 match) */}
                <div className="px-4 py-2.5 flex items-start gap-3 border-b border-[#3c4043]/60 opacity-60">
                  <Radio size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-neutral-300">Recording unavailable</p>
                    <p className="text-[10px] text-neutral-400">You're not allowed to record this video call</p>
                  </div>
                </div>

                {/* Menu Items (Screenshot 3 match) */}
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#35373a] transition cursor-pointer"
                >
                  <LayoutGrid size={16} className="text-neutral-400" />
                  <span>Adjust view</span>
                </button>

                <button
                  type="button"
                  onClick={toggleFullScreen}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#35373a] transition cursor-pointer"
                >
                  <Maximize2 size={16} className="text-neutral-400" />
                  <span>Full screen</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPipMode(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#35373a] transition cursor-pointer"
                >
                  <Minimize2 size={16} className="text-neutral-400" />
                  <span>Open picture-in-picture mode</span>
                </button>

                {/* Backgrounds & effects theme switcher (Screenshot 3 match) */}
                <div className="px-4 py-2 hover:bg-[#35373a] transition">
                  <div className="flex items-center gap-3 mb-1.5">
                    <Sparkles size={16} className="text-neutral-400" />
                    <span>Backgrounds and effects</span>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    {(Object.keys(THEME_COLORS) as StageTheme[]).map((thm) => (
                      <button
                        key={thm}
                        type="button"
                        onClick={() => setStageTheme(thm)}
                        className={`size-6 rounded-full border-2 transition cursor-pointer ${
                          stageTheme === thm ? "border-white scale-110" : "border-transparent opacity-70"
                        }`}
                        style={{ backgroundColor: THEME_COLORS[thm].bg }}
                        title={THEME_COLORS[thm].name}
                      />
                    ))}
                  </div>
                </div>

                <div className="my-1 border-t border-[#3c4043]/60" />

                <button
                  type="button"
                  onClick={() => {
                    setActiveSidebar("chat");
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#35373a] transition cursor-pointer"
                >
                  <MessageSquare size={16} className="text-neutral-400" />
                  <span>In-call messages</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#35373a] transition cursor-pointer"
                >
                  <Settings size={16} className="text-neutral-400" />
                  <span>Settings</span>
                </button>
              </div>
            )}
          </div>

          {/* End Call Red Pill Button */}
          <button
            type="button"
            onClick={onEndCall}
            className="h-12 px-7 sm:px-9 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95 ml-1 sm:ml-2"
            title="Leave call"
          >
            <PhoneOff size={20} />
          </button>
        </div>

        {/* Right Utility Icons (People, Chat, Activities) */}
        <div className="hidden lg:flex items-center gap-2.5 text-neutral-400">
          <button
            type="button"
            onClick={() => setActiveSidebar(activeSidebar === "people" ? "none" : "people")}
            className={`p-2.5 rounded-full transition cursor-pointer ${
              activeSidebar === "people" ? "bg-[#3c4043] text-white" : "hover:bg-[#3c4043] hover:text-white"
            }`}
            title="People (2)"
          >
            <Users size={19} />
          </button>

          <button
            type="button"
            onClick={() => setActiveSidebar(activeSidebar === "chat" ? "none" : "chat")}
            className={`p-2.5 rounded-full transition cursor-pointer ${
              activeSidebar === "chat" ? "bg-[#3c4043] text-white" : "hover:bg-[#3c4043] hover:text-white"
            }`}
            title="Chat with everyone"
          >
            <MessageSquare size={19} />
          </button>

          <button
            type="button"
            onClick={() => setShowDeviceBar(!showDeviceBar)}
            className="p-2.5 rounded-full hover:bg-[#3c4043] hover:text-white transition cursor-pointer"
            title="Activities & Audio tools"
          >
            <LayoutGrid size={19} />
          </button>
        </div>
      </footer>

      {/* ─── Google Meet Settings Modal (Audio, Video, General) ─── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl bg-[#282a2d] border border-[#3c4043] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-left text-neutral-200"
            style={{ contain: "layout paint" }}
          >
            {/* Header */}
            <div className="h-16 px-6 flex items-center justify-between border-b border-[#3c4043]/60">
              <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                <Settings size={18} className="text-[#8ab4f8]" />
                <span>Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-full hover:bg-[#3c4043] text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Left Tab Nav + Right Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Tabs */}
              <div className="w-48 bg-[#202124] border-r border-[#3c4043]/60 p-3 space-y-1">
                <button
                  type="button"
                  onClick={() => setSettingsTab("audio")}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 transition cursor-pointer ${
                    settingsTab === "audio" ? "bg-[#3c4043] text-white" : "text-neutral-400 hover:bg-[#303134]"
                  }`}
                >
                  <Mic size={15} />
                  <span>Audio</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsTab("video")}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 transition cursor-pointer ${
                    settingsTab === "video" ? "bg-[#3c4043] text-white" : "text-neutral-400 hover:bg-[#303134]"
                  }`}
                >
                  <Video size={15} />
                  <span>Video</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsTab("general")}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 transition cursor-pointer ${
                    settingsTab === "general" ? "bg-[#3c4043] text-white" : "text-neutral-400 hover:bg-[#303134]"
                  }`}
                >
                  <Sliders size={15} />
                  <span>General</span>
                </button>
              </div>

              {/* Right Settings Panel */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-neutral-300">
                {/* ─── TAB 1: AUDIO SETTINGS ─── */}
                {settingsTab === "audio" && (
                  <>
                    <div>
                      <label className="block text-neutral-400 font-medium mb-2">Microphone</label>
                      <div className="flex items-center gap-3">
                        <select
                          value={selectedMicId}
                          onChange={(e) => handleMicChange(e.target.value)}
                          className="flex-1 bg-[#303134] border border-[#3c4043] rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-hidden"
                        >
                          {audioInputs.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                            </option>
                          ))}
                        </select>
                        {/* Audio input green level dots */}
                        <div className="flex items-center gap-1 px-3 py-2 bg-[#303134] rounded-xl border border-[#3c4043]">
                          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="size-2 rounded-full bg-emerald-500/40" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-neutral-400 font-medium mb-2">Speakers</label>
                      <div className="flex items-center gap-3">
                        <select
                          value={selectedSpeakerId}
                          onChange={(e) => handleSpeakerChange(e.target.value)}
                          className="flex-1 bg-[#303134] border border-[#3c4043] rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-hidden"
                        >
                          {audioOutputs.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label || `Speaker ${d.deviceId.slice(0, 5)}`}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleTestAudioSound}
                          className="px-4 py-2.5 rounded-xl bg-[#3c4043] hover:bg-[#474a4d] text-neutral-200 text-xs font-semibold transition cursor-pointer"
                        >
                          Test
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#202124] border border-[#3c4043]/50 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-200">Noise cancellation</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Filters out sound that isn't speech</p>
                      </div>
                      <div className="size-5 rounded-full bg-[#8ab4f8] flex items-center justify-center">
                        <Check size={12} className="text-[#202124] stroke-[3]" />
                      </div>
                    </div>
                  </>
                )}

                {/* ─── TAB 2: VIDEO SETTINGS ─── */}
                {settingsTab === "video" && (
                  <>
                    <div>
                      <label className="block text-neutral-400 font-medium mb-2">Camera</label>
                      <select
                        value={selectedCamId}
                        onChange={(e) => handleCameraChange(e.target.value)}
                        className="w-full bg-[#303134] border border-[#3c4043] rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-hidden"
                      >
                        {videoInputs.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-neutral-400 font-medium mb-2">Send resolution</label>
                        <select className="w-full bg-[#303134] border border-[#3c4043] rounded-xl px-3.5 py-2 text-xs text-neutral-200 outline-hidden">
                          <option>High definition (720p)</option>
                          <option>Standard definition (360p)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-neutral-400 font-medium mb-2">Receive resolution</label>
                        <select className="w-full bg-[#303134] border border-[#3c4043] rounded-xl px-3.5 py-2 text-xs text-neutral-200 outline-hidden">
                          <option>High definition (720p)</option>
                          <option>Standard definition (360p)</option>
                        </select>
                      </div>
                    </div>

                    {/* Camera preview tile */}
                    <div>
                      <p className="text-neutral-400 font-medium mb-2">Video preview</p>
                      <div className="w-full h-36 rounded-2xl bg-[#171717] border border-[#3c4043] overflow-hidden flex items-center justify-center">
                        {localStream && !isVideoOff ? (
                          <video
                            ref={settingsPreviewVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover -scale-x-100"
                          />
                        ) : (
                          <p className="text-neutral-500">Camera is off</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* ─── TAB 3: GENERAL SETTINGS ─── */}
                {settingsTab === "general" && (
                  <div className="space-y-4 text-xs leading-relaxed">
                    <div className="p-4 rounded-2xl bg-[#202124] border border-[#3c4043]/50 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-200">Leave empty calls</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Removes you from a call if no one else joins after a few minutes</p>
                      </div>
                      <div className="size-5 rounded-full bg-[#8ab4f8] flex items-center justify-center">
                        <Check size={12} className="text-[#202124] stroke-[3]" />
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#202124] border border-[#3c4043]/50 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-200">Send diagnostic logs</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Helps monitor connection health and audio stream quality</p>
                      </div>
                      <div className="size-5 rounded-full bg-[#8ab4f8] flex items-center justify-center">
                        <Check size={12} className="text-[#202124] stroke-[3]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Reaction Emojis CSS Animation */}
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

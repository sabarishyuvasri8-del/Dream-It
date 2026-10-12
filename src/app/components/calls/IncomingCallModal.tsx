import React from "react";
import { Phone, Video, PhoneOff } from "lucide-react";
import { IncomingCallInvite } from "./useWebRTCCall";

interface IncomingCallModalProps {
  incomingCall: IncomingCallInvite;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({
  incomingCall,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  const isVideo = incomingCall.callType === "video";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl border animate-in zoom-in-95 duration-200 relative overflow-hidden"
        style={{
          backgroundColor: "var(--m-surface-solid, #18181b)",
          borderColor: "var(--m-border, rgba(255,255,255,0.12))",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15)",
        }}
      >
        {/* Animated Background Pulse Rings */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute size-28 rounded-full bg-indigo-500/20 animate-ping opacity-75" />
          <div className="absolute size-24 rounded-full bg-indigo-500/30 animate-pulse" />

          {/* Caller Avatar */}
          {incomingCall.callerImage ? (
            <img
              src={incomingCall.callerImage}
              alt={incomingCall.callerName}
              className="relative size-20 rounded-full object-cover shadow-lg border-2 border-indigo-400"
            />
          ) : (
            <div
              className="relative size-20 rounded-full grid place-items-center text-2xl font-bold shadow-lg border-2 border-indigo-400 text-white"
              style={{ backgroundColor: "var(--m-primary, #6366f1)" }}
            >
              {incomingCall.callerName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Caller Info */}
        <h3 className="text-xl font-bold font-[Roboto_Slab] text-white truncate max-w-full">
          {incomingCall.callerName}
        </h3>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
          {isVideo ? <Video size={13} /> : <Phone size={13} />}
          <span>Incoming {isVideo ? "Video" : "Voice"} Call...</span>
        </div>

        <p className="text-xs mt-3 opacity-60 text-zinc-300">
          Peer-to-peer encrypted • Zero storage
        </p>

        {/* Action Buttons: Decline (Red) and Accept (Green) */}
        <div className="flex items-center justify-center gap-6 mt-8 w-full">
          <button
            type="button"
            onClick={onDecline}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
            title="Decline"
          >
            <div className="size-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition transform group-hover:scale-105 active:scale-95">
              <PhoneOff size={24} />
            </div>
            <span className="text-xs text-zinc-400 group-hover:text-white transition font-medium">Decline</span>
          </button>

          <button
            type="button"
            onClick={onAccept}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
            title="Accept"
          >
            <div className="size-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition transform group-hover:scale-105 active:scale-95 animate-bounce">
              {isVideo ? <Video size={24} /> : <Phone size={24} />}
            </div>
            <span className="text-xs text-zinc-400 group-hover:text-white transition font-medium">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}

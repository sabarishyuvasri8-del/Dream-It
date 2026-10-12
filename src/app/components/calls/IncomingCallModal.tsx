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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200"
      style={{ backgroundColor: "var(--m-modal-overlay, rgba(0, 0, 0, 0.6))" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl border animate-in zoom-in-95 duration-200 relative overflow-hidden"
        style={{
          backgroundColor: "var(--m-surface-solid, #ffffff)",
          borderColor: "var(--m-border, rgba(0, 0, 0, 0.12))",
          boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.35), 0 0 30px rgba(99, 102, 241, 0.12)",
          color: "var(--m-text, #1e293b)",
        }}
      >
        {/* Animated Background Pulse Rings */}
        <div className="relative mb-6 flex items-center justify-center">
          <div
            className="absolute size-28 rounded-full animate-ping opacity-35"
            style={{ backgroundColor: "var(--m-primary, #6366f1)" }}
          />
          <div
            className="absolute size-24 rounded-full animate-pulse opacity-40"
            style={{ backgroundColor: "var(--m-primary, #6366f1)" }}
          />

          {/* Caller Avatar */}
          {incomingCall.callerImage ? (
            <img
              src={incomingCall.callerImage}
              alt={incomingCall.callerName}
              className="relative size-20 rounded-full object-cover shadow-lg border-2"
              style={{ borderColor: "var(--m-primary, #6366f1)" }}
            />
          ) : (
            <div
              className="relative size-20 rounded-full grid place-items-center text-2xl font-bold shadow-lg border-2 text-white"
              style={{
                backgroundColor: "var(--m-primary, #6366f1)",
                borderColor: "var(--m-primary, #6366f1)",
              }}
            >
              {incomingCall.callerName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Caller Info */}
        <h3
          className="text-xl font-bold font-[Roboto_Slab] truncate max-w-full"
          style={{ color: "var(--m-text-heading, #0f172a)" }}
        >
          {incomingCall.callerName}
        </h3>

        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full border text-xs font-semibold shadow-xs"
          style={{
            backgroundColor: "var(--m-surface-alt, #f1f5f9)",
            borderColor: "var(--m-border-light, rgba(0, 0, 0, 0.08))",
            color: "var(--m-primary, #4338ca)",
          }}
        >
          {isVideo ? <Video size={13} /> : <Phone size={13} />}
          <span>Incoming {isVideo ? "Video" : "Voice"} Call...</span>
        </div>



        {/* Action Buttons: Decline (Red) and Accept (Green) */}
        <div className="flex items-center justify-center gap-8 mt-8 w-full">
          <button
            type="button"
            onClick={onDecline}
            className="flex flex-col items-center gap-2 group cursor-pointer"
            title="Decline"
          >
            <div className="size-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition transform group-hover:scale-105 active:scale-95 cursor-pointer">
              <PhoneOff size={24} />
            </div>
            <span
              className="text-xs font-bold transition"
              style={{ color: "var(--m-text-sub, #64748b)" }}
            >
              Decline
            </span>
          </button>

          <button
            type="button"
            onClick={onAccept}
            className="flex flex-col items-center gap-2 group cursor-pointer"
            title="Accept"
          >
            <div className="size-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition transform group-hover:scale-105 active:scale-95 animate-bounce cursor-pointer">
              {isVideo ? <Video size={24} /> : <Phone size={24} />}
            </div>
            <span
              className="text-xs font-bold transition"
              style={{ color: "var(--m-text-heading, #0f172a)" }}
            >
              Accept
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

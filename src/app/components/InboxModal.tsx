import React from "react";
import { X, Inbox } from "lucide-react";
import { SharedNote, Friendship } from "../../lib/supabase";

interface InboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingShares: SharedNote[];
  pendingFriendRequests: Friendship[];
  onAcceptFriendRequest: (req: Friendship) => void;
  onDeclineFriendRequest: (req: Friendship) => void;
  onAcceptShare: (share: SharedNote) => void;
  onDeclineShare: (share: SharedNote) => void;
}

export default function InboxModal({
  isOpen,
  onClose,
  pendingShares,
  pendingFriendRequests,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onAcceptShare,
  onDeclineShare,
}: InboxModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]" style={{ backgroundColor: "var(--m-surface)", color: "var(--m-text)" }}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-sm font-bold font-[Roboto_Slab] flex items-center gap-2">
            <Inbox size={18} />
            Inbox
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
            <X size={16} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
          {(pendingShares.length === 0 && pendingFriendRequests.length === 0) ? (
            <div className="py-8 text-center opacity-60">
              <p className="text-xs">Your inbox is empty.</p>
            </div>
          ) : (
            <>
              {/* Friend Requests Section */}
              {pendingFriendRequests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider opacity-60">Friend Requests</h4>
                  {pendingFriendRequests.map(req => (
                    <div key={req.id} className="p-4 rounded-2xl border flex items-center justify-between gap-3" style={{ borderColor: "var(--m-primary)", backgroundColor: "var(--m-surface-alt)" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-inner shrink-0" style={{ backgroundColor: "var(--m-bg)", color: "var(--m-text)", border: "1px solid var(--m-border)" }}>
                          {req.requester_identifier.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold">{req.requester_identifier}</p>
                          <p className="text-[10px] opacity-70">Wants to be friends</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button onClick={() => onAcceptFriendRequest(req)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>Accept</button>
                        <button onClick={() => onDeclineFriendRequest(req)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80 bg-black/5 dark:bg-white/10">Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes Section */}
              {pendingShares.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider opacity-60 mt-4">Shared Notes</h4>
                  {pendingShares.map(share => (
                    <div key={share.id} className="p-4 rounded-2xl border" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-surface-alt)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold mb-1">{share.note_title}</p>
                          <p className="text-[10px] opacity-70">From: <span className="font-bold">{share.sender_identifier}</span></p>
                          <p className="text-[10px] opacity-70 mt-1 line-clamp-1">{share.note_content}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--m-border-light)" }}>
                        <button onClick={() => onAcceptShare(share)} className="flex-1 rounded-lg py-1.5 text-[10px] font-bold transition hover:opacity-80" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                          Accept
                        </button>
                        <button onClick={() => onDeclineShare(share)} className="flex-1 rounded-lg py-1.5 text-[10px] font-bold transition hover:opacity-80 bg-black/5 dark:bg-white/10">
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

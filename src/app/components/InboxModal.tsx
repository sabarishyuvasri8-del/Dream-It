import React, { useState } from "react";
import { X, Inbox, Check, Loader2 } from "lucide-react";
import { SharedNote, Friendship } from "../../lib/supabase";

interface InboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingShares: SharedNote[];
  pendingFriendRequests: Friendship[];
  onAcceptFriendRequest: (req: Friendship) => void | Promise<any>;
  onDeclineFriendRequest: (req: Friendship) => void | Promise<any>;
  onAcceptShare: (share: SharedNote) => void | Promise<any>;
  onDeclineShare: (share: SharedNote) => void | Promise<any>;
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
  const [actionState, setActionState] = useState<Record<string, 'accepting' | 'accepted' | 'declining' | 'declined'>>({});

  if (!isOpen) return null;

  const handleAcceptReq = async (req: Friendship) => {
    setActionState(prev => ({ ...prev, [req.id]: 'accepting' }));
    try {
      await onAcceptFriendRequest(req);
      setActionState(prev => ({ ...prev, [req.id]: 'accepted' }));
    } catch {
      setActionState(prev => ({ ...prev, [req.id]: undefined as any }));
    }
  };

  const handleDeclineReq = async (req: Friendship) => {
    setActionState(prev => ({ ...prev, [req.id]: 'declining' }));
    try {
      await onDeclineFriendRequest(req);
      setActionState(prev => ({ ...prev, [req.id]: 'declined' }));
    } catch {
      setActionState(prev => ({ ...prev, [req.id]: undefined as any }));
    }
  };

  const handleAcceptNote = async (share: SharedNote) => {
    setActionState(prev => ({ ...prev, [share.id]: 'accepting' }));
    try {
      await onAcceptShare(share);
      setActionState(prev => ({ ...prev, [share.id]: 'accepted' }));
    } catch {
      setActionState(prev => ({ ...prev, [share.id]: undefined as any }));
    }
  };

  const handleDeclineNote = async (share: SharedNote) => {
    setActionState(prev => ({ ...prev, [share.id]: 'declining' }));
    try {
      await onDeclineShare(share);
      setActionState(prev => ({ ...prev, [share.id]: 'declined' }));
    } catch {
      setActionState(prev => ({ ...prev, [share.id]: undefined as any }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]" style={{ backgroundColor: "var(--m-surface)", color: "var(--m-text)" }}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-sm font-bold font-[Roboto_Slab] flex items-center gap-2">
            <Inbox size={18} />
            Inbox
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer">
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
                  {pendingFriendRequests.map(req => {
                    const status = actionState[req.id];
                    return (
                      <div key={req.id} className="p-4 rounded-2xl border flex items-center justify-between gap-3 transition" style={{ borderColor: status === 'accepted' ? '#10b981' : "var(--m-primary)", backgroundColor: "var(--m-surface-alt)" }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-inner shrink-0" style={{ backgroundColor: "var(--m-bg)", color: "var(--m-text)", border: "1px solid var(--m-border)" }}>
                            {req.requester_identifier.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="text-xs font-bold truncate">{req.requester_identifier}</p>
                            <p className="text-[10px] opacity-70">Wants to be friends</p>
                          </div>
                        </div>

                        {status === 'accepted' ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 shadow-xs shrink-0 animate-in fade-in">
                            <Check size={14} />
                            <span>Accepted</span>
                          </div>
                        ) : status === 'declined' ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-neutral-400 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 shrink-0 animate-in fade-in">
                            <span>Declined</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 shrink-0">
                            <button
                              onClick={() => handleAcceptReq(req)}
                              disabled={status === 'accepting' || status === 'declining'}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-1"
                              style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
                            >
                              {status === 'accepting' && <Loader2 size={11} className="animate-spin" />}
                              <span>{status === 'accepting' ? "Accepting..." : "Accept"}</span>
                            </button>
                            <button
                              onClick={() => handleDeclineReq(req)}
                              disabled={status === 'accepting' || status === 'declining'}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80 disabled:opacity-50 bg-black/5 dark:bg-white/10 cursor-pointer"
                            >
                              {status === 'declining' ? "Declining..." : "Decline"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notes Section */}
              {pendingShares.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider opacity-60 mt-4">Shared Notes</h4>
                  {pendingShares.map(share => {
                    const status = actionState[share.id];
                    return (
                      <div key={share.id} className="p-4 rounded-2xl border transition" style={{ borderColor: status === 'accepted' ? '#10b981' : "var(--m-border)", backgroundColor: "var(--m-surface-alt)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold mb-1">{share.note_title}</p>
                            <p className="text-[10px] opacity-70">From: <span className="font-bold">{share.sender_identifier}</span></p>
                            <p className="text-[10px] opacity-70 mt-1 line-clamp-1">{share.note_content}</p>
                          </div>
                        </div>

                        {status === 'accepted' ? (
                          <div className="mt-3 pt-3 border-t flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 py-1.5 rounded-xl border border-emerald-500/20 shadow-xs animate-in fade-in" style={{ borderColor: "var(--m-border-light)" }}>
                            <Check size={14} />
                            <span>Accepted</span>
                          </div>
                        ) : status === 'declined' ? (
                          <div className="mt-3 pt-3 border-t flex items-center justify-center text-xs font-bold text-neutral-400 py-1.5" style={{ borderColor: "var(--m-border-light)" }}>
                            <span>Declined</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--m-border-light)" }}>
                            <button
                              onClick={() => handleAcceptNote(share)}
                              disabled={status === 'accepting' || status === 'declining'}
                              className="flex-1 rounded-lg py-1.5 text-[10px] font-bold transition hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                              style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
                            >
                              {status === 'accepting' && <Loader2 size={11} className="animate-spin" />}
                              <span>{status === 'accepting' ? "Accepting..." : "Accept"}</span>
                            </button>
                            <button
                              onClick={() => handleDeclineNote(share)}
                              disabled={status === 'accepting' || status === 'declining'}
                              className="flex-1 rounded-lg py-1.5 text-[10px] font-bold transition hover:opacity-80 disabled:opacity-50 bg-black/5 dark:bg-white/10 cursor-pointer"
                            >
                              {status === 'declining' ? "Declining..." : "Decline"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

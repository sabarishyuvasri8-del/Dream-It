import React, { FormEvent, useState, useEffect } from "react";
import { X, Users, Trash2 } from "lucide-react";
import { Friendship, fetchUserProfiles, UserProfileData } from "../../lib/supabase";

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: Friendship[];
  userId: string;
  addFriendDraft: string;
  setAddFriendDraft: (val: string) => void;
  isAddingFriend: boolean;
  onSendFriendRequest: (e: FormEvent) => void;
  onDeleteFriend?: (friendshipId: string, friendName: string) => void | Promise<any>;
}

export default function FriendsModal({
  isOpen,
  onClose,
  friends,
  userId,
  addFriendDraft,
  setAddFriendDraft,
  isAddingFriend,
  onSendFriendRequest,
  onDeleteFriend,
}: FriendsModalProps) {
  const [profiles, setProfiles] = useState<Record<string, UserProfileData>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && friends.length > 0) {
      const friendIds = friends.map(f => f.requester_id === userId ? f.target_id : f.requester_id).filter(Boolean) as string[];
      fetchUserProfiles(friendIds).then(setProfiles);
    }
  }, [isOpen, friends, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]" style={{ backgroundColor: "var(--m-surface)", color: "var(--m-text)" }}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-sm font-bold font-[Roboto_Slab] flex items-center gap-2">
            <Users size={18} />
            Friends ({friends.length})
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer">
            <X size={16} />
          </button>
        </div>
        
        <form onSubmit={onSendFriendRequest} className="mb-6 flex gap-2 shrink-0">
          <input
            type="text"
            required
            value={addFriendDraft}
            onChange={(e) => setAddFriendDraft(e.target.value)}
            placeholder="Enter Username or Email..."
            className="flex-1 rounded-xl border px-3 py-2 text-xs focus:outline-none focus:ring-2 bg-transparent"
            style={{ borderColor: "var(--m-border-light)", color: "var(--m-text)" }}
          />
          <button
            type="submit"
            disabled={isAddingFriend || !addFriendDraft.trim()}
            className="rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
          >
            {isAddingFriend ? "Sending..." : "Add Friend"}
          </button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider opacity-60">Your Friends</h4>
          {friends.length === 0 ? (
            <div className="py-8 text-center opacity-60">
              <p className="text-xs">You haven't added any friends yet.</p>
            </div>
          ) : (
            friends.map(f => {
              const friendId = f.requester_id === userId ? f.target_id : f.requester_id;
              const friendProfile = friendId ? profiles[friendId] : null;
              
              const friendName = f.requester_id === userId 
                ? f.target_actual_identifier || f.target_identifier 
                : f.requester_identifier;
                
              return (
                <div key={f.id} className="p-3 rounded-2xl flex items-center justify-between gap-3 border transition hover:border-black/20 dark:hover:border-white/20" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-surface-alt)" }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {friendProfile?.image_url ? (
                      <img src={friendProfile.image_url} alt={friendName || ""} className="w-10 h-10 rounded-full object-cover shadow-inner shrink-0" style={{ border: "1px solid var(--m-border-light)" }} />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-inner shrink-0" style={{ backgroundColor: "var(--m-bg)", color: "var(--m-text)", border: "1px solid var(--m-border-light)" }}>
                        {friendName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{friendName}</p>
                      <p className="text-[10px] opacity-70">Mutual Friend</p>
                    </div>
                  </div>

                  {/* Delete / Remove Friend Option */}
                  {onDeleteFriend && (
                    confirmDeleteId === f.id ? (
                      <div className="flex items-center gap-1.5 shrink-0 animate-in fade-in duration-150">
                        <button
                          onClick={async () => {
                            setIsDeletingId(f.id);
                            await onDeleteFriend(f.id, friendName || "Friend");
                            setIsDeletingId(null);
                            setConfirmDeleteId(null);
                          }}
                          disabled={isDeletingId === f.id}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 transition shadow-xs cursor-pointer disabled:opacity-50"
                          title="Confirm remove friend"
                        >
                          {isDeletingId === f.id ? "Removing..." : "Remove"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isDeletingId === f.id}
                          className="p-1 rounded-lg text-[10px] font-medium opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(f.id)}
                        className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition shrink-0 cursor-pointer"
                        title={`Remove ${friendName} from friends`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

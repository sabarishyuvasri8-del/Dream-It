import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { X, Send, MessageCircle, Paperclip, Loader2, File, Download, MoreHorizontal, Trash2, EyeOff, Maximize2, Minimize2, ArrowLeft, UploadCloud } from "lucide-react";
import {
  Friendship,
  DirectMessage,
  fetchDirectMessages,
  sendDirectMessage,
  subscribeToDirectMessages,
  uploadChatFile,
  markMessagesAsRead,
  deleteDirectMessage,
  hideDirectMessage,
  fetchUserProfiles,
  UserProfileData,
  fetchFriendsConversationMeta,
  FriendConversationMeta
} from "../../lib/supabase";
import ChatMessageContent from "./ChatMessageContent";
import LinkPreviewCard from "./LinkPreviewCard";
import { extractUrls } from "../utils/linkPreview";
import { extractFilesFromClipboard } from "../utils/clipboardHelper";

function formatChatTime(isoString?: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diffHours < 48) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface ChatModalProps {
  userId: string;
  userNameDisplay: string;
  friends: Friendship[];
  onClose: () => void;
  onRefreshUnreadCount?: () => void;
}

export default function ChatModal({
  userId,
  userNameDisplay,
  friends,
  onClose,
  onRefreshUnreadCount,
}: ChatModalProps) {
  const [activeFriend, setActiveFriend] = useState<Friendship | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [dismissedDraftUrl, setDismissedDraftUrl] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, UserProfileData>>({});
  const [convoMeta, setConvoMeta] = useState<Record<string, FriendConversationMeta>>({});
  const [isWide, setIsWide] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [finderNotice, setFinderNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.size > 25 * 1024 * 1024) {
        alert("File size must be strictly under 25MB.");
        return;
      }
      setSelectedFile(file);
      setFinderNotice(null);
    }
  };

  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  
  const handleDeleteForEveryone = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setMenuOpenId(null);
    await deleteDirectMessage(msgId);
  };
  
  const handleDeleteForMe = async (msgId: string, isSender: boolean) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setMenuOpenId(null);
    await hideDirectMessage(msgId, isSender);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);

  // Instant or smooth scroll to bottom
  const scrollToBottom = (smooth = false) => {
    if (messagesContainerRef.current) {
      if (smooth) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      } else {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  };

  // Reset initial load flag when switching friends to force instant positioning at latest messages
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [activeFriend]);

  // Instantly position at recent chats before browser paint (eliminating top-to-bottom scroll animations)
  useLayoutEffect(() => {
    if (!messagesContainerRef.current) return;

    if (isInitialLoadRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      const raf = requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      });
      if (!loadingMessages && messages.length > 0) {
        isInitialLoadRef.current = false;
      }
      return () => cancelAnimationFrame(raf);
    } else {
      // Keep view pinned to bottom if user is already near bottom
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, activeFriend, loadingMessages]);

  useEffect(() => {
    if (friends.length > 0) {
      const friendIds = friends.map(f => f.requester_id === userId ? f.target_id : f.requester_id).filter(Boolean) as string[];
      fetchUserProfiles(friendIds).then(setProfiles);
    }
  }, [friends, userId]);

  // Load conversation metadata (latest message timestamp, unread counts)
  useEffect(() => {
    if (!userId) return;
    fetchFriendsConversationMeta(userId).then(setConvoMeta);

    const interval = setInterval(() => {
      fetchFriendsConversationMeta(userId).then(setConvoMeta);
    }, 4000);

    return () => clearInterval(interval);
  }, [userId, friends]);

  const getFriendName = React.useCallback((f: Friendship) => {
    return f.requester_id === userId
      ? f.target_actual_identifier || f.target_identifier
      : f.requester_identifier;
  }, [userId]);

  // Sort friends so that friends with the most recent messages appear at the very top
  const sortedFriends = React.useMemo(() => {
    return [...friends].sort((a, b) => {
      const friendIdA = a.requester_id === userId ? a.target_id : a.requester_id;
      const friendIdB = b.requester_id === userId ? b.target_id : b.requester_id;

      const timeA = friendIdA && convoMeta[friendIdA]?.lastMessageAt ? new Date(convoMeta[friendIdA].lastMessageAt!).getTime() : 0;
      const timeB = friendIdB && convoMeta[friendIdB]?.lastMessageAt ? new Date(convoMeta[friendIdB].lastMessageAt!).getTime() : 0;

      if (timeA !== timeB) {
        return timeB - timeA; // Newest conversation always jumps to the top
      }

      const nameA = getFriendName(a) || "";
      const nameB = getFriendName(b) || "";
      return nameA.localeCompare(nameB);
    });
  }, [friends, convoMeta, userId, getFriendName]);

  const handleSelectFriend = async (friend: Friendship) => {
    const friendId = friend.requester_id === userId ? friend.target_id : friend.requester_id;
    const currentFriendId = activeFriend
      ? activeFriend.requester_id === userId
        ? activeFriend.target_id
        : activeFriend.requester_id
      : null;

    if (friendId !== currentFriendId) {
      setMessages([]);
      setLoadingMessages(true);
      isInitialLoadRef.current = true;
    }

    setActiveFriend(friend);
    if (friendId) {
      // Clear unread count locally immediately for instant responsiveness
      setConvoMeta((prev) => {
        if (!prev[friendId] || prev[friendId].unreadCount === 0) return prev;
        return {
          ...prev,
          [friendId]: {
            ...prev[friendId],
            unreadCount: 0,
          },
        };
      });
      await markMessagesAsRead(userId, friendId);
      onRefreshUnreadCount?.();
    }
  };

  // Load messages when active friend changes
  useEffect(() => {
    if (!activeFriend) return;
    
    const friendId = activeFriend.requester_id === userId ? activeFriend.target_id : activeFriend.requester_id;
    if (!friendId) return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      const msgs = await fetchDirectMessages(userId, friendId);
      setMessages(msgs);
      setLoadingMessages(false);
      scrollToBottom(false);
      
      // Mark as read when we open the chat
      await markMessagesAsRead(userId, friendId);
      onRefreshUnreadCount?.();
    };
    
    loadMessages();
  }, [activeFriend, userId, onRefreshUnreadCount]);

  // Subscribe to real-time messages across ALL friends
  useEffect(() => {
    const unsubscribe = subscribeToDirectMessages(
      userId,
      (newMsg) => {
        const otherUserId = newMsg.sender_id === userId ? newMsg.receiver_id : newMsg.sender_id;
        if (!otherUserId) return;

        const currentActiveFriendId = activeFriend
          ? activeFriend.requester_id === userId
            ? activeFriend.target_id
            : activeFriend.requester_id
          : null;

        const isCurrentChatActive = currentActiveFriendId === otherUserId;
        const isIncoming = newMsg.sender_id === otherUserId && newMsg.receiver_id === userId;

        // 1. Update conversation metadata (this causes friend to reorder to top immediately & tracks unread counts)
        setConvoMeta((prev) => {
          const prevMeta = prev[otherUserId] || { lastMessageAt: null, lastMessageText: null, unreadCount: 0 };
          const shouldCountUnread = isIncoming && !isCurrentChatActive;

          return {
            ...prev,
            [otherUserId]: {
              lastMessageAt: newMsg.created_at,
              lastMessageText: newMsg.content || (newMsg.file_name ? `📎 ${newMsg.file_name}` : "Attachment"),
              unreadCount: shouldCountUnread ? (prevMeta.unreadCount || 0) + 1 : (isCurrentChatActive ? 0 : prevMeta.unreadCount || 0),
            },
          };
        });

        // 2. If it belongs to currently open chat, append to messages and mark as read
        if (isCurrentChatActive) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (isIncoming) {
            markMessagesAsRead(userId, otherUserId);
            onRefreshUnreadCount?.();
          }
        } else if (isIncoming) {
          onRefreshUnreadCount?.();
        }
      },
      (deletedMsgId) => {
        setMessages((prev) => prev.filter((m) => m.id !== deletedMsgId));
      },
      (hiddenMsg) => {
        // Check if it's hidden for the current user
        if (hiddenMsg.sender_id === userId && hiddenMsg.deleted_by_sender) {
          setMessages((prev) => prev.filter((m) => m.id !== hiddenMsg.id));
        }
        if (hiddenMsg.receiver_id === userId && hiddenMsg.deleted_by_receiver) {
          setMessages((prev) => prev.filter((m) => m.id !== hiddenMsg.id));
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId, activeFriend, onRefreshUnreadCount]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!draft.trim() && !selectedFile) || !activeFriend || isUploading) return;
    
    const friendId = activeFriend.requester_id === userId ? activeFriend.target_id : activeFriend.requester_id;
    if (!friendId) return;

    const content = draft.trim();
    
    // Process File if exists
    let fileMeta = undefined;
    if (selectedFile) {
      setIsUploading(true);
      try {
        fileMeta = await uploadChatFile(userId, selectedFile);
      } catch (err: any) {
        alert(err.message || "Failed to upload file");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    setDraft(""); // Optimistic clear
    setDismissedDraftUrl(null);
    setSelectedFile(null);

    const newMsg = await sendDirectMessage(userId, friendId, content, fileMeta);
    if (newMsg) {
      setMessages((prev) => {
        if (prev.find((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // Move this friend to the top with latest snippet
      setConvoMeta((prev) => ({
        ...prev,
        [friendId]: {
          lastMessageAt: newMsg.created_at,
          lastMessageText: newMsg.content || (newMsg.file_name ? `📎 ${newMsg.file_name}` : "Attachment"),
          unreadCount: 0,
        },
      }));
      scrollToBottom();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert("File size must be strictly under 25MB.");
      return;
    }
    setSelectedFile(file);
    e.target.value = ''; // reset
  };

  // ─── Clipboard Paste Handler (Ctrl+V / Cmd+V for images & files) ───
  const processPaste = async (e: React.ClipboardEvent | ClipboardEvent) => {
    try {
      const result = await extractFilesFromClipboard(e);
      if (result.files.length > 0) {
        e.preventDefault();
        const fileToAttach = result.files.find((f) => f.type.startsWith("image/")) || result.files[0];
        if (fileToAttach.size > 25 * 1024 * 1024) {
          alert("File size must be strictly under 25MB.");
          return;
        }
        setSelectedFile(fileToAttach);
        setFinderNotice(null);
      } else if (result.isLocalFinderFile) {
        e.preventDefault();
        setFinderNotice(result.localFileName || "file");
      }
    } catch (err) {
      console.warn("[ChatModal] Paste extraction error:", err);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    processPaste(e);
  };

  // Global window paste listener: paste images/files from anywhere while chatting
  useEffect(() => {
    if (!activeFriend) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      // Do not intercept if user is typing in another input (e.g. friend search)
      if (target && target.tagName === "INPUT" && target !== chatInputRef.current) {
        return;
      }
      if (target && target.tagName === "TEXTAREA") {
        return;
      }
      processPaste(e);
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [activeFriend]);

  const selectedFilePreviewUrl = React.useMemo(() => {
    if (selectedFile && selectedFile.type.startsWith("image/")) {
      return URL.createObjectURL(selectedFile);
    }
    return null;
  }, [selectedFile]);

  React.useEffect(() => {
    return () => {
      if (selectedFilePreviewUrl) {
        URL.revokeObjectURL(selectedFilePreviewUrl);
      }
    };
  }, [selectedFilePreviewUrl]);

  const activeFriendName = activeFriend ? getFriendName(activeFriend) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-4 sm:p-6">
      <div 
        className={`w-full h-full md:h-[85vh] rounded-none md:rounded-3xl shadow-2xl flex overflow-hidden transition-all duration-300 ${isWide ? 'max-w-full md:max-w-[95vw]' : 'max-w-4xl'}`} 
        style={{ backgroundColor: "var(--m-surface)", color: "var(--m-text)", border: "1px solid var(--m-border)" }}
      >
        {/* Left Sidebar: Friends List */}
        <div className={`w-full md:w-80 flex-col border-r-0 md:border-r ${activeFriend ? 'hidden md:flex' : 'flex'}`} style={{ borderColor: "var(--m-border)" }}>
          <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: "var(--m-border)" }}>
            <h3 className="font-bold font-[Roboto_Slab] text-lg truncate flex-1">{userNameDisplay}</h3>
            <button onClick={onClose} className="md:hidden p-2 -mr-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0 ml-2">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider opacity-60 px-2 mb-3">Messages</h4>
            
            {sortedFriends.length === 0 ? (
              <p className="text-xs opacity-60 px-2 text-center mt-6">No friends yet. Add some from the Dashboard!</p>
            ) : (
              sortedFriends.map(f => {
                const friendId = f.requester_id === userId ? f.target_id : f.requester_id;
                const friendProfile = friendId ? profiles[friendId] : null;
                const friendName = getFriendName(f);
                const isActive = activeFriend?.id === f.id;
                const meta = friendId ? convoMeta[friendId] : null;
                const unreadCount = meta?.unreadCount || 0;
              
                return (
                  <button
                    key={f.id}
                    onClick={() => handleSelectFriend(f)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all relative text-left group ${
                      isActive ? "shadow-md" : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    style={{
                      backgroundColor: isActive ? "var(--m-surface-alt)" : "transparent",
                    }}
                  >
                    <div className="relative shrink-0">
                      {friendProfile?.image_url ? (
                        <img src={friendProfile.image_url} alt={friendName || ""} className="size-11 rounded-full object-cover shadow-inner shrink-0" style={{ border: "1px solid var(--m-border-light)" }} />
                      ) : (
                        <div className="size-11 rounded-full flex items-center justify-center text-lg font-bold shadow-inner shrink-0" 
                          style={{ backgroundColor: "var(--m-bg)", color: "var(--m-text)", border: "1px solid var(--m-border-light)" }}>
                          {friendName?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {unreadCount > 0 && !isActive && (
                        <span 
                          className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2" 
                          style={{ backgroundColor: "var(--m-primary)", borderColor: "var(--m-surface)" }} 
                        />
                      )}
                    </div>

                    <div className="text-left flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-sm truncate ${unreadCount > 0 ? "font-black" : "font-bold"}`} style={{ color: "var(--m-text)" }}>
                          {friendName}
                        </p>
                        {unreadCount === 0 && meta?.lastMessageAt && (
                          <span className="text-[10px] font-mono shrink-0 opacity-50">
                            {formatChatTime(meta.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        {unreadCount > 0 ? (
                          <p 
                            className="text-xs font-bold truncate flex items-center gap-1.5"
                            style={{ color: "#3b82f6" }}
                          >
                            <span>{unreadCount} {unreadCount === 1 ? "new message" : "new messages"}</span>
                            {meta?.lastMessageAt && (
                              <span className="opacity-80 font-normal text-[11px]">· {formatChatTime(meta.lastMessageAt)}</span>
                            )}
                          </p>
                        ) : (
                          <p 
                            className="text-xs truncate opacity-60"
                            style={{ color: "var(--m-text)" }}
                          >
                            {meta?.lastMessageText || "No messages yet"}
                          </p>
                        )}

                        {unreadCount > 0 && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className="min-w-[19px] h-4 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center shadow-xs"
                              style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
                              title={`${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`}
                            >
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                            <span 
                              className="size-2 rounded-full shadow-sm animate-pulse"
                              style={{ backgroundColor: "#3b82f6", boxShadow: "0 0 8px #3b82f6" }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Area: Chat History */}
        <div
          onPaste={handlePaste}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 flex-col relative w-full md:w-auto min-w-0 ${!activeFriend ? 'hidden md:flex' : 'flex'}`}
          style={{ backgroundColor: "var(--m-bg)" }}
        >
          {isDragging && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center bg-black/80 backdrop-blur-md border-4 border-dashed border-indigo-500 rounded-none animate-in fade-in duration-150 pointer-events-none">
              <UploadCloud size={36} className="text-indigo-400 mb-2 animate-bounce" />
              <h4 className="text-base font-bold text-white">Drop file to attach</h4>
              <p className="text-xs text-indigo-200 mt-1">Supports images, PDFs, notes, and documents</p>
            </div>
          )}
          {/* Header */}
          <div className="flex flex-col min-w-0" style={{ backgroundColor: "var(--m-surface)" }}>
            <div className="p-4 flex items-center justify-between border-b shrink-0" style={{ borderColor: "var(--m-border)" }}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button 
                  onClick={() => setActiveFriend(null)}
                  className="md:hidden p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
                >
                  <ArrowLeft size={20} />
                </button>
                {activeFriend ? (
                  <>
                    {(() => {
                      const friendId = activeFriend.requester_id === userId ? activeFriend.target_id : activeFriend.requester_id;
                      const friendProfile = friendId ? profiles[friendId] : null;
                      return friendProfile?.image_url ? (
                        <img src={friendProfile.image_url} alt={activeFriendName} className="size-10 rounded-full object-cover shadow-sm shrink-0" style={{ border: "1px solid var(--m-border-light)" }} />
                      ) : (
                        <div className="size-10 rounded-full flex items-center justify-center text-lg font-bold shadow-sm shrink-0" style={{ backgroundColor: "var(--m-bg)", border: "1px solid var(--m-border-light)" }}>
                          {activeFriendName.charAt(0).toUpperCase()}
                        </div>
                      );
                    })()}
                    <h3 className="font-bold font-[Roboto_Slab] text-base truncate">{activeFriendName}</h3>
                  </>
                ) : (
                  <h3 className="font-bold font-[Roboto_Slab] text-base opacity-60 truncate">Select a chat</h3>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button onClick={() => setIsWide(!isWide)} className="hidden md:block p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition text-inherit opacity-70 hover:opacity-100">
                  {isWide ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button onClick={onClose} className="p-2 -mr-2 md:mr-0 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition text-inherit opacity-70 hover:opacity-100 shrink-0">
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4 min-h-0 relative"
          >
            <div className="text-center w-full py-1">
              <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">
                Chats are securely auto-deleted every 24 hours.
              </span>
            </div>
            {!activeFriend ? (
              <div className="h-full flex flex-col items-center justify-center opacity-50 gap-4">
                <MessageCircle size={48} strokeWidth={1.5} />
                <p className="text-sm font-bold">Your Messages</p>
                <p className="text-xs">Send a direct message to a friend.</p>
              </div>
            ) : loadingMessages ? (
              <div className="h-full flex items-center justify-center opacity-60">
                <p className="text-xs font-bold animate-pulse">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-50 gap-2">
                <p className="text-xs font-bold">No messages yet.</p>
                <p className="text-[10px]">Send a message to start the conversation!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === userId;
                const isHovered = hoveredMessageId === msg.id;
                const isMenuOpen = menuOpenId === msg.id;
                
                return (
                  <div 
                    key={msg.id} 
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                  >
                    <div className="relative flex items-center max-w-[70%]">
                      {isMe && (
                        <div className={`absolute right-full mr-2 transition-opacity duration-200 ${(isHovered || isMenuOpen) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                          <button 
                            onClick={() => setMenuOpenId(isMenuOpen ? null : msg.id)}
                            className="p-1.5 rounded-full hover:bg-black/10 transition opacity-50 hover:opacity-100"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {isMenuOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-40 cursor-default" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(null);
                                }} 
                              />
                              <div className="absolute right-0 top-full mt-1 z-50 rounded-xl shadow-lg border p-1 w-40 overflow-hidden" 
                                   style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}>
                                <button onClick={() => handleDeleteForEveryone(msg.id)} className="w-full flex items-center gap-2 p-2 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-lg transition">
                                  <Trash2 size={12} /> Delete for everyone
                                </button>
                                <button onClick={() => handleDeleteForMe(msg.id, isMe)} className="w-full flex items-center gap-2 p-2 text-xs font-bold hover:bg-black/5 rounded-lg transition" style={{ color: "var(--m-text)" }}>
                                  <EyeOff size={12} /> Delete for me
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      
                      <div 
                        className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm flex flex-col gap-2 w-max max-w-full break-words whitespace-pre-wrap ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                        style={{ 
                          backgroundColor: isMe ? "var(--m-primary)" : "var(--m-surface-solid)", 
                          color: isMe ? "var(--m-primary-text)" : "var(--m-text)",
                          border: isMe ? "none" : "1px solid var(--m-border)"
                        }}
                      >
                        {msg.file_url && (
                          msg.file_type?.startsWith('image/') ? (
                            <a href={msg.file_url} target="_blank" rel="noreferrer">
                              <img 
                                src={msg.file_url} 
                                alt="Attachment" 
                                className="max-w-full rounded-xl object-contain max-h-64 cursor-pointer"
                                onLoad={() => {
                                  if (isInitialLoadRef.current && messagesContainerRef.current) {
                                    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                                  }
                                }} 
                              />
                            </a>
                          ) : (
                            <a 
                              href={msg.file_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center gap-2 p-2 rounded-lg transition hover:opacity-80"
                              style={{ backgroundColor: "black", color: "white" }}
                            >
                              <File size={16} />
                              <span className="text-xs font-bold truncate flex-1">{msg.file_name}</span>
                              <Download size={14} />
                            </a>
                          )
                        )}
                        {msg.content && (
                          <ChatMessageContent
                            content={msg.content}
                            isMe={isMe}
                            createdAt={msg.created_at}
                          />
                        )}
                      </div>
                      
                      {!isMe && (
                        <div className={`absolute left-full ml-2 transition-opacity duration-200 ${(isHovered || isMenuOpen) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                          <button 
                            onClick={() => setMenuOpenId(isMenuOpen ? null : msg.id)}
                            className="p-1.5 rounded-full hover:bg-black/10 transition opacity-50 hover:opacity-100"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {isMenuOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-40 cursor-default" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(null);
                                }} 
                              />
                              <div className="absolute left-0 top-full mt-1 z-50 rounded-xl shadow-lg border p-1 w-32 overflow-hidden" 
                                   style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)" }}>
                                <button onClick={() => handleDeleteForMe(msg.id, isMe)} className="w-full flex items-center gap-2 p-2 text-xs font-bold hover:bg-black/5 rounded-lg transition" style={{ color: "var(--m-text)" }}>
                                  <EyeOff size={12} /> Delete for me
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {activeFriend && (
            <div className="p-3 sm:p-4 bg-inherit border-t flex flex-col gap-2 w-full" style={{ borderColor: "var(--m-border)" }}>
              {selectedFile && (
                <div className="flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold w-full border animate-in fade-in zoom-in-95 duration-200" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)", borderColor: "var(--m-border)" }}>
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {selectedFilePreviewUrl ? (
                      <img 
                        src={selectedFilePreviewUrl} 
                        alt="Preview" 
                        className="size-11 rounded-xl object-cover border shrink-0 shadow-xs" 
                        style={{ borderColor: "var(--m-border)" }}
                      />
                    ) : (
                      <div className="size-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                        <File size={18} />
                      </div>
                    )}
                    <div className="flex flex-col truncate">
                      <span className="truncate text-xs font-bold">{selectedFile.name}</span>
                      <span className="text-[10px] opacity-60">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type.startsWith("image/") ? "Image ready to send" : "Document ready to send"}
                      </span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedFile(null)} className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition shrink-0" title="Remove attachment">
                    <X size={16} />
                  </button>
                </div>
              )}
              
              {(() => {
                const draftUrls = extractUrls(draft);
                const activeDraftUrl = draftUrls[0] && draftUrls[0] !== dismissedDraftUrl ? draftUrls[0] : null;
                return activeDraftUrl ? (
                  <div className="w-full max-w-sm mb-1">
                    <div className="text-[10px] font-bold opacity-60 mb-1 flex items-center justify-between tracking-wide uppercase">
                      <span>Link Preview</span>
                    </div>
                    <LinkPreviewCard
                      url={activeDraftUrl}
                      compact={true}
                      onDismiss={() => setDismissedDraftUrl(activeDraftUrl)}
                    />
                  </div>
                ) : null;
              })()}
              
              {finderNotice && (
                <div className="flex items-center justify-between gap-2 p-2.5 mb-2 rounded-2xl text-xs border border-amber-500/30 bg-amber-500/10 text-amber-300 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 truncate">
                    <span className="shrink-0 text-base">⚠️</span>
                    <span className="truncate">
                      Finder file <strong>"{finderNotice}"</strong> detected. macOS blocks direct clipboard file pasting.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFinderNotice(null);
                        fileInputRef.current?.click();
                      }}
                      className="px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-[11px] transition shadow-xs"
                    >
                      Browse File
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinderNotice(null)}
                      className="p-1 rounded-lg hover:bg-white/10 opacity-70 hover:opacity-100 transition"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSend} onPaste={handlePaste} className="flex gap-2 w-full min-w-0">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileSelect} 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-full transition hover:opacity-80 shadow-sm shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: "var(--m-surface-solid)", border: "1px solid var(--m-border)", color: "var(--m-text)" }}
                  title="Attach File (Max 25MB)"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  ref={chatInputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={selectedFile ? "Add a message or press Send..." : "Message or paste image/file (Ctrl+V / Cmd+V)..."}
                  className="flex-1 min-w-0 rounded-full px-4 sm:px-5 py-3 text-sm focus:outline-none focus:ring-2 bg-transparent border"
                  style={{ borderColor: "var(--m-border)", color: "var(--m-text)" }}
                />
                <button
                  type="submit"
                  disabled={(!draft.trim() && !selectedFile) || isUploading}
                  className="rounded-full px-4 sm:px-5 py-3 text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 shrink-0 min-w-[70px] sm:min-w-[80px]"
                  style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : "Send"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

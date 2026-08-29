import React, { useState, useEffect, useRef } from "react";
import { X, Send, MessageCircle, Paperclip, Loader2, File, Download, MoreHorizontal, Trash2, EyeOff, Maximize2, Minimize2, ArrowLeft } from "lucide-react";
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
  UserProfileData
} from "../../lib/supabase";

interface ChatModalProps {
  userId: string;
  userNameDisplay: string;
  friends: Friendship[];
  onClose: () => void;
}

export default function ChatModal({
  userId,
  userNameDisplay,
  friends,
  onClose,
}: ChatModalProps) {
  const [activeFriend, setActiveFriend] = useState<Friendship | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, UserProfileData>>({});
  const [isWide, setIsWide] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (friends.length > 0) {
      const friendIds = friends.map(f => f.requester_id === userId ? f.target_id : f.requester_id).filter(Boolean) as string[];
      fetchUserProfiles(friendIds).then(setProfiles);
    }
  }, [friends, userId]);

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
      scrollToBottom();
      
      // Mark as read when we open the chat
      await markMessagesAsRead(userId, friendId);
    };
    
    loadMessages();
  }, [activeFriend, userId]);

  // Subscribe to real-time messages
  useEffect(() => {
    const unsubscribe = subscribeToDirectMessages(userId, 
      (newMsg) => {
        // Check if this message belongs to the current active chat
        if (!activeFriend) return;
        
        const friendId = activeFriend.requester_id === userId ? activeFriend.target_id : activeFriend.requester_id;
        
        if (
          (newMsg.sender_id === userId && newMsg.receiver_id === friendId) ||
          (newMsg.sender_id === friendId && newMsg.receiver_id === userId)
        ) {
          setMessages((prev) => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          
          // If we received a message from them while chatting, mark it as read immediately
          if (newMsg.sender_id === friendId && newMsg.receiver_id === userId) {
            markMessagesAsRead(userId, friendId);
          }
        }
      },
      (deletedMsgId) => {
        setMessages(prev => prev.filter(m => m.id !== deletedMsgId));
      },
      (hiddenMsg) => {
        // Check if it's hidden for the current user
        if (hiddenMsg.sender_id === userId && hiddenMsg.deleted_by_sender) {
          setMessages(prev => prev.filter(m => m.id !== hiddenMsg.id));
        }
        if (hiddenMsg.receiver_id === userId && hiddenMsg.deleted_by_receiver) {
          setMessages(prev => prev.filter(m => m.id !== hiddenMsg.id));
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId, activeFriend]);

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
    setSelectedFile(null);

    const newMsg = await sendDirectMessage(userId, friendId, content, fileMeta);
    if (newMsg) {
      setMessages((prev) => {
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
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

  const getFriendName = (f: Friendship) => {
    return f.requester_id === userId
      ? f.target_actual_identifier || f.target_identifier
      : f.requester_identifier;
  };

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
            
            {friends.length === 0 ? (
              <p className="text-xs opacity-60 px-2 text-center mt-6">No friends yet. Add some from the Dashboard!</p>
            ) : (
              friends.map(f => {
                const friendId = f.requester_id === userId ? f.target_id : f.requester_id;
                const friendProfile = friendId ? profiles[friendId] : null;
                const friendName = getFriendName(f);
                const isActive = activeFriend?.id === f.id;
              
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFriend(f)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                      isActive ? "shadow-md" : "hover:bg-black/5"
                    }`}
                    style={{
                      backgroundColor: isActive ? "var(--m-surface-alt)" : "transparent",
                    }}
                  >
                    {friendProfile?.image_url ? (
                      <img src={friendProfile.image_url} alt={friendName || ""} className="size-10 rounded-full object-cover shadow-inner shrink-0" style={{ border: "1px solid var(--m-border-light)" }} />
                    ) : (
                      <div className="size-10 rounded-full flex items-center justify-center text-lg font-bold shadow-inner shrink-0" 
                        style={{ backgroundColor: "var(--m-bg)", color: "var(--m-text)", border: "1px solid var(--m-border-light)" }}>
                        {friendName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="text-left flex-1 overflow-hidden">
                      <p className="text-sm font-bold truncate">{friendName}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Area: Chat History */}
        <div className={`flex-1 flex-col relative w-full md:w-auto min-w-0 ${!activeFriend ? 'hidden md:flex' : 'flex'}`} style={{ backgroundColor: "var(--m-bg)" }}>
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
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4 min-h-0 relative">
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
                        className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm flex flex-col gap-2 max-w-[90%] md:max-w-[85%] w-fit break-words whitespace-pre-wrap ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                        style={{ 
                          backgroundColor: isMe ? "var(--m-primary)" : "var(--m-surface-solid)", 
                          color: isMe ? "var(--m-primary-text)" : "var(--m-text)",
                          border: isMe ? "none" : "1px solid var(--m-border)"
                        }}
                      >
                        {msg.file_url && (
                          msg.file_type?.startsWith('image/') ? (
                            <a href={msg.file_url} target="_blank" rel="noreferrer">
                              <img src={msg.file_url} alt="Attachment" className="max-w-full rounded-xl object-contain max-h-64 cursor-pointer" />
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
                        {msg.content && <span>{msg.content}</span>}
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
                <div className="flex items-center justify-between p-2 rounded-xl text-xs font-bold w-full" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)" }}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <File size={14} />
                    <span className="truncate">{selectedFile.name}</span>
                    <span className="opacity-50">({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)</span>
                  </div>
                  <button onClick={() => setSelectedFile(null)} className="p-1 rounded-full hover:bg-black/10 transition">
                    <X size={14} />
                  </button>
                </div>
              )}
              
              <form onSubmit={handleSend} className="flex gap-2 w-full min-w-0">
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
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message..."
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

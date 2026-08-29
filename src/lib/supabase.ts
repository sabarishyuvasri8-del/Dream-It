import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import type { FinanceData } from "./finance-types";

export const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);

/* ─────────────── Data Types ─────────────── */

export interface Task {
  id: number;
  title: string;
  course: string;
  time: string;
  done: boolean;
  color: string;
  priority?: "low" | "medium" | "high";
  createdAt?: string;
  deadline?: string; // ISO date string for deadline countdown
  createdBy?: "user" | "agent";
  agentRunId?: string;
}

export interface ScheduleItem {
  id?: number;
  time: string;
  title: string;
  note: string;
  tone: string;
  course?: string;
  done?: boolean;
  createdBy?: "user" | "agent";
  agentRunId?: string;
}

export interface Subject {
  id: number;
  name: string;
  color: string;
  accent: string;
  description?: string;
}

export interface NoteEntry {
  id: string;
  subjectId: number;
  title: string;
  content: string; // markdown text
  createdAt: string;
  updatedAt: string;
}

export interface GradeEntry {
  id: string;
  subjectId: number;
  assignmentName: string;
  score: number;
  total: number;
  weight: number; // percentage weight (0-100)
  createdAt: string;
}

export interface Flashcard {
  id: string;
  subjectId: number;
  front: string;
  back: string;
  difficulty: "easy" | "medium" | "hard";
  lastReviewed?: string;
  nextReview?: string;
  reviewCount: number;
  createdAt: string;
}

export interface FocusLogEntry {
  date: string;
  minutes: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  totalXP: number;
  level: number;
  tasksCompleted: number;
  focusSessionsCompleted: number;
  flashcardsStudied: number;
}

export interface SharedNote {
  id: string;
  sender_id: string;
  sender_identifier: string;
  recipient_identifier: string;
  note_title: string;
  note_content: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  requester_identifier: string;
  target_identifier: string;
  target_id: string | null;
  target_actual_identifier: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  is_read?: boolean;
  deleted_by_sender?: boolean;
  deleted_by_receiver?: boolean;
}

export interface UserWorkspace {
  tasks: Task[];
  scheduleItems: ScheduleItem[];
  subjects: Subject[];
  studyMinutes: number[];
  focusLog?: FocusLogEntry[];
  notes?: NoteEntry[];
  grades?: GradeEntry[];
  flashcards?: Flashcard[];
  streak?: StreakData;
  finance?: FinanceData;
}

export interface AttachedFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  subjectId: number;
  taskId?: number;
  storagePath: string;
  createdAt: string;
}

/** Create a clean empty workspace for new users */
export function createEmptyWorkspace(): UserWorkspace {
  return {
    tasks: [],
    scheduleItems: [],
    subjects: [],
    studyMinutes: Array(7).fill(0),
    focusLog: [],
    notes: [],
    grades: [],
    flashcards: [],
    streak: {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: "",
      totalXP: 0,
      level: 1,
      tasksCompleted: 0,
      focusSessionsCompleted: 0,
      flashcardsStudied: 0,
    },
    finance: undefined,
  };
}

/* ─────────────── Workspace CRUD (Strict User Isolation) ─────────────── */

/** Fetch workspace strictly isolated by Clerk userId from Supabase & LocalStorage */
export async function fetchUserWorkspace(accessToken: string, userId: string): Promise<UserWorkspace | null> {
  if (!userId) return null;
  const cacheKey = `dreamit_workspace_${userId}`;

  // 1. Try Supabase Database table 'workspaces' by user_id
  try {
    const { data: dbData } = await supabase
      .from("workspaces")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (dbData && dbData.data && typeof dbData.data === "object") {
      localStorage.setItem(cacheKey, JSON.stringify(dbData.data));
      return dbData.data as UserWorkspace;
    }
  } catch (e) {
    console.warn("Supabase database workspace fetch failed:", e);
  }

  // 2. Fallback: Local Storage cached strictly for this specific user ID
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Ignore parse error
    }
  }

  // Brand new user account — return null so a fresh empty workspace is created
  return null;
}

/** Save workspace strictly isolated by Clerk userId to Supabase & LocalStorage */
export async function saveUserWorkspace(accessToken: string, userId: string, workspaceData: UserWorkspace): Promise<boolean> {
  if (!userId) return false;
  const cacheKey = `dreamit_workspace_${userId}`;
  
  // Save locally strictly under userId
  localStorage.setItem(cacheKey, JSON.stringify(workspaceData));

  let savedRemote = false;

  // Save to Supabase Database table 'workspaces' per user_id
  try {
    const { error } = await supabase
      .from("workspaces")
      .upsert({ user_id: userId, data: workspaceData, updated_at: new Date().toISOString() });
    if (!error) {
      savedRemote = true;
    }
  } catch (e) {
    console.warn("Supabase database workspace save failed:", e);
  }

  return savedRemote;
}

/** Delete workspace data for a user (account cleanup) */
export async function deleteUserWorkspace(userId: string): Promise<void> {
  const cacheKey = `dreamit_workspace_${userId}`;
  localStorage.removeItem(cacheKey);
  localStorage.removeItem(`dreamit_files_${userId}`);
}

/* ─────────────── File Attachments (Strict User Isolation) ─────────────── */

/** Fetch user's file attachments strictly by userId */
export async function fetchUserFiles(accessToken: string, userId: string): Promise<AttachedFile[]> {
  if (!userId) return [];
  const cacheKey = `dreamit_files_${userId}`;

  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Ignore parse error
    }
  }

  return [];
}

/** Upload file attachment to user's Supabase Storage folder strictly by userId */
export async function uploadAttachedFile(
  accessToken: string,
  userId: string,
  file: File,
  subjectId: number,
  taskId?: number,
  kind?: string
): Promise<AttachedFile> {
  if (!userId) throw new Error("User authentication required");
  const cacheKey = `dreamit_files_${userId}`;

  // Enforce Max 20MB
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("File size exceeds the 20MB limit.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("subjectId", subjectId.toString());
  if (taskId !== undefined) formData.append("taskId", taskId.toString());
  if (kind) formData.append("kind", kind);

  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-d53fe46f/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  const meta: AttachedFile = data.file;

  const existing = await fetchUserFiles(accessToken, userId);
  const updated = [...existing, meta];
  localStorage.setItem(cacheKey, JSON.stringify(updated));
  return meta;
}

/** Get short-lived signed download URL for file */
export async function getFileDownloadUrl(
  accessToken: string,
  userId: string,
  fileId: string,
  storagePath: string
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(storagePath, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {}

  const { data: pub } = supabase.storage.from("attachments").getPublicUrl(storagePath);
  return pub.publicUrl;
}

/** Delete attached file */
export async function deleteAttachedFile(
  accessToken: string,
  userId: string,
  fileId: string,
  storagePath: string
): Promise<boolean> {
  if (!userId) return false;
  const cacheKey = `dreamit_files_${userId}`;

  try {
    await supabase.storage.from("attachments").remove([storagePath]);
  } catch {}

  const existing = await fetchUserFiles(accessToken, userId);
  const updated = existing.filter((f) => f.id !== fileId);
  localStorage.setItem(cacheKey, JSON.stringify(updated));
  return true;
}

/* ─────────────── XP & Level Helpers ─────────────── */

export function calculateLevel(xp: number): number {
  if (xp < 100) return 1;
  if (xp < 250) return 2;
  if (xp < 500) return 3;
  if (xp < 1000) return 4;
  if (xp < 2000) return 5;
  if (xp < 4000) return 6;
  if (xp < 7000) return 7;
  if (xp < 11000) return 8;
  if (xp < 16000) return 9;
  return 10;
}

export function getLevelTitle(level: number): string {
  const titles = [
    "Beginner",      // 1
    "Learner",       // 2
    "Focused",       // 3
    "Dedicated",     // 4
    "Scholar",       // 5
    "Expert",        // 6
    "Master",        // 7
    "Grandmaster",   // 8
    "Legend",        // 9
    "Enlightened",   // 10
  ];
  return titles[Math.min(level - 1, titles.length - 1)] || "Beginner";
}

export function getXPForNextLevel(level: number): number {
  const thresholds = [100, 250, 500, 1000, 2000, 4000, 7000, 11000, 16000, 99999];
  return thresholds[Math.min(level - 1, thresholds.length - 1)] || 99999;
}

/* ─────────────── Notes Sharing ─────────────── */

/** Share a note with another user by their Username or Email */
export async function shareNote(
  senderId: string,
  senderIdentifier: string,
  recipientIdentifier: string,
  noteTitle: string,
  noteContent: string
): Promise<boolean> {
  if (!senderId || !recipientIdentifier) return false;
  try {
    const { error } = await supabase.from('shared_notes').insert({
      sender_id: senderId,
      sender_identifier: senderIdentifier,
      recipient_identifier: recipientIdentifier.trim(),
      note_title: noteTitle,
      note_content: noteContent,
      status: 'pending',
    });
    if (error) {
      console.error("Error sharing note:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Exception sharing note:", err);
    return false;
  }
}

/** Fetch pending shared notes for a given username and email */
export async function fetchPendingShares(
  username?: string | null,
  email?: string | null
): Promise<SharedNote[]> {
  const identifiers = [];
  if (username) identifiers.push(username);
  if (email) identifiers.push(email);

  if (identifiers.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('shared_notes')
      .select('*')
      .in('recipient_identifier', identifiers)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching shared notes:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Exception fetching shared notes:", err);
    return [];
  }
}

/** Accept or reject a shared note */
export async function respondToShare(
  shareId: string,
  response: 'accepted' | 'rejected'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('shared_notes')
      .update({ status: response })
      .eq('id', shareId);
      
    if (error) {
      console.error(`Error updating shared note to ${response}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Exception updating shared note to ${response}:`, err);
    return false;
  }
}

/* ─────────────── Friends System ─────────────── */

export async function sendFriendRequest(
  requesterId: string,
  requesterIdentifier: string,
  targetIdentifier: string
): Promise<boolean> {
  if (!requesterId || !targetIdentifier) return false;
  try {
    const { error } = await supabase.from('friendships').insert({
      requester_id: requesterId,
      requester_identifier: requesterIdentifier,
      target_identifier: targetIdentifier.trim(),
      status: 'pending',
    });
    if (error) {
      console.error("Error sending friend request:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Exception sending friend request:", err);
    return false;
  }
}

export async function fetchPendingFriendRequests(
  username?: string | null,
  email?: string | null
): Promise<Friendship[]> {
  const identifiers = [];
  if (username) identifiers.push(username);
  if (email) identifiers.push(email);
  if (identifiers.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .in('target_identifier', identifiers)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching friend requests:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Exception fetching friend requests:", err);
    return [];
  }
}

export async function respondToFriendRequest(
  friendshipId: string,
  response: 'accepted' | 'rejected',
  targetId: string,
  targetIdentifier: string
): Promise<boolean> {
  try {
    const updateData: any = { status: response };
    if (response === 'accepted') {
      updateData.target_id = targetId;
      updateData.target_actual_identifier = targetIdentifier;
    }
    const { error } = await supabase
      .from('friendships')
      .update(updateData)
      .eq('id', friendshipId);
      
    if (error) {
      console.error(`Error updating friendship to ${response}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Exception updating friendship to ${response}:`, err);
    return false;
  }
}

export async function fetchFriends(userId: string): Promise<Friendship[]> {
  try {
    // A friend is someone where you are the requester OR you are the target, and status is accepted.
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},target_id.eq.${userId}`);

    if (error) {
      console.error("Error fetching friends:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Exception fetching friends:", err);
    return [];
  }
}


/* ─────────────── Direct Messaging System ─────────────── */

export async function fetchUnreadMessageCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error("Error fetching unread count:", error);
      return 0;
    }
    return count || 0;
  } catch (err) {
    console.error("Exception fetching unread count:", err);
    return 0;
  }
}

export async function markMessagesAsRead(userId: string, friendId: string): Promise<void> {
  try {
    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('receiver_id', userId)
      .eq('sender_id', friendId)
      .eq('is_read', false);
  } catch (err) {
    console.error("Exception marking messages as read:", err);
  }
}

export async function sendDirectMessage(
  senderId: string,
  receiverId: string,
  content: string,
  fileMeta?: { url: string; name: string; type: string; size: number }
): Promise<DirectMessage | null> {
  if (!senderId || !receiverId || (!content.trim() && !fileMeta)) return null;
  try {
    const payload: any = {
      sender_id: senderId,
      receiver_id: receiverId,
      content: content.trim(),
    };

    if (fileMeta) {
      payload.file_url = fileMeta.url;
      payload.file_name = fileMeta.name;
      payload.file_type = fileMeta.type;
      payload.file_size = fileMeta.size;
    }

    const { data, error } = await supabase
      .from('direct_messages')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error sending message:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Exception sending message:", err);
    return null;
  }
}

export async function fetchDirectMessages(
  userId1: string, // Current user
  userId2: string  // Friend
): Promise<DirectMessage[]> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return [];
    }
    
    // Filter out messages hidden by the current user
    const visibleMessages = (data || []).filter(msg => {
      if (msg.sender_id === userId1 && msg.deleted_by_sender) return false;
      if (msg.receiver_id === userId1 && msg.deleted_by_receiver) return false;
      return true;
    });
    
    return visibleMessages;
  } catch (err) {
    console.error("Exception fetching messages:", err);
    return [];
  }
}

export async function deleteDirectMessage(messageId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('direct_messages')
      .delete()
      .eq('id', messageId);
    return !error;
  } catch (err) {
    console.error("Error deleting message:", err);
    return false;
  }
}

export async function hideDirectMessage(messageId: string, isSender: boolean): Promise<boolean> {
  try {
    const updatePayload = isSender 
      ? { deleted_by_sender: true } 
      : { deleted_by_receiver: true };
      
    const { error } = await supabase
      .from('direct_messages')
      .update(updatePayload)
      .eq('id', messageId);
    return !error;
  } catch (err) {
    console.error("Error hiding message:", err);
    return false;
  }
}

export function subscribeToDirectMessages(
  userId: string,
  onNewMessage: (msg: DirectMessage) => void,
  onMessageDeleted?: (msgId: string) => void,
  onMessageHidden?: (msg: DirectMessage) => void
) {
  const channel = supabase
    .channel(`public:direct_messages:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'direct_messages' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as DirectMessage;
          if (newMsg.sender_id === userId || newMsg.receiver_id === userId) {
            onNewMessage(newMsg);
          }
        } else if (payload.eventType === 'DELETE') {
          const oldMsg = payload.old as { id: string };
          if (onMessageDeleted && oldMsg.id) {
            onMessageDeleted(oldMsg.id);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = payload.new as DirectMessage;
          if (onMessageHidden && (updatedMsg.sender_id === userId || updatedMsg.receiver_id === userId)) {
            onMessageHidden(updatedMsg);
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function uploadChatFile(
  userId: string,
  file: File
): Promise<{ url: string; name: string; type: string; size: number }> {
  // Enforce Max 25MB
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("File size exceeds the 25MB limit.");
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}_${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('chat_attachments')
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload file");
  }

  const { data } = supabase.storage
    .from('chat_attachments')
    .getPublicUrl(filePath);

  return {
    url: data.publicUrl,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

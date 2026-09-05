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

  // 1b. Try alternative ID (if userId is username or clerk ID)
  try {
    let altId = "";
    if (userId.startsWith("user_")) {
      const { data: prof } = await supabase.from("user_profiles").select("username").eq("id", userId).maybeSingle();
      if (prof?.username) altId = prof.username;
    } else {
      const { data: prof } = await supabase.from("user_profiles").select("id").eq("username", userId).maybeSingle();
      if (prof?.id) altId = prof.id;
    }

    if (altId) {
      const { data: altDb } = await supabase.from("workspaces").select("data").eq("user_id", altId).maybeSingle();
      if (altDb && altDb.data && typeof altDb.data === "object") {
        return altDb.data as UserWorkspace;
      }
      const altCached = localStorage.getItem(`dreamit_workspace_${altId}`);
      if (altCached) {
        try { return JSON.parse(altCached); } catch {}
      }
    }
  } catch (lookupErr) {
    console.warn("Alt workspace lookup failed:", lookupErr);
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

  return null;
}

/** Save workspace strictly isolated by Clerk userId to Supabase & LocalStorage */
export async function saveUserWorkspace(accessToken: string, userId: string, workspaceData: UserWorkspace): Promise<boolean> {
  if (!userId) return false;
  const cacheKey = `dreamit_workspace_${userId}`;
  
  // Save locally strictly under userId
  localStorage.setItem(cacheKey, JSON.stringify(workspaceData));

  let savedRemote = false;

  // Save to Supabase Database table 'workspaces' per user_id with conflict resolution
  try {
    const { error } = await supabase
      .from("workspaces")
      .upsert(
        { user_id: userId, data: workspaceData, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (!error) {
      savedRemote = true;
    } else {
      console.warn("Supabase database workspace save error:", error);
    }
  } catch (e) {
    console.warn("Supabase database workspace save failed:", e);
  }

  // Trigger non-blocking incremental relational sync to normalized tables
  syncWorkspaceRelational(userId, workspaceData).catch(() => {});

  return savedRemote;
}

/* ─────────────── Relational Database Incremental Sync ─────────────── */

/** Granularly syncs entities to normalized PostgreSQL tables with Row-Level Security */
export async function syncWorkspaceRelational(userId: string, data: UserWorkspace): Promise<void> {
  if (!userId) return;

  try {
    // 1. Sync Subjects
    if (Array.isArray(data.subjects) && data.subjects.length > 0) {
      const subjectRows = data.subjects.map((s) => ({
        id: s.id,
        user_id: userId,
        name: s.name,
        color: s.color || "#c8d9e9",
        accent: s.accent || "#315f48",
        description: s.description || null,
      }));
      await supabase.from("subjects").upsert(subjectRows, { onConflict: "id" });
    }

    // 2. Sync Notes
    if (Array.isArray(data.notes) && data.notes.length > 0) {
      const noteRows = data.notes.map((n) => ({
        id: n.id,
        user_id: userId,
        subject_id: n.subjectId || null,
        title: n.title,
        content: n.content || "",
        created_at: n.createdAt,
        updated_at: n.updatedAt,
      }));
      await supabase.from("notes").upsert(noteRows, { onConflict: "id" });
    }

    // 3. Sync Tasks
    if (Array.isArray(data.tasks) && data.tasks.length > 0) {
      const taskRows = data.tasks.map((t) => ({
        id: t.id,
        user_id: userId,
        title: t.title,
        course: t.course || null,
        time: t.time || null,
        done: !!t.done,
        color: t.color || "#315f48",
        priority: t.priority || "medium",
        deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
      }));
      await supabase.from("tasks").upsert(taskRows, { onConflict: "id" });
    }

    // 4. Sync Flashcards
    if (Array.isArray(data.flashcards) && data.flashcards.length > 0) {
      const cardRows = data.flashcards.map((c) => ({
        id: c.id,
        user_id: userId,
        subject_id: c.subjectId || null,
        front: c.front,
        back: c.back,
        difficulty: c.difficulty || "medium",
        review_count: c.reviewCount || 0,
        last_reviewed: c.lastReviewed || null,
        next_review: c.nextReview || null,
      }));
      await supabase.from("flashcards").upsert(cardRows, { onConflict: "id" });
    }

    // 5. Sync Grades
    if (Array.isArray(data.grades) && data.grades.length > 0) {
      const gradeRows = data.grades.map((g) => ({
        id: g.id,
        user_id: userId,
        subject_id: g.subjectId || null,
        assignment_name: g.assignmentName,
        score: g.score,
        total: g.total,
        weight: g.weight || 100,
      }));
      await supabase.from("grades").upsert(gradeRows, { onConflict: "id" });
    }
  } catch (err) {
    // Relational sync is resilient; table may not yet be migrated in dev
    console.debug("[Relational Sync]: Schema pending or offline in Supabase.", err);
  }
}

/** Delete a note directly from relational database */
export async function deleteRelationalNote(noteId: string): Promise<void> {
  try {
    await supabase.from("notes").delete().eq("id", noteId);
  } catch (e) {
    console.debug("Relational delete note:", e);
  }
}

/** Delete a task directly from relational database */
export async function deleteRelationalTask(taskId: number): Promise<void> {
  try {
    await supabase.from("tasks").delete().eq("id", taskId);
  } catch (e) {
    console.debug("Relational delete task:", e);
  }
}

/** Delete a flashcard directly from relational database */
export async function deleteRelationalFlashcard(cardId: string): Promise<void> {
  try {
    await supabase.from("flashcards").delete().eq("id", cardId);
  } catch (e) {
    console.debug("Relational delete flashcard:", e);
  }
}

/** Save an exam simulator result to relational database */
export async function saveRelationalExamResult(userId: string, reportData: any): Promise<void> {
  if (!userId) return;
  try {
    await supabase.from("exam_results").insert({
      id: reportData.id || crypto.randomUUID(),
      user_id: userId,
      class_level: reportData.classLevel || "10",
      subject: reportData.subject || "General",
      chapter: reportData.chapter || "Mock Exam",
      total_marks: reportData.totalMarks || 20,
      obtained_marks: reportData.obtainedMarks || 0,
      percentage: reportData.percentage || 0,
      grade_band: reportData.gradeBand || "Pass",
      report: reportData,
    });
  } catch (e) {
    console.debug("Relational save exam result:", e);
  }
}

/** Subscribe to realtime workspace changes for live parent-child sync */
export function subscribeToWorkspace(userId: string, onUpdate: (data: UserWorkspace) => void): () => void {
  const channel = supabase
    .channel(`workspace-sync-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "workspaces",
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        if (payload.new && payload.new.data) {
          onUpdate(payload.new.data as UserWorkspace);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
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

  if (typeof window !== "undefined" && window.localStorage) {
    const cached = window.localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Ignore parse error
      }
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

  // Enforce Max 25MB
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("File size exceeds the 25MB limit.");
  }

  // Sanitize file name and build storage path
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `subject_files/${userId}/${subjectId}/${Date.now()}_${sanitizedName}`;

  // Direct upload to Supabase Storage bucket
  const { error: uploadError } = await supabase.storage
    .from("chat_attachments")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(uploadError.message || "Failed to upload file to storage.");
  }

  const meta: AttachedFile = {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    subjectId,
    taskId,
    storagePath,
    createdAt: new Date().toISOString(),
  };

  const existing = await fetchUserFiles(accessToken, userId);
  const updated = [meta, ...existing];
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(cacheKey, JSON.stringify(updated));
  }
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
      .from("chat_attachments")
      .createSignedUrl(storagePath, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {}

  const { data: pub } = supabase.storage.from("chat_attachments").getPublicUrl(storagePath);
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
    const { error } = await supabase.storage.from("chat_attachments").remove([storagePath]);
    if (error) {
      console.warn("Could not remove file from storage:", error);
    }
  } catch (e) {
    console.warn("Storage file removal exception:", e);
  }

  const existing = await fetchUserFiles(accessToken, userId);
  const updated = existing.filter((f) => f.id !== fileId);
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(cacheKey, JSON.stringify(updated));
  }
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

export interface UserProfileData {
  id: string;
  username: string;
  image_url: string;
}

export async function upsertUserProfile(id: string, username: string, imageUrl?: string) {
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      { id, username, image_url: imageUrl },
      { onConflict: 'id' }
    );
  if (error) console.error("Error upserting user profile:", error);
}

export async function fetchUserProfiles(userIds: string[]): Promise<Record<string, UserProfileData>> {
  if (userIds.length === 0) return {};
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, username, image_url')
    .in('id', userIds);
    
  if (error) {
    console.error("Error fetching user profiles:", error);
    return {};
  }
  
  const profileMap: Record<string, UserProfileData> = {};
  data?.forEach(profile => {
    profileMap[profile.id] = profile;
  });
  return profileMap;
}

/* ─────────────── Parent Monitoring System ─────────────── */

export interface ParentLink {
  id: string;
  parent_user_id: string;
  parent_username: string;
  child_user_id: string;
  child_username: string;
  created_at: string;
}

export interface ChatActivityReport {
  friendId: string;
  friendUsername: string;
  messageCount: number;
  lastMessageAt: string;
  messages: DirectMessage[];
}

export interface ParentReport {
  workspace: UserWorkspace | null;
  chatActivity: ChatActivityReport[];
  friends: Friendship[];
  friendCount: number;
}

/** Check if a user has any parent links (for auto-redirecting returning parents) */
export async function fetchParentLinks(parentUserId: string): Promise<ParentLink[]> {
  try {
    const { data, error } = await supabase
      .from("parent_links")
      .select("*")
      .eq("parent_user_id", parentUserId);

    if (error) {
      console.error("Error fetching parent links:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Exception fetching parent links:", err);
    return [];
  }
}

/** Fetch all chat messages for a child user (full transparency for parents) */
export async function fetchChildChatMessages(childUserId: string): Promise<DirectMessage[]> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${childUserId},receiver_id.eq.${childUserId}`)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching child messages:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Exception fetching child messages:", err);
    return [];
  }
}

/** Build comprehensive parent report for a child's account */
export async function fetchParentReport(childUserId: string): Promise<ParentReport> {
  // 1. Fetch child's workspace
  const workspace = await fetchUserWorkspace("parent-access", childUserId);

  // 2. Fetch child's friends
  const friends = await fetchFriends(childUserId);

  // 3. Fetch all child's messages (full transparency)
  const allMessages = await fetchChildChatMessages(childUserId);

  // 4. Group messages by friend for activity report
  const friendMessageMap = new Map<string, DirectMessage[]>();
  allMessages.forEach((msg) => {
    const friendId = msg.sender_id === childUserId ? msg.receiver_id : msg.sender_id;
    if (!friendMessageMap.has(friendId)) {
      friendMessageMap.set(friendId, []);
    }
    friendMessageMap.get(friendId)!.push(msg);
  });

  // 5. Resolve friend usernames
  const friendIds = Array.from(friendMessageMap.keys());
  const friendProfiles = await fetchUserProfiles(friendIds);

  // 6. Build chat activity report
  const chatActivity: ChatActivityReport[] = [];
  friendMessageMap.forEach((messages, friendId) => {
    chatActivity.push({
      friendId,
      friendUsername: friendProfiles[friendId]?.username || "Unknown",
      messageCount: messages.length,
      lastMessageAt: messages[0]?.created_at || "",
      messages: messages,
    });
  });

  // Sort by most recent activity
  chatActivity.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  return {
    workspace,
    chatActivity,
    friends,
    friendCount: friends.length,
  };
}

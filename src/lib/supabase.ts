import { createClient } from "@supabase/supabase-js";

import type { FinanceData } from "./finance-types";
import { saveWorkspaceOffline, getWorkspaceOffline, recordOfflineMutation } from "./offline-storage";
export { saveWorkspaceOffline, getWorkspaceOffline } from "./offline-storage";
import { dispatchChatPushNotification } from "./pushNotifications";

import { projectId as defaultProjectId, publicAnonKey as defaultAnonKey } from "../../utils/supabase/info";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${defaultProjectId}.supabase.co`;
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || defaultAnonKey;

let tokenProvider: (() => Promise<string | null>) | null = null;
let clerkAccessToken: string | null = null;

export function setSupabaseTokenProvider(provider: (() => Promise<string | null>) | null) {
  tokenProvider = provider;
}

export const supabase = createClient(
  supabaseUrl,
  publicAnonKey,
  {
    accessToken: async () => {
      if (tokenProvider) {
        try {
          const freshToken = await tokenProvider();
          clerkAccessToken = freshToken;
          return freshToken;
        } catch (error) {
          console.error("[Supabase] Clerk token refresh failed:", error);
          return null;
        }
      }

      return clerkAccessToken;
    },
  }
);

export function setSupabaseAuthToken(token: string | null) {
  clerkAccessToken = token;

  if (token) {
    try {
      supabase.realtime.setAuth(token);
    } catch (error) {
      console.warn("[Supabase] Realtime setAuth error:", error);
    }
  }
}

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

/** Fetch workspace strictly isolated by Clerk userId from Supabase & IndexedDB */
export async function fetchUserWorkspace(accessToken: string, userId: string): Promise<UserWorkspace | null> {
  if (!userId) return null;

  // 1. Try Supabase Database table 'workspaces' by user_id
  try {
    const { data: dbData } = await supabase
      .from("workspaces")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (dbData && dbData.data && typeof dbData.data === "object") {
      // Asynchronously update IndexedDB cache
      saveWorkspaceOffline(userId, dbData.data as UserWorkspace).catch(() => { });
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
        saveWorkspaceOffline(userId, altDb.data as UserWorkspace).catch(() => { });
        return altDb.data as UserWorkspace;
      }
      const altCached = await getWorkspaceOffline(altId);
      if (altCached) return altCached;
    }
  } catch (lookupErr) {
    console.warn("Alt workspace lookup failed:", lookupErr);
  }

  // 2. Offline Fallback: Retrieve from high-capacity IndexedDB (with automatic localStorage migration)
  const offlineCached = await getWorkspaceOffline(userId);
  if (offlineCached) {
    return offlineCached;
  }

  return null;
}

/** Save workspace strictly isolated by Clerk userId to IndexedDB and sync to Supabase */
export async function saveUserWorkspace(accessToken: string, userId: string, workspaceData: UserWorkspace): Promise<boolean> {
  if (!userId) return false;

  // 1. Immediately save locally to high-performance IndexedDB off the main thread
  await saveWorkspaceOffline(userId, workspaceData);

  // If currently offline, queue mutation for background sync upon reconnection
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    recordOfflineMutation(userId, "workspace_update", workspaceData).catch(() => { });
    return true;
  }

  let savedRemote = false;

  // 2. Save to Supabase Database table 'workspaces' per user_id with conflict resolution
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
      recordOfflineMutation(userId, "workspace_update", workspaceData).catch(() => { });
    }
  } catch (e) {
    console.warn("Supabase database workspace save failed:", e);
    recordOfflineMutation(userId, "workspace_update", workspaceData).catch(() => { });
  }

  // Trigger non-blocking incremental relational sync to normalized tables
  syncWorkspaceRelational(userId, workspaceData).catch(() => { });

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

/** Get authenticated signed download URL for private storage */
export async function getFileDownloadUrl(
  accessToken: string,
  userId: string,
  fileId: string,
  storagePath: string,
  expiresInSeconds: number = 86400
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from("chat_attachments")
      .createSignedUrl(storagePath, expiresInSeconds);
    if (!error && data?.signedUrl) return data.signedUrl;
    if (error) {
      console.error("[Storage] Failed creating signed URL:", error);
    }
  } catch (err) {
    console.error("[Storage] Exception creating signed URL:", err);
  }

  throw new Error("Failed to generate authenticated signed download URL for private storage.");
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
): Promise<{ success: boolean; message?: string }> {
  if (!requesterId || !targetIdentifier) {
    return { success: false, message: "Missing user information or friend username." };
  }
  const cleanTarget = targetIdentifier.trim();

  try {
    // 1. Look up target profile securely through RPC
    let targetId: string | null = null;
    let targetActualIdentifier: string | null = null;

    const { data: targetProfiles, error: profileError } = await supabase
      .rpc('lookup_friend_profile', {
        p_username: cleanTarget,
      });

    if (profileError) {
      console.error("[Friends] Profile lookup failed:", profileError);
      return {
        success: false,
        message: "Could not look up this username. Please try again.",
      };
    }

    const targetProfile = targetProfiles?.[0] ?? null;

    if (!targetProfile) {
      return {
        success: false,
        message: "Username not found or is ambiguous. Ask your friend to choose a unique username.",
      };
    }

    if (targetProfile.id === requesterId) {
      return {
        success: false,
        message: "You cannot add yourself as a friend.",
      };
    }

    targetId = targetProfile.id;
    targetActualIdentifier = targetProfile.username;

    // 2. Check if a friendship or request already exists between these users
    try {
      const orConditions: string[] = [
        `and(requester_id.eq.${requesterId},target_identifier.ilike.${cleanTarget})`,
      ];
      if (targetId) {
        orConditions.push(`and(requester_id.eq.${requesterId},target_id.eq.${targetId})`);
        orConditions.push(`and(requester_id.eq.${targetId},target_id.eq.${requesterId})`);
        orConditions.push(`and(requester_id.eq.${targetId},target_identifier.ilike.${requesterIdentifier})`);
      }

      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status, requester_id, target_id, target_identifier')
        .or(orConditions.join(','))
        .limit(1)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          return { success: false, message: `You are already friends with ${cleanTarget}.` };
        }
        if (existing.status === 'pending') {
          if (existing.requester_id === requesterId) {
            return { success: false, message: `A friend request to ${cleanTarget} is already pending.` };
          } else {
            return { success: false, message: `${cleanTarget} already sent you a friend request. Accept it in your pending requests!` };
          }
        }
      }
    } catch (checkErr) {
      console.warn("[Friends] Existing friendship check skipped:", checkErr);
    }

    // 3. Insert friendship request
    const insertPayload: any = {
      requester_id: requesterId,
      requester_identifier: requesterIdentifier,
      target_identifier: cleanTarget,
      status: 'pending',
    };
    if (targetId) {
      insertPayload.target_id = targetId;
    }
    if (targetActualIdentifier) {
      insertPayload.target_actual_identifier = targetActualIdentifier;
    }

    const { error } = await supabase.from('friendships').insert(insertPayload);
    if (error) {
      console.error("[Friends] Error sending friend request:", error);
      if (error.code === '23505') {
        return { success: false, message: `A friend request to ${cleanTarget} is already pending.` };
      }
      if (error.message?.includes('row-level security')) {
        try {
          const res = await supabase.rpc('current_app_user_id');
          const dbUser = res?.data;
          console.warn("[Friends] RLS violation diagnosis:", {
            clientRequesterId: requesterId,
            dbCurrentUserId: dbUser,
          });
          if (!dbUser) {
            return {
              success: false,
              message: "Security policy error: Database cannot resolve user session. Please update current_app_user_id() on your server.",
            };
          }
        } catch (diagErr) {
          console.warn("[Friends] Could not query current_app_user_id:", diagErr);
        }
      }
      return { success: false, message: error.message || "Failed to send friend request. Check database permissions." };
    }
    return { success: true };
  } catch (err: any) {
    console.error("[Friends] Exception sending friend request:", err);
    return { success: false, message: err?.message || "Failed to send friend request." };
  }
}

export async function fetchPendingFriendRequests(
  username?: string | null,
  email?: string | null,
  userId?: string | null
): Promise<Friendship[]> {
  const identifiers: string[] = [];
  if (username) identifiers.push(username);
  if (email) identifiers.push(email);
  if (identifiers.length === 0 && !userId) return [];

  try {
    let query = supabase.from('friendships').select('*').eq('status', 'pending');

    if (userId && identifiers.length > 0) {
      const inClause = identifiers.map((i) => `"${i}"`).join(',');
      query = query.or(`target_id.eq.${userId},target_identifier.in.(${inClause})`);
    } else if (userId) {
      query = query.eq('target_id', userId);
    } else {
      query = query.in('target_identifier', identifiers);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

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

export async function deleteFriendship(friendshipId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      console.error("Error deleting friendship:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Exception deleting friendship:", err);
    return false;
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

export interface FriendConversationMeta {
  lastMessageAt: string | null;
  lastMessageText: string | null;
  unreadCount: number;
}

export function formatMessageSnippet(msg: {
  content?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_url?: string | null;
}): string {
  if (msg.content && msg.content.trim()) return msg.content;
  const isAudio =
    msg.file_type?.startsWith('audio/') ||
    msg.file_name?.startsWith('voice_note_') ||
    msg.file_name?.endsWith('.webm') ||
    msg.file_name?.endsWith('.m4a') ||
    msg.file_name?.endsWith('.mp3') ||
    msg.file_name?.endsWith('.wav') ||
    msg.file_name?.endsWith('.ogg');
  if (isAudio) return "🎙️ Voice message";
  if (msg.file_name) return `📎 ${msg.file_name}`;
  if (msg.file_url) return "📎 File attachment";
  return "";
}

export async function fetchFriendsConversationMeta(
  userId: string
): Promise<Record<string, FriendConversationMeta>> {
  if (!userId) return {};
  try {
    const metaByFriendId: Record<string, FriendConversationMeta> = {};

    // 1. Fetch ALL unread messages received by this user (identical filter to fetchUnreadMessageCount)
    const { data: unreadData, error: unreadError } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (unreadError) {
      console.error("Error fetching unread messages in fetchFriendsConversationMeta:", unreadError);
    } else {
      for (const msg of unreadData || []) {
        const friendId = msg.sender_id;
        if (!friendId) continue;
        if (!metaByFriendId[friendId]) {
          metaByFriendId[friendId] = {
            lastMessageAt: msg.created_at,
            lastMessageText: formatMessageSnippet(msg),
            unreadCount: 0,
          };
        }
        metaByFriendId[friendId].unreadCount += 1;
      }
    }

    // 2. Fetch recent conversation messages to populate previews & timestamps for all active friends
    const { data: recentData, error: recentError } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (recentError) {
      console.error("Error fetching recent messages in fetchFriendsConversationMeta:", recentError);
    } else {
      for (const msg of recentData || []) {
        const friendId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (!friendId) continue;

        if (!metaByFriendId[friendId]) {
          metaByFriendId[friendId] = {
            lastMessageAt: msg.created_at,
            lastMessageText: formatMessageSnippet(msg),
            unreadCount: 0,
          };
        } else {
          // If this message is newer than what was registered from unreadData (e.g. user replied last)
          const curTime = metaByFriendId[friendId].lastMessageAt ? new Date(metaByFriendId[friendId].lastMessageAt!).getTime() : 0;
          const msgTime = new Date(msg.created_at).getTime();
          if (msgTime > curTime) {
            metaByFriendId[friendId].lastMessageAt = msg.created_at;
            metaByFriendId[friendId].lastMessageText = formatMessageSnippet(msg);
          }
        }
      }
    }

    return metaByFriendId;
  } catch (err) {
    console.error("Exception in fetchFriendsConversationMeta:", err);
    return {};
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
  fileMeta?: { url: string; name: string; type: string; size: number },
  senderName?: string
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

    // Dispatch background/lock-screen push notification to recipient's phone/desktop
    dispatchChatPushNotification({
      recipientId: receiverId,
      senderId,
      senderName: senderName || "Friend",
      content: content.trim(),
      fileMeta,
    }).catch(() => { });

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
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return [];
    }

    // Filter out messages hidden by the current user and refresh private attachment signed URLs
    const filtered = (data || []).filter(msg => {
      if (msg.sender_id === userId1 && msg.deleted_by_sender) return false;
      if (msg.receiver_id === userId1 && msg.deleted_by_receiver) return false;
      return true;
    });

    const visibleMessages = await Promise.all(
      filtered.map(async (msg) => {
        if (msg.file_url) {
          try {
            const freshUrl = await resolveChatAttachmentSignedUrl(msg.file_url);
            return { ...msg, file_url: freshUrl };
          } catch {
            return msg;
          }
        }
        return msg;
      })
    );

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

    if (error) {
      console.error("[Chat] Error permanently deleting message:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Chat] Exception deleting message:", err);
    return false;
  }
}

export async function hideDirectMessage(messageId: string, isSender: boolean): Promise<boolean> {
  try {
    const updatePayload = isSender
      ? { deleted_by_sender: true }
      : { deleted_by_receiver: true };

    const { data, error } = await supabase
      .from('direct_messages')
      .update(updatePayload)
      .eq('id', messageId)
      .select('id, deleted_by_sender, deleted_by_receiver')
      .maybeSingle();

    if (error) {
      console.error("[Chat] Error hiding message:", error);
      return false;
    }

    // If both parties have hidden/deleted the message, permanently purge it from DB
    if (data && data.deleted_by_sender && data.deleted_by_receiver) {
      await supabase
        .from('direct_messages')
        .delete()
        .eq('id', messageId);
    }

    return true;
  } catch (err) {
    console.error("[Chat] Exception hiding message:", err);
    return false;
  }
}

export function subscribeToDirectMessages(
  userId: string,
  onNewMessage: (msg: DirectMessage) => void,
  onMessageDeleted?: (msgId: string) => void,
  onMessageHidden?: (msg: DirectMessage) => void
) {
  // Use unique channel identifier to prevent one component unmounting from tearing down another component's channel
  const subInstanceId = Math.random().toString(36).substring(2, 9);
  const channel = supabase
    .channel(`public:direct_messages:${userId}:${subInstanceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'direct_messages' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as DirectMessage;
          if (newMsg && (newMsg.sender_id === userId || newMsg.receiver_id === userId)) {
            onNewMessage(newMsg);
          }
        } else if (payload.eventType === 'DELETE') {
          const oldMsg = payload.old as { id: string };
          if (onMessageDeleted && oldMsg?.id) {
            onMessageDeleted(oldMsg.id);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = payload.new as DirectMessage;
          if (onMessageHidden && (updatedMsg?.sender_id === userId || updatedMsg?.receiver_id === userId)) {
            onMessageHidden(updatedMsg);
          }
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Subscribed to direct_messages for ${userId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.warn(`[Realtime] direct_messages channel error:`, err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Ephemeral Realtime Broadcast for Live Typing Indicator (Zero DB queries/table bloat)
 */
const activeTypingChannels: Record<string, ReturnType<typeof supabase.channel>> = {};

function getOrCreateTypingChannel(userA: string, userB: string) {
  const channelName = `typing:${[userA, userB].sort().join('-')}`;
  if (!activeTypingChannels[channelName]) {
    activeTypingChannels[channelName] = supabase.channel(channelName, {
      config: { broadcast: { ack: false } },
    });
    activeTypingChannels[channelName].subscribe();
  }
  return activeTypingChannels[channelName];
}

export function sendTypingStatus(senderId: string, receiverId: string, isTyping: boolean) {
  try {
    const channel = getOrCreateTypingChannel(senderId, receiverId);
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { senderId, receiverId, isTyping },
    });
  } catch (err) {
    console.warn("[Typing] Failed to broadcast typing status:", err);
  }
}

export function subscribeToTypingStatus(
  currentUserId: string,
  targetUserId: string,
  onTypingChange: (isTyping: boolean) => void
) {
  const channel = getOrCreateTypingChannel(currentUserId, targetUserId);
  const handler = (payload: any) => {
    const data = payload?.payload;
    if (data && data.senderId === targetUserId && data.receiverId === currentUserId) {
      onTypingChange(Boolean(data.isTyping));
    }
  };

  channel.on('broadcast', { event: 'typing' }, handler);

  return () => {
    // Keep channel open or remove handler
  };
}

/**
 * Resolves an authenticated signed URL for a chat attachment given a raw path or legacy URL.
 */
export async function resolveChatAttachmentSignedUrl(urlOrPath: string): Promise<string> {
  if (!urlOrPath) return "";
  if (urlOrPath.startsWith("data:") || urlOrPath.startsWith("blob:")) return urlOrPath;

  let path = urlOrPath;
  const match = urlOrPath.match(/chat_attachments\/(.+?)(\?|$)/);
  if (match) {
    path = decodeURIComponent(match[1]);
  } else if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    try {
      const parsed = new URL(urlOrPath);
      const parts = parsed.pathname.split("/chat_attachments/");
      if (parts.length > 1) {
        path = decodeURIComponent(parts[1]);
      }
    } catch { }
  }

  try {
    const { data, error } = await supabase.storage
      .from("chat_attachments")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.warn("[Storage] Failed creating signed URL for chat attachment:", path, err);
  }

  return urlOrPath;
}

export async function uploadChatFile(
  userId: string,
  file: File | (Blob & { name?: string })
): Promise<{ url: string; name: string; type: string; size: number }> {
  // Enforce Max 25MB
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("File size exceeds the 25MB limit.");
  }

  const defaultExt = file.type?.includes('mp4') ? 'm4a' : file.type?.includes('ogg') ? 'ogg' : file.type?.includes('webm') ? 'webm' : 'bin';
  const rawName = (file as any).name || `file_${Date.now()}.${defaultExt}`;
  const fileExt = rawName.split('.').pop() || defaultExt;
  const fileName = `${userId}_${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('chat_attachments')
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload file");
  }

  // Generate authenticated signed URL (7 days validity for private chat attachments)
  const { data, error: signError } = await supabase.storage
    .from('chat_attachments')
    .createSignedUrl(filePath, 60 * 60 * 24 * 7);

  if (signError || !data?.signedUrl) {
    throw new Error(signError?.message || "Failed to generate signed URL for uploaded attachment");
  }

  return {
    url: data.signedUrl,
    name: rawName,
    type: file.type || 'application/octet-stream',
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

export async function fetchUserProfiles(identifiersOrIds: string[]): Promise<Record<string, UserProfileData>> {
  if (!identifiersOrIds || identifiersOrIds.length === 0) return {};
  const cleanList = Array.from(new Set(identifiersOrIds.filter(Boolean).map((s) => s.trim())));
  if (cleanList.length === 0) return {};

  try {
    const profileMap: Record<string, UserProfileData> = {};
    const queryList = Array.from(new Set([
      ...cleanList,
      ...cleanList.map((s) => s.toLowerCase()),
    ]));

    // Query both by id and by username in parallel
    const [{ data: byId }, { data: byUsername }] = await Promise.all([
      supabase.from('user_profiles').select('id, username, image_url').in('id', cleanList),
      supabase.from('user_profiles').select('id, username, image_url').in('username', queryList),
    ]);

    [...(byId || []), ...(byUsername || [])].forEach((profile) => {
      if (profile.id) profileMap[profile.id] = profile;
      if (profile.username) {
        profileMap[profile.username] = profile;
        profileMap[profile.username.toLowerCase()] = profile;
      }
    });

    // Check if any username identifiers are still missing and try case-insensitive ilike
    const missing = cleanList.filter(
      (item) => !profileMap[item] && !profileMap[item.toLowerCase()] && !item.startsWith("user_")
    );
    if (missing.length > 0) {
      await Promise.all(
        missing.map(async (name) => {
          try {
            const { data } = await supabase
              .from('user_profiles')
              .select('id, username, image_url')
              .ilike('username', name)
              .maybeSingle();
            if (data) {
              if (data.id) profileMap[data.id] = data;
              if (data.username) {
                profileMap[data.username] = data;
                profileMap[data.username.toLowerCase()] = data;
              }
              profileMap[name] = data;
              profileMap[name.toLowerCase()] = data;
            }
          } catch { }
        })
      );
    }

    return profileMap;
  } catch (err) {
    console.error("Exception fetching user profiles:", err);
    return {};
  }
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
    const { data, error } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${childUserId},receiver_id.eq.${childUserId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching child messages:", error);
      return [];
    }

    const messages = await Promise.all(
      (data || []).map(async (msg) => {
        if (msg.file_url) {
          try {
            const freshUrl = await resolveChatAttachmentSignedUrl(msg.file_url);
            return { ...msg, file_url: freshUrl };
          } catch {
            return msg;
          }
        }
        return msg;
      })
    );

    return messages;
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

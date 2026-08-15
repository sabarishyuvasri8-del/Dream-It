import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

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
}

export interface ScheduleItem {
  id?: number;
  time: string;
  title: string;
  note: string;
  tone: string;
  course?: string;
  done?: boolean;
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
  taskId?: number
): Promise<AttachedFile> {
  if (!userId) throw new Error("User authentication required");
  const cacheKey = `dreamit_files_${userId}`;

  // Enforce Max 20MB
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("File size exceeds the 20MB limit.");
  }

  const fileId = crypto.randomUUID();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storagePath = `${userId}/${fileId}-${sanitizedFileName}`;

  const { error: storageErr } = await supabase.storage
    .from("attachments")
    .upload(storagePath, file, { contentType: file.type, upsert: true });

  if (storageErr) {
    console.warn("Supabase storage upload info:", storageErr.message);
  }

  const meta: AttachedFile = {
    id: fileId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    subjectId,
    taskId,
    storagePath,
    createdAt: new Date().toISOString(),
  };

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

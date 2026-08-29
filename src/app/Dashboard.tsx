import { FormEvent, useEffect, useMemo, useRef, useState, useCallback, Suspense, lazy } from "react";
import confetti from "canvas-confetti";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { UserProfile } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import {
  Activity,
  AlarmClock,
  AlertCircle,
  ArrowUpRight,
  Award,
  Bell,
  Bold,
  BookOpen,
  BookOpenCheck,
  Bot,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Code,
  Coffee,
  Compass,
  Cloud,
  Cpu,
  Download,
  Edit2,
  ExternalLink,
  FileText,
  Flame,
  Folder,
  FolderPlus,
  GraduationCap,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Inbox,
  Italic,
  Key,
  Layers,
  LayoutDashboard,
  List,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  MoreHorizontal,
  Notebook,
  MessageCircle,
  Paperclip,
  Pause,
  Play,
  Plus,
  Palette,
  Quote,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Star,
  StickyNote,
  Sun,
  Target,
  Timer,
  Trash2,
  Trophy,
  UserCheck,
  Users,
  Wallet,
  X,
  Zap,
  Loader2,
} from "lucide-react";
import {
  AttachedFile,
  calculateLevel,
  createEmptyWorkspace,
  deleteAttachedFile,
  fetchUserFiles,
  fetchUserWorkspace,
  Flashcard,
  FocusLogEntry,
  getFileDownloadUrl,
  getLevelTitle,
  getXPForNextLevel,
  GradeEntry,
  NoteEntry,
  saveUserWorkspace,
  StreakData,
  Subject,
  Task,
  ScheduleItem,
  UserWorkspace,
  SharedNote,
  shareNote,
  fetchPendingShares,
  respondToShare,
  Friendship,
  fetchFriends,
  fetchPendingFriendRequests,
  respondToFriendRequest,
  sendFriendRequest,
  fetchUnreadMessageCount,
  subscribeToDirectMessages,
  upsertUserProfile,
} from "../lib/supabase";
const FinanceApp = lazy(() => import("./finance/FinanceApp"));
import type { FinanceData } from "../lib/finance-types";
import { FileUpload, formatFileSize } from "../components/FileUpload";
import { useTheme } from "../lib/ThemeContext";
import ThemeSelector from "./components/ThemeSelector";
import VoiceInputButton from "./components/VoiceInputButton";
import InboxModal from "./components/InboxModal";
import FriendsModal from "./components/FriendsModal";
import { useAppStore } from "../lib/store";
import { fetchAI } from "../lib/ai-client";
import ChatModal from "./components/ChatModal";

type Message = { role: "user" | "assistant"; content: string };

const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Get ISO date string for a date (YYYY-MM-DD) */
function toDateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Build the last N days as date keys */
function renderSimpleMarkdown(text: string) {
  if (!text.trim()) {
    return <p className="text-xs italic py-8 text-center opacity-60">Nothing written yet. Switch to Edit mode to write your note!</p>;
  }
  return (
    <div className="space-y-2 text-xs leading-relaxed font-[DM_Sans]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({node, ...props}) => <h1 className="font-[Roboto_Slab] text-xl font-bold mt-4 mb-2 pb-1 border-b" style={{ borderColor: "var(--m-border-light)", color: "var(--m-text-heading)" }} {...props} />,
          h2: ({node, ...props}) => <h2 className="font-[Roboto_Slab] text-lg font-semibold mt-3 mb-1" style={{ color: "var(--m-text-heading)" }} {...props} />,
          h3: ({node, ...props}) => <h3 className="font-[Roboto_Slab] text-sm font-bold mt-2" style={{ color: "var(--m-text-heading)" }} {...props} />,
          ul: ({node, ...props}) => <ul className="ml-4 list-disc" style={{ color: "var(--m-text)" }} {...props} />,
          ol: ({node, ...props}) => <ol className="ml-4 list-decimal" style={{ color: "var(--m-text)" }} {...props} />,
          li: ({node, ...props}) => <li className="" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-3 pl-3 italic my-2 py-1 rounded-r-lg" style={{ borderColor: "var(--m-primary)", backgroundColor: "var(--m-surface-alt)", color: "var(--m-text-sub)" }} {...props} />,
          hr: ({node, ...props}) => <hr className="my-4" style={{ borderColor: "var(--m-border-light)" }} {...props} />,
          p: ({node, ...props}) => <p style={{ color: "var(--m-text)" }} {...props} />,
          a: ({node, ...props}) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
          pre: ({node, ...props}) => <pre className="bg-[#1e1e1e] text-white p-3 rounded-lg overflow-x-auto text-[11px] mt-2 mb-2 custom-scrollbar shadow-sm" {...props} />,
          code: ({node, className, ...props}: any) => <code className={`${className || ''} bg-black/5 dark:bg-white/10 rounded-md px-1.5 py-0.5 text-[10.5px] font-mono`} {...props} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toDateKey(d));
  }
  return days;
}

/** Format a date key to short label like "Mon 4" */
function formatDayLabel(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = d.getDate();
  return `${dayName} ${dayNum}`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatStudyTime(minutes: number) {
  if (!minutes) return "0m";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ""}` : `${remainder}m`;
}

/** Days until a deadline */
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T23:59:59");
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Urgency color for deadlines */
function deadlineColor(days: number): string {
  if (days < 0) return "#8b3a30";
  if (days <= 1) return "#e74c3c";
  if (days <= 3) return "#f39c12";
  return "#27ae60";
}

interface DashboardProps {
  accessToken: string;
  userId: string;
  userEmail: string;
  userName?: string;
  userImageUrl?: string;
  onSignOut: () => void;
}

export default function Dashboard({ accessToken, userId, userEmail, userName, userImageUrl, onSignOut }: DashboardProps) {
  // ─── Main Data States ───
  const tasks = useAppStore((state) => state.tasks);
  const setTasks = useAppStore((state) => state.setTasks);
  const scheduleItems = useAppStore((state) => state.scheduleItems);
  const setScheduleItems = useAppStore((state) => state.setScheduleItems);
  const subjects = useAppStore((state) => state.subjects);
  const setSubjects = useAppStore((state) => state.setSubjects);
  const notes = useAppStore((state) => state.notes);
  const setNotes = useAppStore((state) => state.setNotes);
  const grades = useAppStore((state) => state.grades);
  const setGrades = useAppStore((state) => state.setGrades);
  const flashcards = useAppStore((state) => state.flashcards);
  const setFlashcards = useAppStore((state) => state.setFlashcards);
  const [studyMinutes, setStudyMinutes] = useState<number[]>(Array(7).fill(0));
  const [focusLog, setFocusLog] = useState<FocusLogEntry[]>([]);
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0, longestStreak: 0, lastActiveDate: "",
    totalXP: 0, level: 1, tasksCompleted: 0, focusSessionsCompleted: 0, flashcardsStudied: 0,
  });
  const [finance, setFinance] = useState<FinanceData | undefined>(undefined);

  // ─── Sync & Status ───
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ─── Toast Notification ───
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── Navigation ───
  type NavItem = "Today" | "Planner" | "Projects" | "Focus" | "Notes" | "Grades" | "Cards" | "Money";
  const [activeNav, setActiveNav] = useState<NavItem>("Today");
  const [selectedSubject, setSelectedSubject] = useState("All subjects");
  const [taskFilterStatus, setTaskFilterStatus] = useState<"all" | "active" | "completed">("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  // ─── Modals ───
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);

  // ─── File Attachments ───
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [filesModalSubject, setFilesModalSubject] = useState<Subject | null>(null);

  // ─── Task Form ───
  const [taskDraft, setTaskDraft] = useState("");
  const [taskCourse, setTaskCourse] = useState("");
  const [taskTime, setTaskTime] = useState("10:00 AM");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [taskDeadline, setTaskDeadline] = useState("");

  // ─── Autopilot ───
  const [autopilotText, setAutopilotText] = useState("");
  const [isSubmittingAutopilot, setIsSubmittingAutopilot] = useState(false);
  const [autopilotRuns, setAutopilotRuns] = useState<{
    id: string;
    timestamp: string;
    status: "extracting" | "planning" | "executing" | "done" | "error";
    extractedItems: { title: string; type: string; priority: string; deadline?: string; time?: string; course?: string }[];
    createdTasks: string[];
    createdSchedule: string[];
    errorMsg?: string;
  }[]>([]);

  // ─── Schedule Form ───
  const [planTitle, setPlanTitle] = useState("");
  const [planTime, setPlanTime] = useState("09:00");
  const [planNote, setPlanNote] = useState("");
  const [planCourse, setPlanCourse] = useState("");

  // ─── Subject Form ───
  const [subjectDraft, setSubjectDraft] = useState("");
  const [subjectColor, setSubjectColor] = useState("#c8d9e9");
  const [subjectDesc, setSubjectDesc] = useState("");

  // ─── Pomodoro ───
  const [timerPreset, setTimerPreset] = useState<number>(25);
  const [seconds, setSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [pomodoroSession, setPomodoroSession] = useState(0);
  const [isBreak, setIsBreak] = useState(false);

  // ─── AI Chat — Dream It AI ───
  const DEFAULT_WELCOME: Message = {
    role: "assistant",
    content: "Welcome! I'm **Dream It AI**, your intelligent study assistant.\n\nAsk me study questions, math problems, code debugging, or attach files — I'm here to help you excel!",
  };
  const [messages, setMessages] = useState<Message[]>([DEFAULT_WELCOME]);
  const [chatDraft, setChatDraft] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatSubjectId, setChatSubjectId] = useState<number | null>(null);
  const [isChatMaximized, setIsChatMaximized] = useState(false);
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatMaxContainerRef = useRef<HTMLDivElement>(null);


  // ─── AI File Attachment ───
  const [chatFile, setChatFile] = useState<{
    name: string; size: number; type: string; content: string; isImage?: boolean;
  } | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // ─── Notes State ───
  const activeNote = useAppStore((state) => state.activeNote);
  const setActiveNote = useAppStore((state) => state.setActiveNote);
  const noteDraft = useAppStore((state) => state.noteDraft);
  const setNoteDraft = useAppStore((state) => state.setNoteDraft);
  const noteTitleDraft = useAppStore((state) => state.noteTitleDraft);
  const setNoteTitleDraft = useAppStore((state) => state.setNoteTitleDraft);
  const noteSubjectFilter = useAppStore((state) => state.noteSubjectFilter);
  const setNoteSubjectFilter = useAppStore((state) => state.setNoteSubjectFilter);
  const noteSubjectId = useAppStore((state) => state.noteSubjectId);
  const setNoteSubjectId = useAppStore((state) => state.setNoteSubjectId);
  const noteSearchQuery = useAppStore((state) => state.noteSearchQuery);
  const setNoteSearchQuery = useAppStore((state) => state.setNoteSearchQuery);
  const noteMode = useAppStore((state) => state.noteMode);
  const setNoteMode = useAppStore((state) => state.setNoteMode);
  const isSummarizingNote = useAppStore((state) => state.isSummarizingNote);
  const setIsSummarizingNote = useAppStore((state) => state.setIsSummarizingNote);
  const noteTextAreaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Inbox / Sharing State ───
  const [inboxOpen, setInboxOpen] = useState(false);
  const pendingShares = useAppStore((state) => state.pendingShares);
  const setPendingShares = useAppStore((state) => state.setPendingShares);
  const [shareNoteModalOpen, setShareNoteModalOpen] = useState(false);
  const [noteToShare, setNoteToShare] = useState<NoteEntry | null>(null);
  const [shareRecipientIdentifier, setShareRecipientIdentifier] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  // ─── Friends System ───
  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const friends = useAppStore((state) => state.friends);
  const setFriends = useAppStore((state) => state.setFriends);
  const pendingFriendRequests = useAppStore((state) => state.pendingFriendRequests);
  const setPendingFriendRequests = useAppStore((state) => state.setPendingFriendRequests);
  const [addFriendDraft, setAddFriendDraft] = useState("");
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // ─── Grades State ───
  const [gradeForm, setGradeForm] = useState({ subjectId: 0, name: "", score: "", total: "", weight: "" });

  // ─── Flashcards State ───
  const [cardForm, setCardForm] = useState({ subjectId: 0, front: "", back: "" });
  const [studyingCards, setStudyingCards] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [cardSubjectFilter, setCardSubjectFilter] = useState<number | null>(null);

  // ─── Theme (via ThemeContext) ───
  const { theme: currentThemeId, themeConfig, isDark: darkMode } = useTheme();
  
  // ─── Profile Modal ───
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // ─── Derived User Display ───
  const userNameDisplay = useMemo(() => {
    if (userName) return userName;
    if (!userEmail) return "Student";
    const namePart = userEmail.split("@")[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }, [userName, userEmail]);

  // ─── XP Helper ───
  const addXP = useCallback((amount: number) => {
    setStreak((prev) => {
      const newXP = prev.totalXP + amount;
      const newLevel = calculateLevel(newXP);
      return { ...prev, totalXP: newXP, level: newLevel };
    });
  }, []);

  // ─── Update Streak on Activity ───
  const updateDailyStreak = useCallback(() => {
    const todayKey = toDateKey(new Date());
    setStreak((prev) => {
      if (prev.lastActiveDate === todayKey) return prev;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = toDateKey(yesterday);
      const newStreak = prev.lastActiveDate === yesterdayKey ? prev.currentStreak + 1 : 1;
      return {
        ...prev,
        currentStreak: newStreak,
        longestStreak: Math.max(prev.longestStreak, newStreak),
        lastActiveDate: todayKey,
      };
    });
  }, []);

  // ─── Auto-scroll chat ───
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    if (chatMaxContainerRef.current) {
      chatMaxContainerRef.current.scrollTop = chatMaxContainerRef.current.scrollHeight;
    }
  }, [messages, isAsking, isChatMaximized]);

  // ─── Load workspace ───
  useEffect(() => {
    let alive = true;
    setWorkspaceReady(false);
    fetchUserWorkspace(accessToken, userId)
      .then((workspace) => {
        if (!alive) return;
        if (workspace) {
          setTasks(Array.isArray(workspace.tasks) ? workspace.tasks : []);
          setScheduleItems(Array.isArray(workspace.scheduleItems) ? workspace.scheduleItems : []);
          setSubjects(Array.isArray(workspace.subjects) ? workspace.subjects : []);
          setStudyMinutes(
            Array.isArray(workspace.studyMinutes) && workspace.studyMinutes.length === 7
              ? workspace.studyMinutes
              : Array(7).fill(0)
          );
          setFocusLog(Array.isArray(workspace.focusLog) ? workspace.focusLog : []);
          setNotes(Array.isArray(workspace.notes) ? workspace.notes : []);
          setGrades(Array.isArray(workspace.grades) ? workspace.grades : []);
          setFlashcards(Array.isArray(workspace.flashcards) ? workspace.flashcards : []);
          if (workspace.streak) setStreak(workspace.streak);
          if (workspace.finance) setFinance(workspace.finance);
          // Check if truly new user (all empty)
          if (
            (!workspace.tasks || workspace.tasks.length === 0) &&
            (!workspace.subjects || workspace.subjects.length === 0) &&
            (!workspace.notes || workspace.notes.length === 0)
          ) {
            setShowOnboarding(true);
          }
        } else {
          // Brand new user — completely empty workspace
          const empty = createEmptyWorkspace();
          setTasks(empty.tasks);
          setScheduleItems(empty.scheduleItems);
          setSubjects(empty.subjects);
          setStudyMinutes(empty.studyMinutes);
          setFocusLog(empty.focusLog!);
          setNotes(empty.notes!);
          setGrades(empty.grades!);
          setFlashcards(empty.flashcards!);
          setStreak(empty.streak!);
          setFinance(empty.finance);
          setShowOnboarding(true);
        }
      })
      .catch((err) => console.warn("Failed loading workspace:", err))
      .finally(() => {
        if (alive) setWorkspaceReady(true);
      });

    return () => { alive = false; };
  }, [accessToken, userId]);

  // ─── Load file attachments ───
  useEffect(() => {
    let alive = true;
    fetchUserFiles(accessToken, userId)
      .then((files) => { if (alive) setAttachedFiles(files); })
      .catch((err) => console.warn("Failed fetching user files:", err));
    return () => { alive = false; };
  }, [accessToken, userId]);

  // ─── Load Inbox & Friends ───
  const checkInbox = useCallback(async () => {
    if (!userNameDisplay && !userEmail) return;
    const [shares, requests, unreadCount] = await Promise.all([
      fetchPendingShares(userNameDisplay, userEmail),
      fetchPendingFriendRequests(userNameDisplay, userEmail),
      userId ? fetchUnreadMessageCount(userId) : Promise.resolve(0)
    ]);
    setPendingShares(shares);
    setPendingFriendRequests(requests);
    setUnreadMessageCount(unreadCount);
  }, [userNameDisplay, userEmail, userId]);

  const loadFriends = useCallback(async () => {
    if (!userId) return;
    const f = await fetchFriends(userId);
    setFriends(f);
  }, [userId]);

  // ─── Auto-sync Profile Picture ───
  useEffect(() => {
    if (userId && userNameDisplay) {
      upsertUserProfile(userId, userNameDisplay, userImageUrl);
    }
  }, [userId, userNameDisplay, userImageUrl]);

  useEffect(() => {
    checkInbox();
    loadFriends();
    
    // Poll every 30 seconds for new notes & requests
    const interval = window.setInterval(checkInbox, 30000);
    
    // Listen for real-time messages when modal is closed
    let unsubscribe: () => void = () => {};
    if (userId) {
      unsubscribe = subscribeToDirectMessages(userId, (newMsg) => {
        // If we receive a new message directed at us, update inbox count
        if (newMsg.receiver_id === userId && !newMsg.is_read) {
          checkInbox();
        }
      });
    }

    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [checkInbox, loadFriends, userId]);

  // ─── Auto-save workspace (debounced) ───
  useEffect(() => {
    if (!workspaceReady) return;
    setIsSaving(true);
    const saveTimer = window.setTimeout(async () => {
      const payload: UserWorkspace = {
        tasks, scheduleItems, subjects, studyMinutes, focusLog,
        notes, grades, flashcards, streak, finance
      };
      await saveUserWorkspace(accessToken, userId, payload);
      setIsSaving(false);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 800);
    return () => window.clearTimeout(saveTimer);
  }, [accessToken, userId, workspaceReady, tasks, scheduleItems, subjects, studyMinutes, focusLog, notes, grades, flashcards, streak, finance]);

  // ─── Pomodoro ───
  useEffect(() => {
    if (!isRunning || seconds === 0) return;
    const timer = window.setInterval(() => setSeconds((val) => val - 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, seconds]);

  useEffect(() => {
    if (seconds !== 0 || !isRunning) return;
    setIsRunning(false);

    if (isBreak) {
      // Break over — back to focus
      setIsBreak(false);
      setSeconds(timerPreset * 60);
      showToast("Break's over! Ready for another focus session? 🎯", "info");
      return;
    }

    // Focus session complete!
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });

    const todayIndex = (new Date().getDay() + 6) % 7;
    setStudyMinutes((curr) =>
      curr.map((m, idx) => (idx === todayIndex ? m + timerPreset : m))
    );

    const todayKey = toDateKey(new Date());
    setFocusLog((prev) => {
      const existing = prev.find((e) => e.date === todayKey);
      if (existing) return prev.map((e) => e.date === todayKey ? { ...e, minutes: e.minutes + timerPreset } : e);
      return [...prev, { date: todayKey, minutes: timerPreset }];
    });

    // XP & streak
    addXP(timerPreset * 2);
    updateDailyStreak();
    setStreak((p) => ({ ...p, focusSessionsCompleted: p.focusSessionsCompleted + 1 }));

    const newSession = pomodoroSession + 1;
    setPomodoroSession(newSession);

    // Auto-start break
    const breakTime = newSession % 4 === 0 ? 15 : 5;
    setIsBreak(true);
    setSeconds(breakTime * 60);
    showToast(`🎉 Focus session complete! Starting ${breakTime}min break...`, "success");
  }, [seconds, isRunning, timerPreset, isBreak, pomodoroSession, addXP, updateDailyStreak, showToast]);

  const changeTimerPreset = (mins: number) => {
    setTimerPreset(mins);
    setSeconds(mins * 60);
    setIsRunning(false);
    setIsBreak(false);
  };

  // ─── Computations ───
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchSubject = selectedSubject === "All subjects" || task.course === selectedSubject;
      const matchStatus = taskFilterStatus === "all" ? true : taskFilterStatus === "active" ? !task.done : task.done;
      return matchSubject && matchStatus;
    });
  }, [tasks, selectedSubject, taskFilterStatus]);

  const completeCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length ? Math.round((completeCount / tasks.length) * 100) : 0;
  const totalSeconds = (isBreak ? (pomodoroSession % 4 === 0 ? 15 : 5) : timerPreset) * 60;
  const focusProgress = Math.round(((totalSeconds - seconds) / totalSeconds) * 100);
  const circleDash = 314 - (314 * focusProgress) / 100;

  const [weeklyGoalHours, setWeeklyGoalHours] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dreamit_weekly_goal_hours") || localStorage.getItem("morrow_weekly_goal_hours");
      if (saved) return parseInt(saved, 10) || 12;
    }
    return 12;
  });

  const last7Days = useMemo(() => getLast7Days(), []);
  const graphData = useMemo(() => last7Days.map((dateKey) => {
    const entry = focusLog.find((e) => e.date === dateKey);
    return { dateKey, label: formatDayLabel(dateKey), minutes: entry ? entry.minutes : 0, isToday: dateKey === toDateKey(new Date()) };
  }), [last7Days, focusLog]);

  const graphMaxMinutes = useMemo(() => Math.max(...graphData.map((d) => d.minutes), 300), [graphData]);
  const totalLoggedMinutes = useMemo(() => graphData.reduce((sum, d) => sum + d.minutes, 0), [graphData]);
  const weeklyStudyMinutes = totalLoggedMinutes;
  const focusTargetMinutes = weeklyGoalHours * 60;
  const targetProgress = focusTargetMinutes > 0 ? Math.min(100, Math.round((weeklyStudyMinutes / focusTargetMinutes) * 100)) : 0;
  const totalSessions = useMemo(() => Math.ceil(totalLoggedMinutes / 25), [totalLoggedMinutes]);
  const todayMinutes = useMemo(() => {
    const todayEntry = focusLog.find((e) => e.date === toDateKey(new Date()));
    return todayEntry ? todayEntry.minutes : 0;
  }, [focusLog]);
  const streakDays = useMemo(() => {
    let s = 0;
    for (let i = graphData.length - 1; i >= 0; i--) {
      if (graphData[i].minutes > 0) s++;
      else break;
    }
    return s;
  }, [graphData]);

  const dayGreeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, []);

  // Upcoming deadlines
  const upcomingDeadlines = useMemo(() => {
    return tasks
      .filter((t) => t.deadline && !t.done)
      .map((t) => ({ ...t, daysLeft: daysUntil(t.deadline!) }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [tasks]);

  // Grade calculations
  const subjectGPAs = useMemo(() => {
    const gpas: Record<number, { weighted: number; totalWeight: number }> = {};
    grades.forEach((g) => {
      if (!gpas[g.subjectId]) gpas[g.subjectId] = { weighted: 0, totalWeight: 0 };
      const pct = g.total > 0 ? (g.score / g.total) * 100 : 0;
      gpas[g.subjectId].weighted += pct * g.weight;
      gpas[g.subjectId].totalWeight += g.weight;
    });
    const result: Record<number, number> = {};
    Object.entries(gpas).forEach(([id, val]) => {
      result[Number(id)] = val.totalWeight > 0 ? Math.round(val.weighted / val.totalWeight) : 0;
    });
    return result;
  }, [grades]);

  const overallGPA = useMemo(() => {
    const vals = Object.values(subjectGPAs);
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [subjectGPAs]);

  // Filtered flashcards for study
  const studyCards = useMemo(() => {
    if (cardSubjectFilter) return flashcards.filter((c) => c.subjectId === cardSubjectFilter);
    return flashcards;
  }, [flashcards, cardSubjectFilter]);

  // ─── Actions: Tasks ───
  const addTask = (e: FormEvent) => {
    e.preventDefault();
    if (!taskDraft.trim()) return;
    const assignedCourse = taskCourse.trim() || (selectedSubject !== "All subjects" ? selectedSubject : "General Study");
    const matchedSubject = subjects.find((s) => s.name.toLowerCase() === assignedCourse.toLowerCase());
    const color = matchedSubject ? matchedSubject.color : "#c8d9e9";

    const newTask: Task = {
      id: Date.now(),
      title: taskDraft.trim(),
      course: assignedCourse,
      time: taskTime || "Today",
      done: false,
      color,
      priority: taskPriority,
      createdAt: new Date().toISOString(),
      deadline: taskDeadline || undefined,
    };

    setTasks((curr) => [newTask, ...curr]);
    setTaskDraft("");
    setTaskDeadline("");
    addXP(5);
    updateDailyStreak();
    showToast("Task added! 📝");
  };

  const toggleTask = (id: number) => {
    setTasks((curr) =>
      curr.map((item) => {
        if (item.id === id) {
          const updatedDone = !item.done;
          if (updatedDone) {
            confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
            addXP(15);
            setStreak((p) => ({ ...p, tasksCompleted: p.tasksCompleted + 1 }));
            showToast("Task completed! +15 XP 🎉");
          }
          return { ...item, done: updatedDone };
        }
        return item;
      })
    );
  };

  const deleteTask = (id: number) => setTasks((curr) => curr.filter((t) => t.id !== id));

  // ─── Actions: Schedule ───
  const addScheduleItem = (e: FormEvent) => {
    e.preventDefault();
    if (!planTitle.trim()) return;
    const assignedCourse = planCourse || (selectedSubject !== "All subjects" ? selectedSubject : "");
    const toneOptions = ["bg-[#b9d6c0]", "bg-[#f2cf91]", "bg-[#e2d6ee]", "bg-[#c8d9e9]"];
    const tone = toneOptions[scheduleItems.length % toneOptions.length];

    const newItem: ScheduleItem = {
      id: Date.now(),
      time: planTime,
      title: planTitle.trim(),
      note: planNote.trim() || "Planned study session",
      tone,
      course: assignedCourse,
      done: false,
    };

    setScheduleItems((curr) => [...curr, newItem].sort((a, b) => a.time.localeCompare(b.time)));
    setPlanTitle("");
    setPlanNote("");
    showToast("Schedule block added! 📅");
  };

  const toggleScheduleDone = (id?: number, title?: string) => {
    setScheduleItems((curr) =>
      curr.map((item) => {
        if ((id && item.id === id) || (!id && item.title === title)) return { ...item, done: !item.done };
        return item;
      })
    );
  };

  const deleteScheduleItem = (id?: number, title?: string) => {
    setScheduleItems((curr) =>
      curr.filter((item) => {
        if (id && item.id === id) return false;
        if (!id && item.title === title) return false;
        return true;
      })
    );
  };

  // ─── Actions: Subjects ───
  const addSubject = (e: FormEvent) => {
    e.preventDefault();
    const name = subjectDraft.trim();
    if (!name || subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;

    const newSubject: Subject = {
      id: Date.now(),
      name,
      color: subjectColor,
      accent: "#244c3b",
      description: subjectDesc.trim() || "Course workspace",
    };

    setSubjects((curr) => [...curr, newSubject]);
    setTaskCourse(name);
    setSelectedSubject(name);
    setSubjectDraft("");
    setSubjectDesc("");
    setSubjectsOpen(false);
    showToast(`Project "${name}" created! 📂`);
  };

  const updateSubject = (e: FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    setSubjects((curr) => curr.map((s) => (s.id === editingSubject.id ? editingSubject : s)));
    setEditingSubject(null);
    showToast("Project updated!");
  };

  const deleteSubject = (subjectId: number) => {
    const sub = subjects.find((s) => s.id === subjectId);
    setSubjects((curr) => curr.filter((s) => s.id !== subjectId));
    if (sub && selectedSubject === sub.name) setSelectedSubject("All subjects");
  };

  // ─── Actions: Notes ───
  const createNewNote = () => {
    const defaultSubId = noteSubjectFilter || (subjects.length > 0 ? subjects[0].id : 0);
    const newNote: NoteEntry = {
      id: crypto.randomUUID(),
      subjectId: defaultSubId,
      title: "",
      content: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((curr) => [newNote, ...curr]);
    setActiveNote(newNote);
    setNoteTitleDraft("");
    setNoteDraft("");
    setNoteSubjectId(defaultSubId);
    setNoteMode("edit");
    addXP(5);
    showToast("New note created! Type a title 📓");
  };

  const selectNote = (note: NoteEntry) => {
    setActiveNote(note);
    setNoteTitleDraft(note.title);
    setNoteDraft(note.content);
    setNoteSubjectId(note.subjectId);
    setNoteMode("edit");
  };

  const handleTitleChange = (val: string) => {
    setNoteTitleDraft(val);
    if (activeNote) {
      setNotes((curr) => curr.map((n) => (n.id === activeNote.id ? { ...n, title: val, updatedAt: new Date().toISOString() } : n)));
      setActiveNote((curr) => (curr ? { ...curr, title: val } : null));
    }
  };

  const handleContentChange = (val: string) => {
    setNoteDraft(val);
    if (activeNote) {
      setNotes((curr) => curr.map((n) => (n.id === activeNote.id ? { ...n, content: val, updatedAt: new Date().toISOString() } : n)));
      setActiveNote((curr) => (curr ? { ...curr, content: val } : null));
    }
  };

  const handleSubjectChange = (newSubId: number) => {
    setNoteSubjectId(newSubId);
    if (activeNote) {
      setNotes((curr) => curr.map((n) => (n.id === activeNote.id ? { ...n, subjectId: newSubId, updatedAt: new Date().toISOString() } : n)));
      setActiveNote((curr) => (curr ? { ...curr, subjectId: newSubId } : null));
    }
  };

  const saveNote = () => {
    const titleToSave = noteTitleDraft.trim() || "Untitled Note";
    const subIdToSave = noteSubjectId || (subjects.length > 0 ? subjects[0].id : 0);

    if (activeNote) {
      const updatedNote: NoteEntry = {
        ...activeNote,
        title: titleToSave,
        content: noteDraft,
        subjectId: subIdToSave,
        updatedAt: new Date().toISOString(),
      };
      setNotes((curr) => curr.map((n) => (n.id === activeNote.id ? updatedNote : n)));
      setActiveNote(updatedNote);
      showToast("Note saved! 📓");
    } else {
      const newNote: NoteEntry = {
        id: crypto.randomUUID(),
        subjectId: subIdToSave,
        title: titleToSave,
        content: noteDraft,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setNotes((curr) => [newNote, ...curr]);
      setActiveNote(newNote);
      addXP(5);
      showToast("Note created! 📓");
    }
  };

  const handleShareNoteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteToShare || !shareRecipientIdentifier.trim()) return;
    setIsSharing(true);
    const success = await shareNote(
      userId,
      userNameDisplay,
      shareRecipientIdentifier,
      noteToShare.title || "Untitled Note",
      noteToShare.content
    );
    setIsSharing(false);
    if (success) {
      showToast(`Note sent to ${shareRecipientIdentifier}!`);
      setShareNoteModalOpen(false);
      setShareRecipientIdentifier("");
      setNoteToShare(null);
    } else {
      showToast("Failed to send note. Please try again.", "error");
    }
  };

  const handleAcceptShare = async (share: SharedNote) => {
    const defaultSubId = subjects.length > 0 ? subjects[0].id : 0;
    const newNote: NoteEntry = {
      id: crypto.randomUUID(),
      subjectId: defaultSubId,
      title: share.note_title,
      content: share.note_content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setNotes(curr => [newNote, ...curr]);
    showToast(`Note "${share.note_title}" saved to your workspace!`);
    
    await respondToShare(share.id, 'accepted');
    setPendingShares(curr => curr.filter(s => s.id !== share.id));
  };

  const handleDeclineShare = async (share: SharedNote) => {
    await respondToShare(share.id, 'rejected');
    setPendingShares(curr => curr.filter(s => s.id !== share.id));
    showToast("Note declined.");
  };

  const handleSendFriendRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!addFriendDraft.trim()) return;
    setIsAddingFriend(true);
    const success = await sendFriendRequest(userId, userNameDisplay, addFriendDraft);
    setIsAddingFriend(false);
    if (success) {
      showToast(`Friend request sent to ${addFriendDraft}!`);
      setAddFriendDraft("");
    } else {
      showToast("Failed to send friend request.", "error");
    }
  };

  const handleAcceptFriendRequest = async (req: Friendship) => {
    const success = await respondToFriendRequest(req.id, 'accepted', userId, userNameDisplay);
    if (success) {
      showToast(`You are now friends with ${req.requester_identifier}!`);
      setPendingFriendRequests(curr => curr.filter(r => r.id !== req.id));
      loadFriends();
    }
  };

  const handleDeclineFriendRequest = async (req: Friendship) => {
    await respondToFriendRequest(req.id, 'rejected', userId, userNameDisplay);
    setPendingFriendRequests(curr => curr.filter(r => r.id !== req.id));
    showToast("Friend request declined.");
  };

  const deleteNote = (id: string) => {
    setNotes((curr) => curr.filter((n) => n.id !== id));
    if (activeNote?.id === id) {
      setActiveNote(null);
      setNoteTitleDraft("");
      setNoteDraft("");
      setNoteSubjectId(0);
    }
    showToast("Note deleted");
  };

  const insertFormatting = (prefix: string, suffix: string = "") => {
    if (!noteTextAreaRef.current) {
      setNoteDraft((curr) => curr + `${prefix}text${suffix}`);
      return;
    }
    const textarea = noteTextAreaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = noteDraft.substring(start, end);
    const replacement = `${prefix}${selectedText || "text"}${suffix}`;
    const newContent = noteDraft.substring(0, start) + replacement + noteDraft.substring(end);
    setNoteDraft(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selectedText.length || 4));
    }, 50);
  };

  const summarizeNoteWithAI = async () => {
    if (!noteDraft.trim()) {
      showToast("Note is empty! Add content first.", "info");
      return;
    }
    setIsSummarizingNote(true);
    showToast("Dream It AI is summarizing your note...", "info");
    try {
      const res = await fetchAI({
        model: "gemini-3.5-flash-lite",
        messages: [{
          role: "user",
          content: `Please summarize the following study note into bullet points with key takeaways:\n\nNote Title: ${noteTitleDraft}\n\nContent:\n${noteDraft}`,
        }],
        temperature: 0.3,
        max_tokens: 1000,
      });

      if (!res.error && res.content) {
        const summarySection = `\n\n---\n### 💡 AI Key Summary\n${res.content.trim()}\n`;
        setNoteDraft((curr) => curr + summarySection);
        showToast("AI Summary added to note! ✨");
        setIsSummarizingNote(false);
        addXP(5);
        return;
      }
    } catch (e) {
      console.warn("AI summarize error:", e);
    }
    setIsSummarizingNote(false);
    showToast("Could not generate summary right now.", "error");
  };

  // ─── Actions: Grades ───
  const addGrade = (e: FormEvent) => {
    e.preventDefault();
    if (!gradeForm.name || !gradeForm.score || !gradeForm.total || !gradeForm.subjectId) return;
    const newGrade: GradeEntry = {
      id: crypto.randomUUID(),
      subjectId: gradeForm.subjectId,
      assignmentName: gradeForm.name,
      score: parseFloat(gradeForm.score),
      total: parseFloat(gradeForm.total),
      weight: parseFloat(gradeForm.weight) || 100,
      createdAt: new Date().toISOString(),
    };
    setGrades((curr) => [...curr, newGrade]);
    setGradeForm({ subjectId: gradeForm.subjectId, name: "", score: "", total: "", weight: "" });
    addXP(5);
    showToast("Grade recorded! 📊");
  };

  // ─── Actions: Flashcards ───
  const addFlashcard = (e: FormEvent) => {
    e.preventDefault();
    if (!cardForm.front.trim() || !cardForm.back.trim() || !cardForm.subjectId) return;
    const newCard: Flashcard = {
      id: crypto.randomUUID(),
      subjectId: cardForm.subjectId,
      front: cardForm.front.trim(),
      back: cardForm.back.trim(),
      difficulty: "medium",
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    };
    setFlashcards((curr) => [...curr, newCard]);
    setCardForm({ ...cardForm, front: "", back: "" });
    addXP(3);
    showToast("Flashcard created! 🃏");
  };

  const markCardReviewed = (difficulty: "easy" | "medium" | "hard") => {
    if (studyCards.length === 0) return;
    const card = studyCards[currentCardIndex];
    setFlashcards((curr) => curr.map((c) =>
      c.id === card.id
        ? { ...c, difficulty, reviewCount: c.reviewCount + 1, lastReviewed: new Date().toISOString() }
        : c
    ));
    addXP(difficulty === "hard" ? 5 : difficulty === "medium" ? 3 : 1);
    setStreak((p) => ({ ...p, flashcardsStudied: p.flashcardsStudied + 1 }));
    setCardFlipped(false);
    if (currentCardIndex < studyCards.length - 1) {
      setCurrentCardIndex((i) => i + 1);
    } else {
      setStudyingCards(false);
      setCurrentCardIndex(0);
      showToast(`🎉 All ${studyCards.length} cards reviewed!`);
    }
  };

  // ─── Actions: Export ───
  const exportDataJSON = () => {
    const payload: UserWorkspace = { tasks, scheduleItems, subjects, studyMinutes, focusLog, notes, grades, flashcards, streak };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dreamit-backup-${toDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Data exported as JSON! 📦");
  };

  const exportTasksCSV = () => {
    const headers = "Title,Course,Priority,Status,Time,Deadline,Created\n";
    const rows = tasks.map((t) =>
      `"${t.title}","${t.course}","${t.priority || "medium"}","${t.done ? "Done" : "Active"}","${t.time}","${t.deadline || ""}","${t.createdAt || ""}"`
    ).join("\n")
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dreamit-tasks-${toDateKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Tasks exported as CSV! 📋");
  };

  // ─── File handling ───
  const handleUploadSuccess = (newFile: AttachedFile) => {
    setAttachedFiles((curr) => [...curr.filter((f) => f.id !== newFile.id), newFile]);
    showToast(`Uploaded "${newFile.fileName}" ✅`);
  };

  const handleAutopilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autopilotText.trim()) return;

    setIsSubmittingAutopilot(true);
    const runId = `run-${Date.now()}`;
    const runEntry = {
      id: runId,
      timestamp: new Date().toISOString(),
      status: "extracting" as const,
      extractedItems: [] as { title: string; type: string; priority: string; deadline?: string; time?: string; course?: string }[],
      createdTasks: [] as string[],
      createdSchedule: [] as string[],
    };
    setAutopilotRuns((prev) => [runEntry, ...prev]);

    const extractionPrompt = `You are an AI tasked with extracting tasks and schedule items from the following raw text. 
Please output ONLY a valid JSON array of objects.
Each object must have the following fields:
- "title": A short, descriptive title of the task or event.
- "type": Either "task" or "event".
- "priority": Either "High", "Medium", or "Low".
- "deadline": (Optional) The deadline or date of the event if applicable.
- "time": (Optional) The time of the event if applicable.
- "course": (Optional) The relevant subject or course name if mentioned.

Here is the raw text to analyze:
"${autopilotText}"`;

    try {
      const response = await fetchAI({
        model: "gemini-3.6-flash",
        messages: [{ role: "user", content: extractionPrompt }],
        max_tokens: 2048,
        temperature: 0.2,
      });

      if (response.error) {
        throw new Error(`Gemini API error: ${response.error}`);
      }

      const rawText = response.content || "[]";
      
      // Parse JSON — handle markdown-wrapped responses
      let cleaned = rawText.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      
      let items: { title: string; type: string; priority: string; deadline?: string; time?: string; course?: string }[];
      try {
        items = JSON.parse(cleaned);
        if (!Array.isArray(items)) items = [];
      } catch {
        items = [];
      }

      // Update run with extracted items
      setAutopilotRuns((prev) =>
        prev.map((r) => r.id === runId ? { ...r, status: "planning" as const, extractedItems: items } : r)
      );

      if (items.length === 0) {
        setAutopilotRuns((prev) =>
          prev.map((r) => r.id === runId ? { ...r, status: "done" as const, errorMsg: "No actionable items found in the text." } : r)
        );
        setAutopilotText("");
        setIsSubmittingAutopilot(false);
        showToast("No actionable items found.", "info");
        return;
      }

      // Stage B: Execute — create tasks and schedule items
      setAutopilotRuns((prev) =>
        prev.map((r) => r.id === runId ? { ...r, status: "executing" as const } : r)
      );

      const toneOptions = ["bg-[#b9d6c0]", "bg-[#f2cf91]", "bg-[#e2d6ee]", "bg-[#c8d9e9]"];
      const createdTaskNames: string[] = [];
      const createdScheduleNames: string[] = [];
      const newTasks: Task[] = [];
      const newScheduleItems: ScheduleItem[] = [];

      for (const item of items) {
        const courseName = item.course || "General Study";
        const matchedSubject = subjects.find((s) => s.name.toLowerCase() === courseName.toLowerCase());
        const color = matchedSubject ? matchedSubject.color : "#c8d9e9";

        if (item.type === "schedule") {
          const schedItem: ScheduleItem = {
            id: Date.now() + Math.random() * 1000,
            time: item.time || "10:00",
            title: item.title,
            note: `Auto-created by Autopilot • ${item.priority} priority`,
            tone: toneOptions[newScheduleItems.length % toneOptions.length],
            course: courseName,
            done: false,
            createdBy: "agent",
            agentRunId: runId,
          };
          newScheduleItems.push(schedItem);
          createdScheduleNames.push(item.title);
        } else {
          const task: Task = {
            id: Date.now() + Math.random() * 1000,
            title: item.title,
            course: courseName,
            time: item.time || "Today",
            done: false,
            color,
            priority: (item.priority as "low" | "medium" | "high") || "medium",
            createdAt: new Date().toISOString(),
            deadline: item.deadline || undefined,
            createdBy: "agent",
            agentRunId: runId,
          };
          newTasks.push(task);
          createdTaskNames.push(item.title);
        }
      }

      // Batch-add to state
      if (newTasks.length > 0) {
        setTasks((curr) => [...newTasks, ...curr]);
      }
      if (newScheduleItems.length > 0) {
        setScheduleItems((curr) => [...curr, ...newScheduleItems].sort((a, b) => a.time.localeCompare(b.time)));
      }

      // Mark run as complete
      setAutopilotRuns((prev) =>
        prev.map((r) => r.id === runId ? { ...r, status: "done" as const, createdTasks: createdTaskNames, createdSchedule: createdScheduleNames } : r)
      );

      setAutopilotText("");
      addXP(items.length * 5);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      showToast(`Autopilot created ${newTasks.length} task(s) and ${newScheduleItems.length} schedule block(s)! ✨`);

    } catch (err: any) {
      setAutopilotRuns((prev) =>
        prev.map((r) => r.id === runId ? { ...r, status: "error" as const, errorMsg: err?.message || "Unknown error" } : r)
      );
      showToast("Autopilot failed. Check the activity log.", "error");
    } finally {
      setIsSubmittingAutopilot(false);
    }
  };

  const handleDownloadFile = async (file: AttachedFile) => {
    try {
      const url = await getFileDownloadUrl(accessToken, userId, file.id, file.storagePath);
      window.open(url, "_blank");
    } catch (err: any) {
      showToast(`Download failed: ${err.message}`, "error");
    }
  };

  const handleDeleteFile = async (file: AttachedFile) => {
    if (!confirm(`Delete "${file.fileName}"?`)) return;
    try {
      await deleteAttachedFile(accessToken, userId, file.id, file.storagePath);
      setAttachedFiles((curr) => curr.filter((f) => f.id !== file.id));
      showToast(`Deleted "${file.fileName}"`);
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, "error");
    }
  };

  // ─── Chat file attach ───
  const handleChatFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        showToast("File too large for AI chat (max 15MB)", "error");
        return;
      }
      try {
        let contentText = "";
        const isImage = Boolean(file.type.startsWith("image/") || file.name.match(/\.(png|jpg|jpeg|gif|webp)$/i));
        if (isImage) {
          contentText = `[IMAGE: ${file.name} (${formatFileSize(file.size)})]`;
        } else if (file.type.startsWith("text/") || file.name.match(/\.(txt|md|py|js|ts|tsx|jsx|json|csv|html|css|cpp|c|java|sql)$/i)) {
          contentText = await file.text();
        } else {
          contentText = await file.text().catch(() => `[Attachment: ${file.name}]`);
        }
        setChatFile({ name: file.name, size: file.size, type: file.type || "application/octet-stream", content: contentText, isImage });
      } catch (err: any) {
        showToast(`Failed reading file: ${err.message}`, "error");
      }
    }
  };

  // ─── AI Chat — Backend Powered Dream It AI ───
  const askCoach = async (e?: FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const rawQuestion = customQuery || chatDraft.trim();
    if (!rawQuestion && !chatFile && !isAsking) return;

    const questionText = rawQuestion || (chatFile ? `Please analyze attached file: ${chatFile.name}` : "");
    const attachedFileBackup = chatFile;

    const displayMessage = attachedFileBackup
      ? `📎 **${attachedFileBackup.name}** (${formatFileSize(attachedFileBackup.size)})\n\n${questionText}`
      : questionText;

    const promptForAI = attachedFileBackup
      ? `[ATTACHED FILE: ${attachedFileBackup.name} (${formatFileSize(attachedFileBackup.size)})]\n--- FILE CONTENT START ---\n${attachedFileBackup.content.slice(0, 15000)}\n--- FILE CONTENT END ---\n\nUser Question: ${questionText}`
      : questionText;

    setMessages((curr) => [...curr, { role: "user", content: displayMessage }]);
    if (!customQuery) setChatDraft("");
    setChatFile(null);
    setIsAsking(true);

    const chatHistory = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));

    let systemPrompt = `You are Dream It AI, an expert, encouraging study assistant for students. Help with study planning, course concepts, mathematics step-by-step working, code debugging, and flashcards. Be concise, well-structured, and use markdown formatting.`;

    if (chatSubjectId !== null) {
      const subject = subjects.find(s => s.id === chatSubjectId);
      const subjectNotes = notes.filter(n => n.subjectId === chatSubjectId);
      const notesContext = subjectNotes.map(n => `Title: ${n.title}\nContent:\n${n.content}`).join("\n\n---\n\n");
      
      systemPrompt = `You are Dream It AI, acting as a strict Source-Grounded Tutor for the subject "${subject?.name || 'Selected Subject'}". 
You MUST answer the user's questions ONLY using the following provided notes for this subject.
If the answer cannot be found in the provided notes, you MUST refuse to answer and honestly state: "This is not covered in your uploaded materials for ${subject?.name || 'this subject'}." Do NOT use your general knowledge.
When you provide an answer from the notes, you MUST include an inline citation naming the source file, formatted like this: (Source: [Note Title]).

SUBJECT NOTES KNOWLEDGE BASE:
${notesContext ? notesContext : "(No notes uploaded for this subject yet. You must refuse to answer any subject-specific questions until materials are provided.)"}`;
    }

    try {
      // Create empty message for streaming
      setMessages((curr) => [...curr, { role: "assistant", content: "" }]);

      const response = await fetchAI({
        model: "gemini-3.6-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: promptForAI },
        ],
        max_tokens: 4096,
        temperature: chatSubjectId ? 0.1 : 0.7,
        onChunk: (chunk) => {
          setMessages((curr) => {
            const updated = [...curr];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              last.content += chunk;
            }
            return updated;
          });
        }
      });

      if (response.error) {
        setMessages((curr) => {
          const updated = [...curr];
          updated[updated.length - 1].content = `⚠️ **Dream It AI**: ${response.error}`;
          return updated;
        });
      } else {
        addXP(2);
      }
      setIsAsking(false);
      return;
    } catch (e) {
      console.warn("AI fallback notice:", e);
      setMessages((curr) => [
        ...curr,
        {
          role: "assistant",
          content: "⚠️ **Dream It AI**: An unexpected error occurred. Please try again.",
        },
      ]);
    }

    setIsAsking(false);
  };

  // ─── Nav Items ───
  const navItems: { label: NavItem; icon: any; displayLabel?: string }[] = [
    { label: "Today", icon: LayoutDashboard },
    { label: "Planner", icon: CalendarDays },
    { label: "Projects", icon: Folder, displayLabel: "Subjects" },
    { label: "Focus", icon: Target },
    { label: "Notes", icon: Notebook },
    { label: "Grades", icon: GraduationCap },
    { label: "Cards", icon: Layers },
    { label: "Money", icon: Wallet },
  ];

  const isExpanded = mobileOpen || isSidebarHovered;

  // ═══════════════════════════════════ RENDER ═══════════════════════════════════
  return (
    <main className={`dreamit-dash min-h-screen font-[DM_Sans] ${themeConfig.cssClass}`} style={{ backgroundColor: "var(--m-bg)", color: "var(--m-text)" }}>
      {/* ─── Sidebar ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r transition-all duration-300 overflow-x-hidden ${
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        } ${!mobileOpen && isExpanded ? "lg:w-64" : "lg:w-[76px]"}`}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        style={{
          backgroundColor: "var(--m-sidebar-bg)",
          borderColor: "var(--m-border-light)",
        }}
      >
        {/* Brand Header */}
        <div className={`flex h-16 items-center border-b transition-all duration-300 ${isExpanded ? "justify-between px-5" : "justify-center px-0"}`} style={{ borderColor: "var(--m-border-light)" }}>
          <div className="flex items-center">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold shadow-xs" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
              <BookOpenCheck size={18} />
            </div>
            <span className={`font-[Roboto_Slab] text-lg font-bold tracking-tight whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? "max-w-[150px] opacity-100 ml-2.5" : "max-w-0 opacity-0 ml-0"}`} style={{ color: "var(--m-text-heading)" }}>
              Dream It
            </span>
          </div>
          <button className={`p-1 rounded-lg hover:opacity-75 lg:hidden overflow-hidden transition-all duration-300 ${isExpanded ? "max-w-[40px] opacity-100" : "max-w-0 opacity-0"}`} onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} className="shrink-0" />
          </button>
        </div>

        {/* Scrollable Body of Sidebar */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar py-4 space-y-5 overflow-x-hidden transition-all duration-300 ${isExpanded ? "px-5" : "px-3"}`}>
          {/* User Info Card */}
          <div 
            onClick={() => setIsProfileOpen(true)}
            className={`rounded-xl minimal-inset feature-zoom transition-all duration-300 cursor-pointer hover:opacity-80 ${isExpanded ? "p-3" : "p-2 flex flex-col items-center"}`}
          >
            <div className="flex items-center w-full">
              {userImageUrl ? (
                <img src={userImageUrl} alt={userNameDisplay} className="size-8 rounded-full object-cover shrink-0 mx-auto" />
              ) : (
                <div className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold mx-auto" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                  {userNameDisplay.charAt(0)}
                </div>
              )}
              <div className={`min-w-0 flex-1 overflow-hidden transition-all duration-300 ${isExpanded ? "max-w-[200px] opacity-100 ml-2.5" : "max-w-0 opacity-0 ml-0"}`}>
                <p className="truncate text-xs font-bold" style={{ color: "var(--m-primary)" }}>{userNameDisplay}</p>
                <p className="truncate text-[10px]" style={{ color: "var(--m-text-sub)" }}>{userEmail}</p>
              </div>
            </div>
            <div className={`overflow-hidden transition-all duration-300 w-full ${isExpanded ? "max-h-[100px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}`}>
              <div className="flex items-center justify-between pt-2 text-[10px]" style={{ borderTop: "1px solid var(--m-border)" }}>
                <span className="flex items-center gap-1 font-medium whitespace-nowrap" style={{ color: "var(--m-text-sub)" }}>
                  {isSaving ? (
                    <><Cloud size={12} className="animate-pulse shrink-0" style={{ color: "var(--m-warning)" }} /> Saving...</>
                  ) : (
                    <><CheckCircle2 size={12} className="shrink-0" style={{ color: "var(--m-success)" }} /> Synced</>
                  )}
                </span>
                {/* XP & Level Badge */}
                <span className="flex items-center gap-1 font-bold whitespace-nowrap" style={{ color: "var(--m-primary)" }}>
                  <Star size={10} className="shrink-0" /> Lv.{streak.level} {getLevelTitle(streak.level)}
                </span>
              </div>
              {/* XP Progress Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[9px] font-[DM_Mono] whitespace-nowrap" style={{ color: "var(--m-text-muted)" }}>
                  <span>{streak.totalXP} XP</span>
                  <span>{getXPForNextLevel(streak.level)} XP</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--m-border)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${Math.min(100, (streak.totalXP / getXPForNextLevel(streak.level)) * 100)}%`,
                    backgroundColor: "var(--m-primary)",
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <p className={`px-1 text-[10px] font-medium uppercase tracking-wider overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-[20px] opacity-100 mb-2" : "max-h-0 opacity-0 mb-0"}`} style={{ color: "var(--m-text-muted)" }}>
              Menu
            </p>
            <nav className="space-y-1">
              {navItems.map(({ label, icon: Icon, displayLabel }) => (
                <button
                  key={label}
                  onClick={() => { setActiveNav(label); setMobileOpen(false); }}
                  className={`flex items-center rounded-xl transition-all duration-300 feature-chip ${
                    isExpanded ? "w-full px-3.5 py-2.5" : "w-10 h-10 justify-center mx-auto"
                  }`}
                  style={
                    activeNav === label
                      ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)", fontWeight: 600 }
                      : { color: "var(--m-text-sub)" }
                  }
                  title={!isExpanded ? (displayLabel || label) : undefined}
                >
                  <Icon size={17} className="shrink-0" />
                  <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? "max-w-[200px] opacity-100 ml-3" : "max-w-0 opacity-0 ml-0"}`}>{displayLabel || label}</span>
                </button>
              ))}

              <a
                href="/cadence"
                className={`flex items-center rounded-xl transition-all duration-300 feature-chip ${
                  isExpanded ? "w-full px-3.5 py-2.5" : "w-10 h-10 justify-center mx-auto"
                }`}
                style={{ color: "var(--m-text-sub)" }}
                title={!isExpanded ? "Cadence Screening" : undefined}
              >
                <Activity size={17} className="shrink-0" />
                <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? "max-w-[200px] opacity-100 ml-3" : "max-w-0 opacity-0 ml-0"}`}>Cadence Screening</span>
              </a>
            </nav>
          </div>

          {/* Subjects / Courses */}
          <div>
            <div className={`flex items-center justify-between px-1 overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-[20px] opacity-100" : "max-h-0 opacity-0"}`}>
              <p className="text-[10px] font-medium uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--m-text-muted)" }}>
                Subjects
              </p>
              <button
                type="button"
                onClick={() => setSubjectsOpen(true)}
                className="text-[10px] font-bold flex items-center gap-0.5 hover:underline whitespace-nowrap shrink-0"
                style={{ color: "var(--m-primary)" }}
              >
                <Plus size={11} /> Add
              </button>
            </div>
            <div className={`mt-2 space-y-1 text-sm transition-all duration-300 ${isExpanded ? "px-1" : "px-0"}`}>
              <button
                onClick={() => { setSelectedSubject("All subjects"); setActiveNav("Today"); setMobileOpen(false); }}
                className={`flex items-center rounded-xl transition-all duration-300 feature-chip ${
                  isExpanded ? "w-full px-2.5 py-2 text-left" : "w-10 h-10 justify-center mx-auto"
                }`}
                style={selectedSubject === "All subjects" ? { backgroundColor: "var(--m-surface-alt)", fontWeight: 700, color: "var(--m-primary)" } : { color: "var(--m-text-sub)" }}
                title={!isExpanded ? "All subjects" : undefined}
              >
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: "var(--m-primary)" }} />
                <span className={`truncate text-xs whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? "max-w-[200px] opacity-100 ml-2.5" : "max-w-0 opacity-0 ml-0"}`}>All subjects</span>
              </button>
              {subjects.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => { setSelectedSubject(sub.name); setActiveNav("Today"); setMobileOpen(false); }}
                  className={`flex items-center rounded-xl transition-all duration-300 feature-chip ${
                    isExpanded ? "w-full px-2.5 py-2 text-left" : "w-10 h-10 justify-center mx-auto"
                  }`}
                  style={selectedSubject === sub.name ? { backgroundColor: "var(--m-surface-alt)", fontWeight: 700, color: "var(--m-primary)" } : { color: "var(--m-text-sub)" }}
                  title={!isExpanded ? sub.name : undefined}
                >
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                  <span className={`truncate text-xs whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? "max-w-[200px] opacity-100 ml-2.5" : "max-w-0 opacity-0 ml-0"}`}>{sub.name}</span>
                </button>
              ))}
              <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-[50px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}`}>
                <button onClick={() => { setSubjectsOpen(true); setMobileOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold hover:opacity-80 feature-chip" style={{ color: "var(--m-primary)" }}>
                  <FolderPlus size={14} className="shrink-0" /><span className="whitespace-nowrap">+ Add / Manage Subjects</span>
                </button>
              </div>
            </div>
          </div>

          {/* Streak & Export Card */}
          <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-[200px] opacity-100 mt-5" : "max-h-0 opacity-0 mt-0"}`}>
            <div className="rounded-xl p-3 text-xs minimal-inset feature-zoom">
              <div className="flex items-center gap-2 font-medium whitespace-nowrap" style={{ color: "var(--m-text-heading)" }}>
                <Flame size={14} style={{ color: "var(--m-warning)" }} className="shrink-0" />
                <span>{streak.currentStreak} day streak</span>
              </div>
              <div className="mt-2.5 flex gap-1.5">
                <button onClick={exportDataJSON} className="flex-1 rounded-lg py-1.5 text-[10px] font-bold transition hover:opacity-80 whitespace-nowrap" style={{ backgroundColor: "var(--m-surface)", color: "var(--m-primary)", border: "1px solid var(--m-border)" }}>
                  Export JSON
                </button>
                <button onClick={exportTasksCSV} className="flex-1 rounded-lg py-1.5 text-[10px] font-bold transition hover:opacity-80 whitespace-nowrap" style={{ backgroundColor: "var(--m-surface)", color: "var(--m-primary)", border: "1px solid var(--m-border)" }}>
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className={`border-t transition-all duration-300 ${isExpanded ? "py-4 px-5 space-y-2" : "py-4 px-3 flex flex-col items-center space-y-3"}`} style={{ borderColor: "var(--m-border-light)" }}>
          <button onClick={() => setThemeSelectorOpen(true)} className={`flex items-center rounded-xl transition-all duration-300 minimal-surface feature-chip ${isExpanded ? "w-full px-3 py-2.5 justify-between" : "w-10 h-10 justify-center"}`} title={!isExpanded ? "Change Theme" : undefined}>
            <span className="flex items-center">
              <Palette size={15} className="shrink-0" />
              <span className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? "max-w-[100px] opacity-100 ml-2" : "max-w-0 opacity-0 ml-0"}`}>{themeConfig.name}</span>
            </span>
            <span className={`flex items-center overflow-hidden transition-all duration-300 ${isExpanded ? "max-w-[100px] opacity-100 gap-1.5" : "max-w-0 opacity-0 gap-0"}`}>
              {themeConfig.swatches.slice(0, 3).map((color, i) => (
                <span key={i} className="inline-block size-3 shrink-0 rounded-full" style={{ backgroundColor: color, border: '1px solid var(--m-border-light)' }} />
              ))}
            </span>
          </button>

          <button onClick={onSignOut} className={`flex items-center rounded-xl transition-all duration-300 minimal-surface feature-chip ${isExpanded ? "w-full px-3 py-2 justify-center" : "w-10 h-10 justify-center"}`} style={{ color: "var(--m-danger)" }} title={!isExpanded ? "Sign Out" : undefined}>
            <LogOut size={14} className="shrink-0" />
            <span className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? "max-w-[100px] opacity-100 ml-2" : "max-w-0 opacity-0 ml-0"}`}>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button className="fixed inset-0 z-20 bg-black/60 lg:hidden transition-opacity" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
      )}

      {/* ─── Main Content ─── */}
      <section className="transition-all duration-300 w-full lg:pl-[76px]">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3.5 md:px-8 minimal-surface shadow-xs overflow-x-auto custom-scrollbar gap-4" style={{ backgroundColor: "var(--m-surface-solid)", borderBottom: "1px solid var(--m-border-light)" }}>
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button className="lg:hidden p-2 rounded-xl hover:opacity-80 transition minimal-surface min-h-[40px] min-w-[40px] flex items-center justify-center" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div>
              <p className="text-xs sm:text-sm font-medium truncate max-w-[170px] sm:max-w-none" style={{ color: "var(--m-text-heading)" }}>
                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
              <p className="text-[10px] sm:text-xs truncate max-w-[170px] sm:max-w-none" style={{ color: "var(--m-text-muted)" }}>
                {dayGreeting}, {userNameDisplay}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button onClick={() => setIsChatMaximized(true)} className="flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition hover:scale-105 shadow-xs" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }} title="Open AI Tutor">
              <Brain size={15} /><span className="hidden xs:inline">AI Tutor</span>
            </button>
            <button onClick={() => setFriendsModalOpen(true)} className="p-2 rounded-xl transition hover:opacity-80 minimal-surface min-h-[38px] min-w-[38px] flex items-center justify-center" title="Friends">
              <Users size={17} />
            </button>
            <button onClick={() => { setChatModalOpen(true); checkInbox(); }} className="relative p-2 rounded-xl transition hover:opacity-80 minimal-surface min-h-[38px] min-w-[38px] flex items-center justify-center" title="Messages">
              <MessageCircle size={17} />
              {unreadMessageCount > 0 && (
                <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white shadow-sm ring-2 ring-[var(--m-header-bg)]">
                  {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                </span>
              )}
            </button>
            <button onClick={() => setInboxOpen(true)} className="relative p-2 rounded-xl transition hover:opacity-80 minimal-surface min-h-[38px] min-w-[38px] flex items-center justify-center" title="Inbox">
              <Bell size={17} />
              {(pendingShares.length + pendingFriendRequests.length) > 0 && (
                <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                  {pendingShares.length + pendingFriendRequests.length}
                </span>
              )}
            </button>
            <button onClick={() => setThemeSelectorOpen(true)} className="p-2 rounded-xl transition hover:opacity-80 minimal-surface min-h-[38px] min-w-[38px] flex items-center justify-center" title="Change theme">
              <Palette size={17} />
            </button>
            <button onClick={() => setSubjectsOpen(true)} className="hidden sm:flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80 minimal-surface" style={{ color: "var(--m-primary)" }}>
              <FolderPlus size={14} /><span>Projects ({subjects.length})</span>
            </button>
          </div>
        </header>

        <div className="px-3.5 sm:px-6 md:px-8 pb-28 lg:pb-10 pt-4 sm:pt-6">

          {/* ═══ Welcome Onboarding ═══ */}
          {showOnboarding && (
            <div className="mb-8 rounded-2xl p-5 minimal-surface feature-zoom" style={{ borderColor: "var(--m-primary)", borderWidth: "1px" }}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-[Roboto_Slab] text-xl font-semibold" style={{ color: "var(--m-text-heading)" }}>Welcome, {userNameDisplay}</h2>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--m-text-sub)" }}>
                    Your workspace is fresh. Create a project, add tasks, or chat with the AI tutor to get started.
                  </p>
                </div>
                <button onClick={() => setShowOnboarding(false)} className="p-1 rounded-lg hover:opacity-75 shrink-0">
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ═══════════ FINANCE VIEW ═══════════ */}
          {activeNav === "Money" && (
            <Suspense fallback={<div className="flex h-full items-center justify-center p-8"><Loader2 className="animate-spin text-white/50" size={32} /></div>}>
              <FinanceApp 
                financeData={finance} 
                onUpdateFinance={(newData) => setFinance(newData)} 
              />
            </Suspense>
          )}

          {/* ═══════════ TODAY VIEW ═══════════ */}
          {activeNav === "Today" && (
            <div className="grid gap-5 sm:gap-7 xl:grid-cols-[1fr_380px] items-start">
              <div>
                {/* Greeting */}
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h1 className="font-[Roboto_Slab] text-2xl font-semibold leading-tight md:text-3xl" style={{ color: "var(--m-text-heading)" }}>
                      Today
                    </h1>
                    <p className="mt-1 text-sm" style={{ color: "var(--m-text-muted)" }}>
                      {completeCount} of {tasks.length} tasks done
                    </p>
                  </div>
                  <button onClick={() => document.getElementById("new-task-input")?.focus()} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                    <Plus size={16} /><span>New Task</span>
                  </button>
                </div>

                {/* Deadline Countdown Widget */}
                {upcomingDeadlines.length > 0 && (
                  <section className="mb-5 rounded-xl p-4 minimal-surface feature-zoom">
                    <div className="flex items-center gap-2 mb-3">
                      <AlarmClock size={15} style={{ color: "var(--m-danger)" }} />
                      <p className="text-xs font-medium" style={{ color: "var(--m-text-muted)" }}>Upcoming deadlines</p>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {upcomingDeadlines.map((t) => (
                        <div key={t.id} className="shrink-0 rounded-xl px-3 py-2 text-xs feature-chip" style={{ border: `1px solid ${deadlineColor(t.daysLeft)}30`, backgroundColor: `${deadlineColor(t.daysLeft)}10` }}>
                          <p className="font-bold truncate max-w-[140px]" style={{ color: "var(--m-text-heading)" }}>{t.title}</p>
                          <p className="font-[DM_Mono] text-[11px] font-bold mt-0.5" style={{ color: deadlineColor(t.daysLeft) }}>
                            {t.daysLeft < 0 ? `${Math.abs(t.daysLeft)}d overdue!` : t.daysLeft === 0 ? "Due today!" : `${t.daysLeft}d left`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Subject Filter */}
                <section className="mb-5 rounded-xl p-4 minimal-inset feature-zoom">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-medium" style={{ color: "var(--m-text-muted)" }}>Filter by project</p>
                    <button onClick={() => setSubjectsOpen(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition hover:scale-105" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)", color: "var(--m-primary)" }}>
                      <FolderPlus size={14} /><span>Manage</span>
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    <button onClick={() => setSelectedSubject("All subjects")} className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition hover:scale-105 feature-chip" style={selectedSubject === "All subjects" ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" } : { backgroundColor: "var(--m-surface)", color: "var(--m-text)", border: "1px solid var(--m-border)" }}>
                      All ({tasks.length})
                    </button>
                    {subjects.map((s) => {
                      const count = tasks.filter((t) => t.course === s.name && !t.done).length;
                      return (
                        <button key={s.id} onClick={() => { setSelectedSubject(s.name); setTaskCourse(s.name); }} className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition hover:scale-105 feature-chip" style={selectedSubject === s.name ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" } : { backgroundColor: "var(--m-surface)", color: "var(--m-text)", border: "1px solid var(--m-border)" }}>
                          <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name} {count > 0 && <span className="opacity-75">({count})</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Progress & Timer */}
                <div className="grid gap-4 sm:gap-5 md:grid-cols-[1.3fr_1fr]">
                  <section className="overflow-hidden rounded-xl p-5 minimal-surface feature-zoom">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium" style={{ color: "var(--m-text-muted)" }}>Progress</p>
                        <h2 className="mt-0.5 text-lg font-semibold" style={{ color: "var(--m-text-heading)" }}>{completeCount} of {tasks.length} done</h2>
                      </div>
                      <span className="rounded-lg px-2.5 py-0.5 text-xs font-medium minimal-inset" style={{ color: "var(--m-primary)" }}>{progress}%</span>
                    </div>
                    <div className="mt-5 flex items-center gap-2">
                      <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--m-surface-alt)" }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: "var(--m-primary)" }} />
                      </div>
                    </div>
                    {/* Weekly bars */}
                    <div className="mt-6">
                      <div className="flex items-center justify-between text-[11px] mb-2" style={{ color: "var(--m-text-muted)" }}>
                        <span>This week</span>
                        <span style={{ color: "var(--m-primary)" }}>{formatStudyTime(weeklyStudyMinutes)} total</span>
                      </div>
                      <div className="grid grid-cols-7 gap-2 items-end h-14 rounded-xl p-2" style={{ backgroundColor: "var(--m-surface-hover)", border: "1px solid var(--m-border-light)" }}>
                        {graphData.map((d) => {
                          const heightPct = graphMaxMinutes > 0 ? Math.min(100, Math.max(15, (d.minutes / graphMaxMinutes) * 100)) : 15;
                          return (
                            <div key={d.dateKey} className="flex flex-col items-center gap-1 h-full justify-end" title={`${d.label}: ${d.minutes} mins`}>
                              <div className="w-full rounded-md transition-all duration-300" style={{ height: `${heightPct}%`, backgroundColor: d.isToday ? "var(--m-primary)" : d.minutes > 0 ? "var(--m-accent)" : "var(--m-border)" }} />
                              <span className={`text-[9px] font-[DM_Mono] ${d.isToday ? "font-bold" : ""}`} style={{ color: d.isToday ? "var(--m-primary)" : "var(--m-text-sub)" }}>{d.label.split(" ")[0]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  {/* Pomodoro Widget */}
                  <section className="rounded-xl p-5 minimal-surface feature-zoom" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)", borderColor: "transparent" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                          {isBreak ? "Break" : "Focus"}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold">
                          {isBreak ? "Take a break." : "Stay focused."}
                        </h2>
                      </div>
                      <div className="text-right text-[10px] opacity-70">
                        <p>Session {pomodoroSession + 1}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-5">
                      <div className="relative grid size-24 place-items-center shrink-0">
                        <svg className="size-24 -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="50" fill="none" stroke="color-mix(in srgb, var(--m-primary-text) 25%, transparent)" strokeWidth="7" />
                          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--m-accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray="314" strokeDashoffset={circleDash} className="transition-all duration-300" />
                        </svg>
                        <span className="absolute font-[DM_Mono] text-base font-bold">{formatTime(seconds)}</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium transition-colors duration-300" style={{ color: "color-mix(in srgb, var(--m-primary-text) 90%, transparent)" }}>
                          {isBreak ? "Break" : `${timerPreset}min Focus`}
                        </p>
                        <div className="mt-2.5 flex items-center gap-2">
                          <button onClick={() => setIsRunning((r) => !r)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition hover:scale-105 shadow-sm" style={{ backgroundColor: "var(--m-accent)", color: "var(--m-accent-text)" }}>
                            {isRunning ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                            <span>{isRunning ? "Pause" : "Start"}</span>
                          </button>
                          <button onClick={() => { setSeconds(timerPreset * 60); setIsRunning(false); setIsBreak(false); }} className="p-2 rounded-full transition-colors duration-200 hover:opacity-100" style={{ color: "color-mix(in srgb, var(--m-primary-text) 80%, transparent)" }} title="Reset">
                            <RotateCcw size={14} />
                          </button>
                        </div>
                        <div className="mt-2 flex gap-1 text-[10px]">
                          {[15, 25, 45].map((m) => (
                            <button key={m} onClick={() => changeTimerPreset(m)} className="px-2 py-0.5 rounded transition-all duration-200 feature-chip" style={timerPreset === m ? { backgroundColor: "var(--m-accent)", color: "var(--m-accent-text)", fontWeight: "bold" } : { backgroundColor: "color-mix(in srgb, var(--m-primary-text) 15%, transparent)", color: "var(--m-primary-text)", opacity: 0.85 }}>{m}m</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Tasks List */}
                <section className="mt-7">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold" style={{ color: "var(--m-text-heading)" }}>Tasks</h2>
                    <div className="flex rounded-xl p-1 text-xs font-semibold" style={{ backgroundColor: "var(--m-surface-alt)" }}>
                      {(["all", "active", "completed"] as const).map((st) => (
                        <button key={st} onClick={() => setTaskFilterStatus(st)} className={`rounded-lg px-3 py-1 capitalize transition feature-chip`} style={taskFilterStatus === st ? { backgroundColor: "var(--m-surface)", color: "var(--m-primary)", fontWeight: 700, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" } : { color: "var(--m-text-sub)" }}>
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl minimal-surface feature-zoom">
                    <div className="divide-y" style={{ borderColor: "var(--m-border-light)" }}>
                      {filteredTasks.length ? (
                        filteredTasks.map((task) => (
                          <div key={task.id} className={`group flex items-center gap-3.5 px-5 py-3.5 transition duration-200 hover:opacity-90 ${task.done ? "opacity-60" : ""}`}>
                            <button onClick={() => toggleTask(task.id)} className="grid size-5 shrink-0 place-items-center rounded-full border transition" style={task.done ? { borderColor: "var(--m-primary)", backgroundColor: "var(--m-primary)", color: "white" } : { borderColor: "var(--m-border)", backgroundColor: "var(--m-surface)" }}>
                              {task.done && <Check size={13} strokeWidth={3} />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium ${task.done ? "line-through" : ""}`} style={{ color: task.done ? "var(--m-text-muted)" : "var(--m-text)" }}>{task.title}</p>
                              <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: "var(--m-text-sub)" }}>
                                <span className="font-semibold">{task.course}</span>
                                <span>•</span>
                                <span className="font-[DM_Mono] text-[10px]">{task.time}</span>
                                {task.priority && (
                                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${task.priority === "high" ? "bg-[#fff0e9] text-[#9a463f]" : task.priority === "medium" ? "bg-[#fff3d8] text-[#8a6523]" : "bg-[#eef4ec] text-[#35523e]"}`}>{task.priority}</span>
                                )}
                                {task.deadline && (
                                  <span className="font-[DM_Mono] text-[10px] font-bold" style={{ color: deadlineColor(daysUntil(task.deadline)) }}>
                                    {daysUntil(task.deadline) <= 0 ? "⚠️ Due!" : `📅 ${daysUntil(task.deadline)}d`}
                                  </span>
                                )}
                                {task.createdBy === "agent" && (
                                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: "var(--m-primary-transparent)", color: "var(--m-primary)", border: "1px solid var(--m-primary)" }}>
                                    <Sparkles size={9} /> Autopilot
                                  </span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition" style={{ color: "var(--m-danger)" }} title="Delete"><Trash2 size={16} /></button>
                          </div>
                        ))
                      ) : (
                        <div className="px-5 py-10 text-center">
                          <div className="mx-auto grid size-12 place-items-center rounded-2xl" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-primary)" }}>
                            <CheckCircle2 size={22} />
                          </div>
                          <p className="mt-3 font-[Roboto_Slab] text-lg font-semibold" style={{ color: "var(--m-text-heading)" }}>No tasks here yet.</p>
                          <p className="mt-1 text-xs" style={{ color: "var(--m-text-sub)" }}>Add your first task below to get started!</p>
                        </div>
                      )}
                    </div>

                    {/* Add Task Form */}
                    <form onSubmit={addTask} className="flex flex-col sm:grid gap-3 sm:gap-2 px-4 py-4 sm:py-3.5 sm:grid-cols-[1fr_140px_100px_100px_auto]" style={{ borderTop: "1px solid var(--m-border-light)", backgroundColor: "var(--m-surface-hover)" }}>
                      <input id="new-task-input" value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="What needs to get done?" className="min-w-0 rounded-xl border px-3.5 py-2 text-sm outline-none transition focus:ring-2" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)", "--tw-ring-color": "var(--m-primary)" } as any} />
                      <div className="flex items-center gap-1 min-w-0">
                        <select
                          value={taskCourse}
                          onChange={(e) => {
                            if (e.target.value === "__ADD_NEW__") {
                              setSubjectsOpen(true);
                            } else {
                              setTaskCourse(e.target.value);
                            }
                          }}
                          className="w-full rounded-xl border px-2.5 py-2 text-xs font-medium outline-none cursor-pointer"
                          style={{
                            borderColor: "var(--m-border)",
                            backgroundColor: "var(--m-input-bg)",
                            color: "var(--m-text)",
                          }}
                        >
                          <option value="">{selectedSubject === "All subjects" ? "Subject (Select)" : selectedSubject}</option>
                          {subjects.map((sub) => (
                            <option key={sub.id} value={sub.name}>
                              {sub.name}
                            </option>
                          ))}
                          <option value="__ADD_NEW__" className="font-bold">
                            ➕ Add Subject...
                          </option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setSubjectsOpen(true)}
                          className="rounded-lg p-2 text-xs font-bold transition hover:opacity-80 shrink-0"
                          style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-primary)", border: "1px solid var(--m-border-light)" }}
                          title="Add New Subject"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <input type="date" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} className="min-w-0 rounded-xl border px-2 py-2 text-xs outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} title="Deadline" />
                      <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as any)} className="rounded-xl border px-2 py-2 text-xs outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <button type="submit" disabled={!taskDraft.trim()} className="rounded-xl px-4 py-2 text-xs font-bold transition hover:scale-105 disabled:opacity-40" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>Add</button>
                    </form>
                  </div>
                </section>

                {/* Autopilot Widget */}
                <section className="mt-5 rounded-xl p-5 minimal-surface feature-zoom" style={{ border: "1px solid var(--m-primary-transparent)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} style={{ color: "var(--m-primary)" }} />
                    <h3 className="font-[Roboto_Slab] text-base font-semibold" style={{ color: "var(--m-text-heading)" }}>Autopilot Taskmaster</h3>
                  </div>
                  <p className="text-xs mb-3" style={{ color: "var(--m-text-muted)" }}>Paste a syllabus, email, or meeting notes to automatically generate your tasks and schedule.</p>
                  
                  <form onSubmit={handleAutopilotSubmit} className="mb-6">
                    <textarea 
                      value={autopilotText}
                      onChange={(e) => setAutopilotText(e.target.value)}
                      placeholder="Paste syllabus, email, assignment brief, or meeting notes here..."
                      className="w-full rounded-xl border p-3 text-xs outline-none resize-y min-h-[80px]"
                      style={{ borderColor: "var(--m-border-light)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }}
                    />
                    <div className="flex justify-end mt-2">
                      <button type="submit" disabled={isSubmittingAutopilot || !autopilotText.trim()} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                        {isSubmittingAutopilot ? (
                          <><span className="flex gap-1 mr-1"><span className="size-1.5 animate-bounce rounded-full bg-white" /><span className="size-1.5 animate-bounce rounded-full bg-white [animation-delay:150ms]" /><span className="size-1.5 animate-bounce rounded-full bg-white [animation-delay:300ms]" /></span> Processing...</>
                        ) : (
                          <>Run Autopilot <Sparkles size={14} /></>
                        )}
                      </button>
                    </div>
                  </form>

                  <h4 className="text-xs font-bold mb-3" style={{ color: "var(--m-text-heading)" }}>Agent Activity Log</h4>
                  
                  {autopilotRuns.length === 0 ? (
                    <div className="rounded-xl border p-6 text-center" style={{ borderColor: "var(--m-border-light)" }}>
                      <Bot size={24} className="mx-auto mb-2 opacity-50" style={{ color: "var(--m-text-sub)" }} />
                      <p className="text-sm font-medium" style={{ color: "var(--m-text-muted)" }}>No agent activity yet.</p>
                      <p className="text-xs mt-1" style={{ color: "var(--m-text-sub)" }}>Paste text above to trigger Autopilot.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {autopilotRuns.map((run) => (
                        <div key={run.id} className="overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: "var(--m-border-light)" }}>
                          {/* Run Header */}
                          <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--m-border-light)", backgroundColor: "var(--m-surface-alt)" }}>
                            <div className="flex items-center gap-2">
                              <div className="grid size-6 place-items-center rounded-md" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                                <Bot size={13} />
                              </div>
                              <div>
                                <p className="text-[11px] font-bold" style={{ color: "var(--m-text-heading)" }}>Autopilot Run</p>
                                <p className="text-[9px]" style={{ color: "var(--m-text-sub)" }}>{new Date(run.timestamp).toLocaleTimeString()}</p>
                              </div>
                            </div>
                            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{
                              backgroundColor: run.status === "done" ? "var(--m-surface)" : run.status === "error" ? "var(--m-surface)" : "var(--m-surface)",
                              color: run.status === "done" ? "var(--m-success)" : run.status === "error" ? "var(--m-danger)" : "var(--m-primary)",
                              border: "1px solid var(--m-border)",
                            }}>
                              {run.status === "done" ? <><CheckCircle2 size={9} /> Complete</> :
                               run.status === "error" ? <><AlertCircle size={9} /> Error</> :
                               <><span className="size-1.5 animate-pulse rounded-full" style={{ backgroundColor: "var(--m-primary)" }} /> {run.status === "extracting" ? "Extracting..." : run.status === "planning" ? "Planning..." : "Executing..."}</>
                              }
                            </span>
                          </div>

                          <div className="p-3 space-y-3">
                            {/* Extracted Items */}
                            {run.extractedItems.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold mb-1.5 flex items-center gap-1" style={{ color: "var(--m-text)" }}>
                                  <FileText size={10} style={{ color: "var(--m-primary)" }} /> Extracted {run.extractedItems.length} item(s)
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {run.extractedItems.map((item, idx) => (
                                    <div key={idx} className="rounded-lg border p-2 text-[9px]" style={{ borderColor: "var(--m-border-light)" }}>
                                      <p className="font-bold truncate" style={{ color: "var(--m-text-heading)" }}>{item.title}</p>
                                      <div className="flex justify-between mt-0.5" style={{ color: "var(--m-text-sub)" }}>
                                        <span>{item.type} • {item.priority}</span>
                                        {item.course && <span>{item.course}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Results */}
                            {run.status === "done" && (run.createdTasks.length > 0 || run.createdSchedule.length > 0) && (
                              <div className="pt-2 border-t" style={{ borderColor: "var(--m-border-light)" }}>
                                <p className="text-[10px] font-bold mb-1 flex items-center gap-1" style={{ color: "var(--m-success)" }}>
                                  <CheckCircle2 size={10} /> Actions Taken
                                </p>
                                <ul className="list-disc list-inside text-[9px] space-y-0.5" style={{ color: "var(--m-text-sub)" }}>
                                  {run.createdTasks.map((t, i) => <li key={`t-${i}`}>Created task: <b>{t}</b></li>)}
                                  {run.createdSchedule.map((s, i) => <li key={`s-${i}`}>Scheduled: <b>{s}</b></li>)}
                                </ul>
                              </div>
                            )}

                            {/* Error */}
                            {run.errorMsg && (
                              <p className="text-[10px] italic" style={{ color: run.status === "error" ? "var(--m-danger)" : "var(--m-text-sub)" }}>
                                {run.errorMsg}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* ─── Right: AI Chat Panel ─── */}
              <aside className="flex flex-col overflow-hidden rounded-2xl w-full minimal-surface h-[calc(100vh-120px)] min-h-[520px] sticky top-4 shadow-sm feature-zoom" style={{ backgroundColor: "var(--m-surface-solid)", border: "1px solid var(--m-border)" }}>
                {/* Side Panel Header */}
                <div className="flex items-center justify-between p-3.5 shrink-0" style={{ borderBottom: "1px solid var(--m-border-light)" }}>
                  <div className="flex items-center gap-2">
                    <div className="grid size-8 place-items-center rounded-lg" style={{ backgroundColor: chatSubjectId ? "var(--m-warning)" : "var(--m-primary)", color: chatSubjectId ? "var(--m-warning-text)" : "var(--m-primary-text)" }}>
                      <Brain size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--m-text-heading)" }}>{chatSubjectId ? "Grounded Tutor" : "Dream It AI"}</p>
                      <p className="flex items-center gap-1 text-[10px]" style={{ color: "var(--m-text-muted)" }}>
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: "var(--m-success)" }} />
                        {chatSubjectId ? "Sourced Mode" : "Online"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={chatSubjectId || ""}
                      onChange={(e) => setChatSubjectId(e.target.value ? Number(e.target.value) : null)}
                      className="rounded-lg border px-2 py-1 text-[10px] outline-none max-w-[100px]"
                      style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }}
                      title="Grounded Subject Mode"
                    >
                      <option value="">General AI</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} Tutor</option>
                      ))}
                    </select>
                    <button onClick={() => setIsChatMaximized(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition hover:opacity-80 minimal-surface" style={{ color: "var(--m-primary)" }} title="Full screen">
                      <Maximize2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Messages Container (Fills middle area perfectly) */}
                <div ref={chatContainerRef} className="flex-1 space-y-3 overflow-y-auto custom-scrollbar overscroll-contain p-4 text-xs leading-6" style={{ scrollBehavior: "smooth" }}>
                  {messages.map((m, idx) => (
                    <div key={idx} className="max-w-[92%] rounded-2xl px-4 py-3 shadow-xs" style={m.role === "assistant" ? { backgroundColor: "var(--m-chat-bot-bg)", color: "var(--m-chat-bot-text)", borderTopLeftRadius: "4px", border: "1px solid var(--m-border-light)" } : { backgroundColor: "var(--m-chat-user-bg)", color: "var(--m-chat-user-text)", borderTopRightRadius: "4px", marginLeft: "auto" }}>
                      {renderSimpleMarkdown(m.content)}
                    </div>
                  ))}
                  {isAsking && (
                    <div className="flex w-fit items-center gap-2 rounded-2xl px-4 py-3 shadow-xs" style={{ backgroundColor: "var(--m-chat-bot-bg)", borderTopLeftRadius: "4px" }}>
                      <span className="text-[11px] font-bold" style={{ color: "var(--m-primary)" }}>Dream It AI thinking</span>
                      <span className="flex gap-1">
                        <span className="size-1.5 animate-bounce rounded-full" style={{ backgroundColor: "var(--m-primary)" }} />
                        <span className="size-1.5 animate-bounce rounded-full [animation-delay:150ms]" style={{ backgroundColor: "var(--m-primary)" }} />
                        <span className="size-1.5 animate-bounce rounded-full [animation-delay:300ms]" style={{ backgroundColor: "var(--m-primary)" }} />
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Prompts */}
                <div className="shrink-0 px-3 py-2" style={{ borderTop: "1px solid var(--m-border-light)", backgroundColor: "var(--m-surface-hover)" }}>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { emoji: "📐", text: "Solve 2x - 1 = 0", prompt: "Solve 2x - 1 = 0 step by step" },
                      { emoji: "💡", text: "Study plan", prompt: `Create a study plan for my subjects: ${subjects.map((s) => s.name).join(", ") || "my courses"}` },
                      { emoji: "🃏", text: "Make flashcards", prompt: `Generate 5 flashcards for studying ${subjects.length > 0 ? subjects[0].name : "my course"}` },
                    ].map(({ emoji, text, prompt }) => (
                      <button key={text} onClick={() => askCoach(undefined, prompt)} className="rounded-lg px-2 py-1 text-[10px] font-semibold transition hover:scale-105" style={{ border: "1px solid var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-primary)" }}>
                        {emoji} {text}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat Input (Positioned cleanly at bottom) */}
                <form onSubmit={askCoach} className="shrink-0 p-3" style={{ borderTop: "1px solid var(--m-border-light)" }}>
                  <input ref={chatFileInputRef} type="file" onChange={handleChatFileSelect} className="hidden" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.doc,.txt,.py,.js,.ts,.tsx,.jsx,.json,.csv,.html,.css,.cpp,.c,.java,.sql,.md" />
                  {chatFile && (
                    <div className="flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-bold mb-2" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-primary)", border: "1px solid var(--m-border)" }}>
                      <span className="flex items-center gap-1.5 truncate"><Paperclip size={13} />{chatFile.name} <span className="text-[10px] opacity-75 font-mono">({formatFileSize(chatFile.size)})</span></span>
                      <button type="button" onClick={() => setChatFile(null)} className="p-0.5 rounded-md transition hover:opacity-75"><X size={14} /></button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-2xl p-1.5 pl-2.5" style={{ border: "1px solid var(--m-border)", backgroundColor: "var(--m-input-bg)" }}>
                    <button type="button" onClick={() => chatFileInputRef.current?.click()} className="flex items-center justify-center size-9 rounded-xl transition shrink-0 hover:opacity-75" style={{ color: "var(--m-text-sub)" }} title="Attach file">
                      <Paperclip size={17} />
                    </button>
                    <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); askCoach(); } }} className="flex-1 bg-transparent py-1.5 text-xs outline-none" style={{ color: "var(--m-text)" }} placeholder="Ask Dream It AI anything..." />
                    <VoiceInputButton
                      value={chatDraft}
                      onChange={setChatDraft}
                      disabled={isAsking}
                      size={15}
                    />
                    <button type="submit" disabled={(!chatDraft.trim() && !chatFile) || isAsking} className="grid size-9 place-items-center rounded-xl transition hover:scale-105 disabled:opacity-40 shrink-0" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                      <Send size={15} />
                    </button>
                  </div>
                </form>
              </aside>

              {/* ─── Full Screen Wide Angle AI Fullscreen Overlay ─── */}
              {isChatMaximized && (
                <div
                  className="fixed inset-0 z-50 flex flex-col w-full h-full p-0 m-0 overflow-hidden minimal-surface animate-in fade-in duration-200"
                  style={{ backgroundColor: "var(--m-surface-solid)", color: "var(--m-text)" }}
                >
                  {/* Fullscreen Header */}
                  <div className="w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--m-border-light)", backgroundColor: "var(--m-surface)" }}>
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 sm:size-11 place-items-center rounded-2xl shadow-sm" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                        <Brain size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-[Roboto_Slab] text-lg sm:text-xl font-bold" style={{ color: "var(--m-text-heading)" }}>Dream It AI Tutor</h2>
                          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-xs" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>Wide Screen</span>
                        </div>
                        <p className="flex items-center gap-1.5 text-xs mt-0.5" style={{ color: "var(--m-text-sub)" }}>
                          <span className="size-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--m-success)" }} />
                          Online & Ready for full-screen study assistance
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setIsChatMaximized(false)} className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition hover:scale-105 minimal-surface shadow-xs" style={{ color: "var(--m-primary)", border: "1px solid var(--m-border)" }} title="Exit full screen">
                      <Minimize2 size={16} /><span>Exit Full Screen</span>
                    </button>
                  </div>

                  {/* Fullscreen Messages Area (Stretches across entire screen) */}
                  <div ref={chatMaxContainerRef} className="flex-1 space-y-4 overflow-y-auto custom-scrollbar w-full px-4 sm:px-6 md:px-10 py-6 max-w-6xl mx-auto">
                    {messages.map((m, idx) => (
                      <div
                        key={idx}
                        className={`max-w-[90%] md:max-w-[80%] rounded-2xl p-4 md:p-5 leading-relaxed transition ${
                          m.role === "assistant" ? "shadow-xs" : "ml-auto shadow-sm"
                        }`}
                        style={
                          m.role === "assistant"
                            ? { backgroundColor: "var(--m-chat-bot-bg)", color: "var(--m-chat-bot-text)", borderTopLeftRadius: "4px", border: "1px solid var(--m-border-light)" }
                            : { backgroundColor: "var(--m-chat-user-bg)", color: "var(--m-chat-user-text)", borderTopRightRadius: "4px" }
                        }
                      >
                        {renderSimpleMarkdown(m.content)}
                      </div>
                    ))}
                    {isAsking && (
                      <div className="flex w-fit items-center gap-3 rounded-2xl p-3.5 shadow-xs" style={{ backgroundColor: "var(--m-chat-bot-bg)", borderTopLeftRadius: "4px", border: "1px solid var(--m-border-light)" }}>
                        <Sparkles size={18} className="animate-spin" style={{ color: "var(--m-primary)" }} />
                        <span className="text-xs font-bold" style={{ color: "var(--m-primary)" }}>Dream It AI is analyzing your prompt...</span>
                      </div>
                    )}
                  </div>



                  {/* Fullscreen Input Bar */}
                  <form onSubmit={askCoach} className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-4 sm:pb-6 pt-2 shrink-0">
                    {chatFile && (
                      <div className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium mb-2 minimal-inset" style={{ color: "var(--m-primary)", border: "1px solid var(--m-border)" }}>
                        <span className="flex items-center gap-2 truncate"><Paperclip size={14} />{chatFile.name} <span className="text-[10px] opacity-75 font-mono">({formatFileSize(chatFile.size)})</span></span>
                        <button type="button" onClick={() => setChatFile(null)} className="p-1 rounded-md transition hover:opacity-75"><X size={14} /></button>
                      </div>
                    )}
                    <div className="flex items-center gap-3 rounded-2xl p-2.5 pl-4 minimal-inset shadow-xs" style={{ border: "1px solid var(--m-border)", backgroundColor: "var(--m-input-bg)" }}>
                      <button type="button" onClick={() => chatFileInputRef.current?.click()} className="flex items-center justify-center size-10 rounded-xl transition shrink-0 hover:opacity-75" style={{ color: "var(--m-text-sub)" }} title="Attach file">
                        <Paperclip size={18} />
                      </button>
                      <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); askCoach(); } }} className="flex-1 bg-transparent py-2 text-xs sm:text-sm outline-none" style={{ color: "var(--m-text)" }} placeholder="Ask Dream It AI anything... (Press Enter to send)" />
                      <VoiceInputButton
                        value={chatDraft}
                        onChange={setChatDraft}
                        disabled={isAsking}
                        size={15}
                      />
                      <button type="submit" disabled={(!chatDraft.trim() && !chatFile) || isAsking} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition hover:scale-105 disabled:opacity-40 shrink-0" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                        <Send size={15} /><span>Send</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ═══════════ PLANNER VIEW ═══════════ */}
          {activeNav === "Planner" && (
            <section className="grid gap-5 sm:gap-7 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.5rem] p-6 shadow-xs feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
                <p className="font-[DM_Mono] text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--m-text-sub)" }}>Build a Doable Day</p>
                <h2 className="mt-1 font-[Roboto_Slab] text-3xl font-semibold" style={{ color: "var(--m-text-heading)" }}>Plan your study blocks.</h2>

                <form onSubmit={addScheduleItem} className="mt-6 space-y-4 rounded-2xl p-4.5" style={{ backgroundColor: "var(--m-surface-alt)" }}>
                  <label className="block text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>
                    What needs a place?
                    <input value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} className="mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm font-normal outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} placeholder="e.g. Solve Linear Algebra Set #3" required />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Start time
                      <input type="text" value={planTime} onChange={(e) => setPlanTime(e.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm font-normal outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} placeholder="09:00 AM" />
                    </label>
                    <label className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Subject / Course
                      <div className="flex items-center gap-1 mt-1.5">
                        <select
                          value={planCourse}
                          onChange={(e) => {
                            if (e.target.value === "__ADD_NEW__") {
                              setSubjectsOpen(true);
                            } else {
                              setPlanCourse(e.target.value);
                            }
                          }}
                          className="w-full rounded-xl border px-3 py-2.5 text-sm font-normal outline-none cursor-pointer"
                          style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }}
                        >
                          <option value="">General Study</option>
                          {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                          <option value="__ADD_NEW__" className="font-bold">➕ Add New Subject...</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setSubjectsOpen(true)}
                          className="rounded-xl p-2.5 text-xs font-bold transition hover:opacity-80 shrink-0"
                          style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-primary)", border: "1px solid var(--m-border-light)" }}
                          title="Add New Subject"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </label>
                  </div>
                  <label className="block text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Notes
                    <input value={planNote} onChange={(e) => setPlanNote(e.target.value)} className="mt-1.5 w-full rounded-xl border px-3.5 py-2 text-sm font-normal outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} placeholder="Quiet room, 45 minutes" />
                  </label>
                  <button type="submit" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold shadow-xs transition hover:scale-105" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                    <Plus size={16} /><span>Add to Schedule</span>
                  </button>
                </form>
              </div>

              {/* Timeline */}
              <div className="rounded-[1.5rem] p-6 shadow-xs feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
                <div className="flex items-end justify-between pb-4" style={{ borderBottom: "1px solid var(--m-border-light)" }}>
                  <div>
                    <p className="font-[DM_Mono] text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--m-text-sub)" }}>Timeline</p>
                    <h2 className="mt-1 font-[Roboto_Slab] text-2xl font-semibold" style={{ color: "var(--m-text-heading)" }}>Your Schedule</h2>
                  </div>
                  <span className="rounded-full px-3 py-1 font-[DM_Mono] text-xs font-bold" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-primary)" }}>{scheduleItems.length} blocks</span>
                </div>
                <div className="mt-6 space-y-3">
                  {scheduleItems.length ? scheduleItems.map((item, idx) => (
                    <div key={item.id || idx} className={`group flex items-center gap-4 rounded-2xl p-4 transition feature-chip ${item.done ? "opacity-60" : ""}`} style={{ border: "1px solid var(--m-border-light)", backgroundColor: "var(--m-surface-hover)" }}>
                      <button onClick={() => toggleScheduleDone(item.id, item.title)} className="grid size-6 shrink-0 place-items-center rounded-full border transition" style={item.done ? { borderColor: "var(--m-primary)", backgroundColor: "var(--m-primary)", color: "white" } : { borderColor: "var(--m-border)", backgroundColor: "var(--m-surface)" }}>
                        {item.done && <Check size={14} strokeWidth={3} />}
                      </button>
                      <span className="w-16 font-[DM_Mono] text-xs font-bold" style={{ color: "var(--m-primary)" }}>{item.time}</span>
                      <span className={`h-10 w-1 shrink-0 rounded-full ${item.tone}`} />
                      <div className="min-w-0 flex-1">
                        <b className={`block text-sm ${item.done ? "line-through" : ""}`} style={{ color: "var(--m-text-heading)" }}>
                          {item.title}
                          {item.createdBy === "agent" && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase align-middle" style={{ backgroundColor: "var(--m-primary-transparent)", color: "var(--m-primary)", border: "1px solid var(--m-primary)" }}>
                              <Sparkles size={9} /> Autopilot
                            </span>
                          )}
                        </b>
                        <small className="block text-xs" style={{ color: "var(--m-text-sub)" }}>{item.course ? `${item.course} • ` : ""}{item.note}</small>
                      </div>
                      <button onClick={() => deleteScheduleItem(item.id, item.title)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition" style={{ color: "var(--m-danger)" }}><Trash2 size={16} /></button>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--m-border)" }}>
                      <CalendarDays className="mx-auto" size={32} style={{ color: "var(--m-primary)" }} />
                      <p className="mt-3 font-[Roboto_Slab] text-lg font-semibold" style={{ color: "var(--m-text-heading)" }}>No schedule blocks yet.</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--m-text-sub)" }}>Plan your first study block on the left.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ═══════════ PROJECTS VIEW ═══════════ */}
          {activeNav === "Projects" && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4" style={{ borderBottom: "1px solid var(--m-border)" }}>
                <div>
                  <p className="font-[DM_Mono] text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--m-text-sub)" }}>Course Workspaces</p>
                  <h2 className="mt-1 font-[Roboto_Slab] text-3xl font-semibold" style={{ color: "var(--m-text-heading)" }}>Your Projects</h2>
                </div>
                <button onClick={() => setSubjectsOpen(true)} className="inline-flex items-center gap-2 rounded-full px-4.5 py-2.5 text-xs font-bold shadow-xs transition hover:scale-105" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                  <Plus size={16} /><span>Create Project</span>
                </button>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.length ? subjects.map((sub) => {
                  const projectTasks = tasks.filter((t) => t.course === sub.name);
                  const openCount = projectTasks.filter((t) => !t.done).length;
                  const doneCount = projectTasks.filter((t) => t.done).length;
                  const total = projectTasks.length;
                  const projectPct = total ? Math.round((doneCount / total) * 100) : 0;
                  const subjectFiles = attachedFiles.filter((f) => f.subjectId === sub.id);
                  const gpa = subjectGPAs[sub.id];

                  return (
                    <div key={sub.id} className="group flex flex-col justify-between rounded-[1.5rem] p-5 shadow-xs transition hover:shadow-md feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
                      <div>
                        <div className="flex items-start justify-between">
                          <span className="grid size-12 place-items-center rounded-2xl shadow-xs" style={{ backgroundColor: sub.color }}><Folder size={22} style={{ color: "var(--m-primary)" }} /></span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => setEditingSubject(sub)} className="p-1.5 rounded-lg" style={{ color: "var(--m-text-sub)" }}><Edit2 size={15} /></button>
                            <button onClick={() => deleteSubject(sub.id)} className="p-1.5 rounded-lg" style={{ color: "var(--m-danger)" }}><Trash2 size={15} /></button>
                          </div>
                        </div>
                        <h3 className="mt-4 font-[Roboto_Slab] text-xl font-semibold" style={{ color: "var(--m-text-heading)" }}>{sub.name}</h3>
                        <p className="mt-1 text-xs line-clamp-2" style={{ color: "var(--m-text-sub)" }}>{sub.description || "Course workspace"}</p>
                      </div>
                      <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--m-border-light)" }}>
                        <div className="flex items-center justify-between text-xs mb-1.5 font-medium" style={{ color: "var(--m-text-sub)" }}>
                          <span>{openCount} open tasks</span>
                          <span>{projectPct}% done</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--m-surface-alt)" }}>
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${projectPct}%`, backgroundColor: "var(--m-primary)" }} />
                        </div>
                        {gpa !== undefined && (
                          <p className="mt-2 text-xs font-bold" style={{ color: "var(--m-primary)" }}>📊 Grade: {gpa}%</p>
                        )}
                        <div className="mt-3 flex items-center justify-between text-xs pt-2.5" style={{ borderTop: "1px solid var(--m-border-light)" }}>
                          <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--m-text-sub)" }}><Paperclip size={13} />{subjectFiles.length} files</span>
                          <button onClick={() => setFilesModalSubject(sub)} className="rounded-lg px-2 py-1 font-bold transition hover:opacity-80" style={{ color: "var(--m-primary)" }}>Manage →</button>
                        </div>
                        <button onClick={() => { setSelectedSubject(sub.name); setActiveNav("Today"); }} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold hover:opacity-80 feature-chip" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-primary)", border: "1px solid var(--m-border)" }}>
                          <span>Open Tasks</span><ArrowUpRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="col-span-full rounded-[1.5rem] border border-dashed p-10 text-center" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-surface)" }}>
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-primary)" }}><FolderPlus size={28} /></div>
                    <h3 className="mt-4 font-[Roboto_Slab] text-xl font-semibold" style={{ color: "var(--m-text-heading)" }}>No projects yet</h3>
                    <p className="mt-1 text-xs" style={{ color: "var(--m-text-sub)" }}>Create your first subject project to organize your studies.</p>
                    <button onClick={() => setSubjectsOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold shadow-xs transition hover:scale-105" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                      <Plus size={16} /><span>Create Project</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ═══════════ FOCUS VIEW ═══════════ */}
          {activeNav === "Focus" && (
            <section className="grid gap-5 sm:gap-7 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.5rem] p-6 shadow-xs feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5" style={{ borderBottom: "1px solid var(--m-border-light)" }}>
                  <div>
                    <p className="font-[DM_Mono] text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--m-text-sub)" }}>7-Day Focus Graph</p>
                    <h2 className="mt-1 font-[Roboto_Slab] text-2xl font-semibold" style={{ color: "var(--m-text-heading)" }}>Daily Focus Activity</h2>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full px-3 py-1 font-[DM_Mono] text-xs font-bold" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-primary)" }}>🔥 {streakDays}d streak</span>
                    <span className="rounded-full px-3 py-1 font-[DM_Mono] text-xs font-bold" style={{ backgroundColor: "var(--m-sidebar-pill-bg)", color: "var(--m-primary)" }}>{totalSessions} sessions</span>
                  </div>
                </div>
                <div className="mt-6 grid h-48 grid-cols-7 items-end gap-3 rounded-2xl p-5" style={{ backgroundColor: "var(--m-surface-hover)", border: "1px solid var(--m-border-light)" }}>
                  {graphData.map((d) => {
                    const barPct = graphMaxMinutes > 0 ? (d.minutes / graphMaxMinutes) * 100 : 0;
                    return (
                      <div key={d.dateKey} className="group relative flex h-full flex-col justify-end items-center gap-2" title={`${d.label}: ${d.minutes}m`}>
                        {d.minutes > 0 && <span className="text-[10px] font-bold font-[DM_Mono]" style={{ color: "var(--m-primary)" }}>{d.minutes}m</span>}
                        <div className="w-full max-w-[38px] rounded-t-xl transition-all duration-500" style={{ height: `${Math.max(6, barPct)}%`, backgroundColor: d.isToday ? "var(--m-primary)" : d.minutes > 0 ? "var(--m-accent)" : "var(--m-border)", opacity: d.minutes > 0 || d.isToday ? 1 : 0.4 }} />
                        <span className={`text-[11px] font-[DM_Mono] ${d.isToday ? "font-bold" : ""}`} style={{ color: d.isToday ? "var(--m-primary)" : "var(--m-text-sub)" }}>{d.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-center justify-between text-xs" style={{ color: "var(--m-text-sub)" }}>
                  <span>Today: <b style={{ color: "var(--m-primary)" }}>{formatStudyTime(todayMinutes)}</b></span>
                  <span>7-Day Total: <b style={{ color: "var(--m-primary)" }}>{formatStudyTime(totalLoggedMinutes)}</b></span>
                </div>
              </div>

              <div className="space-y-5">
                {/* Goal Card */}
                <div className="rounded-[1.5rem] p-6 shadow-md feature-zoom" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Target size={20} style={{ color: "var(--m-accent)" }} /><span className="font-[DM_Mono] text-[10px] uppercase tracking-[0.14em] opacity-90">Weekly Goal</span></div>
                    <span className="font-[DM_Mono] text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>{targetProgress}%</span>
                  </div>
                  <p className="mt-4 font-[Roboto_Slab] text-3xl font-semibold">{weeklyGoalHours}h Target</p>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/20">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${targetProgress}%`, backgroundColor: "var(--m-accent)" }} />
                  </div>
                  <p className="mt-2 text-xs opacity-90">{targetProgress >= 100 ? "🎉 Goal reached!" : `${formatStudyTime(Math.max(0, focusTargetMinutes - weeklyStudyMinutes))} remaining`}</p>
                  <div className="mt-3 flex gap-1 border-t border-black/10 pt-3">
                    {[8, 12, 16, 20].map((h) => (
                      <button key={h} onClick={() => { setWeeklyGoalHours(h); localStorage.setItem("dreamit_weekly_goal_hours", h.toString()); }} className={`px-2 py-0.5 rounded text-[10px] font-bold ${weeklyGoalHours === h ? "bg-black/30" : "opacity-75 hover:opacity-100"}`}>{h}h</button>
                    ))}
                  </div>
                </div>

                {/* Live Timer */}
                <div className="rounded-[1.5rem] p-6 shadow-xs feature-zoom" style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-[DM_Mono] text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--m-text-sub)" }}>{isBreak ? "Break Timer ☕" : "Focus Timer"}</p>
                    <span className="text-xs font-bold" style={{ color: "var(--m-primary)" }}>Session {pomodoroSession + 1}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl p-4" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border-light)" }}>
                    <div>
                      <p className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>{isBreak ? "Break" : `${timerPreset}min Focus`}</p>
                      <p className="font-[DM_Mono] text-2xl font-bold mt-1" style={{ color: "var(--m-primary)" }}>{formatTime(seconds)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsRunning((r) => !r)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition hover:scale-105 shadow-sm" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                        {isRunning ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        <span>{isRunning ? "Pause" : "Start"}</span>
                      </button>
                      <button onClick={() => { setSeconds(timerPreset * 60); setIsRunning(false); setIsBreak(false); }} className="p-2 rounded-full" style={{ color: "var(--m-text-sub)" }}><RotateCcw size={14} /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px]" style={{ color: "var(--m-text-sub)" }}>
                    <span>Presets:</span>
                    <div className="flex gap-1">
                      {[15, 25, 45, 60].map((m) => (
                        <button key={m} onClick={() => changeTimerPreset(m)} className="px-2.5 py-1 rounded-lg text-xs font-bold transition feature-chip" style={timerPreset === m ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" } : { backgroundColor: "var(--m-surface)", color: "var(--m-text-sub)", border: "1px solid var(--m-border-light)" }}>{m}m</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ═══════════ NOTES VIEW ═══════════ */}
          {activeNav === "Notes" && (
            <section className="grid gap-5 sm:gap-7 xl:grid-cols-[280px_1fr]">
              {/* Notes Sidebar List */}
              <div className="flex flex-col rounded-xl p-5 minimal-surface feature-zoom" style={{ maxHeight: "calc(100vh - 140px)" }}>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <div>
                    <h2 className="font-[Roboto_Slab] text-xl font-semibold" style={{ color: "var(--m-text-heading)" }}>Notes & Journal</h2>
                    <p className="text-[10px]" style={{ color: "var(--m-text-sub)" }}>{notes.length} total notes</p>
                  </div>
                  <button onClick={createNewNote} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition hover:scale-105 shadow-xs" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }} title="New Note">
                    <Plus size={15} /><span>New</span>
                  </button>
                </div>

                {/* Filters */}
                <div className="space-y-2 mb-3 shrink-0">
                  <input value={noteSearchQuery} onChange={(e) => setNoteSearchQuery(e.target.value)} placeholder="🔍 Search notes..." className="w-full rounded-xl px-3 py-2 text-xs outline-none border" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} />
                  <select value={noteSubjectFilter ?? ""} onChange={(e) => setNoteSubjectFilter(e.target.value ? Number(e.target.value) : null)} className="w-full rounded-xl px-3 py-2 text-xs outline-none border cursor-pointer" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }}>
                    <option value="">All Subjects ({notes.length})</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({notes.filter((n) => n.subjectId === s.id).length})</option>
                    ))}
                  </select>
                </div>

                {/* Notes List */}
                <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
                  {notes
                    .filter((n) => !noteSubjectFilter || Number(n.subjectId) === Number(noteSubjectFilter))
                    .filter((n) => !noteSearchQuery.trim() || n.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) || n.content.toLowerCase().includes(noteSearchQuery.toLowerCase()))
                    .map((note) => {
                      const noteSub = subjects.find((s) => Number(s.id) === Number(note.subjectId));
                      const isSelected = activeNote?.id === note.id;
                      return (
                        <button key={note.id} onClick={() => selectNote(note)} className="w-full text-left rounded-2xl p-3.5 transition duration-200 feature-chip" style={isSelected ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)", boxShadow: "0 4px 15px rgba(36,76,59,0.25)" } : { backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)", color: "var(--m-text)" }}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold truncate flex-1">{note.title || "Untitled Note"}</p>
                            {noteSub && (
                              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: noteSub.color }} title={noteSub.name} />
                            )}
                          </div>
                          <p className="text-[10px] mt-1.5 line-clamp-2 leading-relaxed opacity-80">{note.content.trim() || "Empty note content..."}</p>
                          <div className="mt-2.5 flex items-center justify-between text-[9px] font-[DM_Mono] opacity-70">
                            <span>{new Date(note.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            <span>{note.content.split(/\s+/).filter(Boolean).length} words</span>
                          </div>
                        </button>
                      );
                    })}
                  {notes.length === 0 && (
                    <div className="py-10 text-center">
                      <Notebook size={32} className="mx-auto opacity-40" style={{ color: "var(--m-primary)" }} />
                      <p className="mt-2 text-xs font-semibold" style={{ color: "var(--m-text-sub)" }}>No notes yet</p>
                      <p className="mt-1 text-[10px] opacity-70">Click + New to create your first note!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Note Editor Area */}
              <div className="flex flex-col rounded-xl p-5 minimal-surface feature-zoom" style={{ minHeight: "600px" }}>
                {/* Editor Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4" style={{ borderBottom: "1px solid var(--m-border-light)" }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <select value={noteSubjectId} onChange={(e) => handleSubjectChange(Number(e.target.value))} className="rounded-xl border px-3 py-1.5 text-xs font-bold outline-none cursor-pointer" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-primary)" }}>
                      <option value={0}>General Study</option>
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <span className="text-xs text-[#78887c]">|</span>
                    <span className="text-[11px] font-[DM_Mono]" style={{ color: "var(--m-text-sub)" }}>
                      {activeNote ? `Updated ${new Date(activeNote.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Draft Note"}
                    </span>
                  </div>

                  {/* Mode & Action Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* AI Summarize Button */}
                    <button onClick={summarizeNoteWithAI} disabled={isSummarizingNote || !noteDraft.trim()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-40 minimal-surface" style={{ color: "var(--m-primary)" }}>
                      {isSummarizingNote ? <Sparkles size={14} className="animate-spin" /> : <Brain size={14} />}
                      <span>{isSummarizingNote ? "Summarizing..." : "AI Summarize"}</span>
                    </button>

                    {/* Edit / Preview Tabs */}
                    <div className="flex rounded-xl p-1 text-xs font-bold" style={{ backgroundColor: "var(--m-surface-alt)" }}>
                      <button onClick={() => setNoteMode("edit")} className="rounded-lg px-3 py-1 transition" style={noteMode === "edit" ? { backgroundColor: "var(--m-surface)", color: "var(--m-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: "var(--m-text-sub)" }}>
                        📝 Edit
                      </button>
                      <button onClick={() => setNoteMode("preview")} className="rounded-lg px-3 py-1 transition" style={noteMode === "preview" ? { backgroundColor: "var(--m-surface)", color: "var(--m-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: "var(--m-text-sub)" }}>
                        👁️ Preview
                      </button>
                    </div>
                  </div>
                </div>

                {/* Note Title Input */}
                <div className="relative mb-4">
                  <input
                    value={noteTitleDraft}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Enter Note Title..."
                    className="w-full font-[Roboto_Slab] text-2xl font-bold bg-transparent outline-none px-2 py-1.5 rounded-xl border transition focus:ring-2"
                    style={{
                      color: "var(--m-text-heading)",
                      borderColor: noteTitleDraft.trim() ? "transparent" : "var(--m-border)",
                      backgroundColor: noteTitleDraft.trim() ? "transparent" : "var(--m-surface-hover)",
                      "--tw-ring-color": "var(--m-primary)",
                    } as any}
                  />
                </div>

                {/* Editor / Preview Content Body */}
                <div className="flex-1 min-h-[350px] mb-4">
                  {noteMode === "edit" ? (
                    <textarea ref={noteTextAreaRef} value={noteDraft} onChange={(e) => handleContentChange(e.target.value)} placeholder="Write your note here... (Markdown supported: # Title, **bold**, - lists, > quotes)" className="w-full h-full min-h-[350px] bg-transparent outline-none text-xs leading-6 resize-none custom-scrollbar p-1" style={{ color: "var(--m-text)" }} />
                  ) : (
                    <div className="w-full h-full min-h-[350px] overflow-y-auto custom-scrollbar p-3 rounded-xl" style={{ backgroundColor: "var(--m-surface-hover)", border: "1px solid var(--m-border-light)" }}>
                      {renderSimpleMarkdown(noteDraft)}
                    </div>
                  )}
                </div>

                {/* Footer Controls & Stats */}
                <div className="flex items-center justify-between pt-4 shrink-0" style={{ borderTop: "1px solid var(--m-border-light)" }}>
                  <div className="flex items-center gap-4 text-[10px] font-[DM_Mono]" style={{ color: "var(--m-text-muted)" }}>
                    <span>{noteDraft.length} chars</span>
                    <span>•</span>
                    <span>{noteDraft.split(/\s+/).filter(Boolean).length} words</span>
                    <span>•</span>
                    <span>~{Math.max(1, Math.ceil(noteDraft.split(/\s+/).filter(Boolean).length / 200))} min read</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeNote && (
                      <>
                        <button onClick={() => { setNoteToShare(activeNote); setShareNoteModalOpen(true); }} className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80 minimal-surface flex items-center gap-1.5" style={{ color: "var(--m-primary)" }}>
                          <Send className="w-3.5 h-3.5" />
                          Share
                        </button>
                        <button onClick={() => deleteNote(activeNote.id)} className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80 minimal-surface" style={{ color: "var(--m-danger)" }}>
                          Delete
                        </button>
                      </>
                    )}
                    <button onClick={saveNote} className="rounded-xl px-5 py-2 text-xs font-bold transition hover:scale-105 shadow-sm" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                      {activeNote ? "Save Changes" : "Save Note"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ═══════════ GRADES VIEW ═══════════ */}
          {activeNav === "Grades" && (
            <section className="space-y-7">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4" style={{ borderBottom: "1px solid var(--m-border)" }}>
                <div>
                  <p className="font-[DM_Mono] text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--m-text-sub)" }}>Academic Performance</p>
                  <h2 className="mt-1 font-[Roboto_Slab] text-3xl font-semibold" style={{ color: "var(--m-text-heading)" }}>Grade Tracker</h2>
                </div>
                {overallGPA > 0 && (
                  <div className="rounded-2xl px-5 py-3 text-center feature-chip" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                    <p className="text-[10px] font-[DM_Mono] uppercase opacity-80">Overall Average</p>
                    <p className="font-[Roboto_Slab] text-3xl font-bold">{overallGPA}%</p>
                  </div>
                )}
              </div>

              {/* Add Grade Form */}
              <form onSubmit={addGrade} className="rounded-[1.5rem] p-5 shadow-xs feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
                <p className="text-xs font-bold mb-3" style={{ color: "var(--m-text-heading)" }}>Record New Grade</p>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
                  <select value={gradeForm.subjectId} onChange={(e) => setGradeForm({ ...gradeForm, subjectId: Number(e.target.value) })} className="rounded-xl border px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} required>
                    <option value={0}>Select Subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input value={gradeForm.name} onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })} placeholder="Assignment name" className="rounded-xl border px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} required />
                  <input type="number" value={gradeForm.score} onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })} placeholder="Score" className="rounded-xl border px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} required />
                  <input type="number" value={gradeForm.total} onChange={(e) => setGradeForm({ ...gradeForm, total: e.target.value })} placeholder="Out of" className="rounded-xl border px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} required />
                  <button type="submit" className="rounded-xl px-4 py-2 text-xs font-bold transition hover:scale-105" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>Add</button>
                </div>
              </form>

              {/* Grade Cards per Subject */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map((sub) => {
                  const subGrades = grades.filter((g) => g.subjectId === sub.id);
                  const avg = subjectGPAs[sub.id] ?? 0;
                  if (subGrades.length === 0) return null;
                  return (
                    <div key={sub.id} className="rounded-[1.5rem] p-5 shadow-xs feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="size-3 rounded-full" style={{ backgroundColor: sub.color }} />
                          <h3 className="font-[Roboto_Slab] text-lg font-semibold" style={{ color: "var(--m-text-heading)" }}>{sub.name}</h3>
                        </div>
                        <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: avg >= 70 ? "#eef4ec" : "#fff0e9", color: avg >= 70 ? "#244c3b" : "#9a463f" }}>{avg}%</span>
                      </div>
                      <div className="space-y-2">
                        {subGrades.map((g) => (
                          <div key={g.id} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs feature-chip" style={{ backgroundColor: "var(--m-surface-hover)", border: "1px solid var(--m-border-light)" }}>
                            <span className="font-medium" style={{ color: "var(--m-text)" }}>{g.assignmentName}</span>
                            <span className="font-[DM_Mono] font-bold" style={{ color: "var(--m-primary)" }}>{g.score}/{g.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {grades.length === 0 && (
                <div className="rounded-[1.5rem] border border-dashed p-10 text-center" style={{ borderColor: "var(--m-border)" }}>
                  <GraduationCap size={32} className="mx-auto" style={{ color: "var(--m-primary)" }} />
                  <p className="mt-3 font-[Roboto_Slab] text-lg font-semibold" style={{ color: "var(--m-text-heading)" }}>No grades recorded yet</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--m-text-sub)" }}>Add your first assignment grade above to track your performance.</p>
                </div>
              )}
            </section>
          )}

          {/* ═══════════ FLASHCARDS VIEW ═══════════ */}
          {activeNav === "Cards" && (
            <section className="space-y-7">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4" style={{ borderBottom: "1px solid var(--m-border)" }}>
                <div>
                  <p className="font-[DM_Mono] text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--m-text-sub)" }}>Spaced Repetition</p>
                  <h2 className="mt-1 font-[Roboto_Slab] text-3xl font-semibold" style={{ color: "var(--m-text-heading)" }}>Flashcards</h2>
                </div>
                <div className="flex gap-2">
                  <select value={cardSubjectFilter ?? ""} onChange={(e) => setCardSubjectFilter(e.target.value ? Number(e.target.value) : null)} className="rounded-xl border px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }}>
                    <option value="">All Subjects</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {studyCards.length > 0 && !studyingCards && (
                    <button onClick={() => { setStudyingCards(true); setCurrentCardIndex(0); setCardFlipped(false); }} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-xs transition hover:scale-105" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                      <Brain size={14} /><span>Study ({studyCards.length} cards)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Study Mode */}
              {studyingCards && studyCards.length > 0 && (
                <div className="mx-auto max-w-lg">
                  <div className="flex items-center justify-between mb-4 text-xs" style={{ color: "var(--m-text-sub)" }}>
                    <span>Card {currentCardIndex + 1} of {studyCards.length}</span>
                    <button onClick={() => setStudyingCards(false)} className="font-bold hover:opacity-80" style={{ color: "var(--m-danger)" }}>Exit Study</button>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mb-5" style={{ backgroundColor: "var(--m-border)" }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((currentCardIndex + 1) / studyCards.length) * 100}%`, backgroundColor: "var(--m-primary)" }} />
                  </div>

                  <button onClick={() => setCardFlipped(!cardFlipped)} className="w-full min-h-[280px] rounded-[2rem] p-8 text-center shadow-lg transition-all duration-500 hover:shadow-xl cursor-pointer feature-zoom" style={{ backgroundColor: cardFlipped ? "var(--m-primary)" : "var(--m-surface)", color: cardFlipped ? "var(--m-primary-text)" : "var(--m-text)", border: `2px solid ${cardFlipped ? "var(--m-primary)" : "var(--m-border)"}`, transform: cardFlipped ? "rotateY(0deg)" : "rotateY(0deg)" }}>
                    <p className="font-[DM_Mono] text-[10px] uppercase tracking-[0.2em] opacity-60 mb-4">{cardFlipped ? "Answer" : "Question"}</p>
                    <p className="font-[Roboto_Slab] text-xl font-semibold leading-8">{cardFlipped ? studyCards[currentCardIndex].back : studyCards[currentCardIndex].front}</p>
                    {!cardFlipped && <p className="mt-6 text-xs opacity-50">Click to reveal answer</p>}
                  </button>

                  {cardFlipped && (
                    <div className="mt-5 flex justify-center gap-3">
                      {[
                        { label: "Hard", difficulty: "hard" as const, color: "#e74c3c" },
                        { label: "Medium", difficulty: "medium" as const, color: "#f39c12" },
                        { label: "Easy", difficulty: "easy" as const, color: "#27ae60" },
                      ].map(({ label, difficulty, color }) => (
                        <button key={difficulty} onClick={() => markCardReviewed(difficulty)} className="rounded-xl px-5 py-2.5 text-xs font-bold transition hover:scale-105 shadow-sm" style={{ backgroundColor: color, color: "white" }}>{label}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Create Card Form */}
              {!studyingCards && (
                <>
                  <form onSubmit={addFlashcard} className="rounded-[1.5rem] p-5 shadow-xs feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
                    <p className="text-xs font-bold mb-3" style={{ color: "var(--m-text-heading)" }}>Create New Flashcard</p>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                      <select value={cardForm.subjectId} onChange={(e) => setCardForm({ ...cardForm, subjectId: Number(e.target.value) })} className="rounded-xl border px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} required>
                        <option value={0}>Select Subject</option>
                        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <input value={cardForm.front} onChange={(e) => setCardForm({ ...cardForm, front: e.target.value })} placeholder="Question / Front" className="rounded-xl border px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} required />
                      <input value={cardForm.back} onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })} placeholder="Answer / Back" className="rounded-xl border px-3 py-2 text-xs outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} required />
                      <button type="submit" className="rounded-xl px-4 py-2 text-xs font-bold transition hover:scale-105" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>Create</button>
                    </div>
                  </form>

                  {/* Card Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {studyCards.map((card) => {
                      const sub = subjects.find((s) => s.id === card.subjectId);
                      return (
                        <div key={card.id} className="group rounded-[1.5rem] p-5 shadow-xs transition hover:shadow-md feature-zoom" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border)" }}>
                          <div className="flex items-center justify-between mb-3">
                            {sub && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: sub.color + "40", color: "var(--m-text-heading)" }}>{sub.name}</span>}
                            <button onClick={() => setFlashcards((c) => c.filter((x) => x.id !== card.id))} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition" style={{ color: "var(--m-danger)" }}><Trash2 size={14} /></button>
                          </div>
                          <p className="text-sm font-bold" style={{ color: "var(--m-text-heading)" }}>{card.front}</p>
                          <p className="mt-2 text-xs" style={{ color: "var(--m-text-sub)" }}>{card.back}</p>
                          <p className="mt-3 text-[10px] font-[DM_Mono]" style={{ color: "var(--m-text-muted)" }}>Reviewed {card.reviewCount}x</p>
                        </div>
                      );
                    })}
                  </div>
                  {flashcards.length === 0 && (
                    <div className="rounded-[1.5rem] border border-dashed p-10 text-center" style={{ borderColor: "var(--m-border)" }}>
                      <Layers size={32} className="mx-auto" style={{ color: "var(--m-primary)" }} />
                      <p className="mt-3 font-[Roboto_Slab] text-lg font-semibold" style={{ color: "var(--m-text-heading)" }}>No flashcards yet</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--m-text-sub)" }}>Create your first flashcard above or ask AI to generate them!</p>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </section>

      {/* ─── Mobile Bottom Navigation Dock (Optimized for 1-Thumb Reach) ─── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-1.5 border-t lg:hidden pb-safe minimal-surface shadow-2xl"
        style={{
          backgroundColor: "var(--m-surface-solid)",
          borderColor: "var(--m-border-light)",
        }}
      >
        {[
          { label: "Today", icon: Sun, display: "Today" },
          { label: "Planner", icon: CalendarDays, display: "Plan" },
          { label: "Focus", icon: Target, display: "Focus" },
          { label: "Notes", icon: Notebook, display: "Notes" },
        ].map(({ label, icon: Icon, display }) => {
          const isActive = activeNav === label;
          return (
            <button
              key={label}
              onClick={() => {
                setActiveNav(label as any);
                setMobileOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 px-2.5 transition-all min-w-[50px] min-h-[44px] ${
                isActive ? "font-bold" : "opacity-75"
              }`}
              style={{
                color: isActive ? "var(--m-primary)" : "var(--m-text-sub)",
                backgroundColor: isActive ? "var(--m-surface-alt)" : "transparent",
              }}
            >
              <Icon size={18} />
              <span className="text-[10px] tracking-tight">{display}</span>
            </button>
          );
        })}

        {/* AI Tutor One-Tap Button */}
        <button
          onClick={() => setIsChatMaximized(true)}
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 px-2.5 transition-all min-w-[50px] min-h-[44px]"
          style={{ color: "var(--m-primary)" }}
        >
          <div
            className="grid size-6 place-items-center rounded-lg shadow-xs"
            style={{
              backgroundColor: "var(--m-primary)",
              color: "var(--m-primary-text)",
            }}
          >
            <Brain size={13} />
          </div>
          <span className="text-[10px] font-bold tracking-tight">AI Tutor</span>
        </button>

        {/* More / Menu Drawer Toggle */}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 px-2.5 transition-all min-w-[50px] min-h-[44px] opacity-75"
          style={{ color: "var(--m-text-sub)" }}
        >
          <Menu size={18} />
          <span className="text-[10px] tracking-tight">More</span>
        </button>
      </nav>

      {/* ═══════════ MODALS ═══════════ */}

      {/* Subject Create/Edit Modal */}
      {(subjectsOpen || editingSubject) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl md:rounded-3xl minimal-surface shadow-2xl animate-in zoom-in-95 duration-200" style={{ backgroundColor: "var(--m-surface-solid)", color: "var(--m-text)", border: "1px solid var(--m-border)" }}>
            <div className="flex items-start justify-between p-4 sm:p-6 shrink-0" style={{ borderBottom: "1px solid var(--m-border-light)" }}>
              <div>
                <p className="font-[DM_Mono] text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--m-text-sub)" }}>Subject Management</p>
                <h2 className="mt-1 font-[Roboto_Slab] text-xl sm:text-2xl font-semibold" style={{ color: "var(--m-text-heading)" }}>{editingSubject ? `Edit "${editingSubject.name}"` : "Create New Subject"}</h2>
              </div>
              <button onClick={() => { setSubjectsOpen(false); setEditingSubject(null); }} className="rounded-full p-2 hover:opacity-75"><X size={20} /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
              {editingSubject ? (
                <form onSubmit={updateSubject} className="space-y-4">
                  <label className="block text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Subject Name
                    <input value={editingSubject.name} onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })} className="mt-1.5 w-full rounded-xl border px-3.5 py-2 text-sm outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} required />
                  </label>
                  <label className="block text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Description
                    <input value={editingSubject.description || ""} onChange={(e) => setEditingSubject({ ...editingSubject, description: e.target.value })} className="mt-1.5 w-full rounded-xl border px-3.5 py-2 text-sm outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} />
                  </label>
                  <p className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Color Swatch</p>
                  <div className="flex flex-wrap gap-2">
                    {["#c8d9e9", "#f2cf91", "#b9d6c0", "#e2d6ee", "#f0b9a8", "#d97706", "#f87171", "#7dd3fc"].map((col) => (
                      <button type="button" key={col} onClick={() => setEditingSubject({ ...editingSubject, color: col })} className={`size-8 rounded-full border-2 transition ${editingSubject.color === col ? "scale-110" : ""}`} style={{ backgroundColor: col, borderColor: editingSubject.color === col ? "var(--m-primary)" : "transparent" }} />
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-4" style={{ borderTop: "1px solid var(--m-border-light)" }}>
                    <button type="button" onClick={() => setEditingSubject(null)} className="rounded-xl border px-4 py-2 text-xs font-bold" style={{ borderColor: "var(--m-border)", color: "var(--m-text-sub)" }}>Cancel</button>
                    <button type="submit" className="rounded-xl px-4 py-2 text-xs font-bold" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>Save Subject</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={addSubject} className="space-y-4">
                  <label className="block text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Subject Name
                    <input value={subjectDraft} onChange={(e) => setSubjectDraft(e.target.value)} placeholder="e.g. Mathematics, Organic Chemistry, World History" className="mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} required />
                  </label>
                  <label className="block text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Description (Optional)
                    <input value={subjectDesc} onChange={(e) => setSubjectDesc(e.target.value)} placeholder="e.g. Course syllabus, exams, assignments" className="mt-1.5 w-full rounded-xl border px-3.5 py-2 text-sm outline-none" style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-input-bg)", color: "var(--m-text)" }} />
                  </label>
                  <p className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Color Swatch</p>
                  <div className="flex flex-wrap gap-2">
                    {["#c8d9e9", "#f2cf91", "#b9d6c0", "#e2d6ee", "#f0b9a8", "#d97706", "#f87171", "#7dd3fc"].map((col) => (
                      <button type="button" key={col} onClick={() => setSubjectColor(col)} className={`size-8 rounded-full border-2 transition ${subjectColor === col ? "scale-110" : ""}`} style={{ backgroundColor: col, borderColor: subjectColor === col ? "var(--m-primary)" : "transparent" }} />
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setSubjectsOpen(false)} className="rounded-xl border px-4 py-2 text-xs font-bold" style={{ borderColor: "var(--m-border)", color: "var(--m-text-sub)" }}>Cancel</button>
                    <button type="submit" disabled={!subjectDraft.trim()} className="rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>Create Subject</button>
                  </div>
                </form>
              )}

              {/* Existing Subjects List */}
              {subjects.length > 0 && !editingSubject && (
                <div className="pt-4 space-y-3" style={{ borderTop: "1px solid var(--m-border-light)" }}>
                  <p className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Your Active Subjects ({subjects.length})</p>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {subjects.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between rounded-xl p-3 text-xs" style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold truncate" style={{ color: "var(--m-text-heading)" }}>{sub.name}</p>
                            {sub.description && <p className="text-[10px] truncate opacity-70" style={{ color: "var(--m-text-sub)" }}>{sub.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button type="button" onClick={() => setEditingSubject(sub)} className="p-1.5 rounded-lg hover:opacity-80 transition" style={{ color: "var(--m-primary)" }} title="Edit Subject">
                            <Sparkles size={14} />
                          </button>
                          <button type="button" onClick={() => deleteSubject(sub.id)} className="p-1.5 rounded-lg hover:opacity-80 transition" style={{ color: "var(--m-danger)" }} title="Delete Subject">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Files Modal */}
      {filesModalSubject && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-[1.5rem] p-6 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden minimal-surface" style={{ border: "1px solid var(--m-border)", backgroundColor: "var(--m-surface-solid)", color: "var(--m-text)" }}>
            <div className="flex items-start justify-between pb-4 shrink-0" style={{ borderBottom: "1px solid var(--m-border-light)" }}>
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl shadow-xs" style={{ backgroundColor: filesModalSubject.color }}><Folder size={24} style={{ color: "var(--m-primary)" }} /></div>
                <div>
                  <h2 className="font-[Roboto_Slab] text-xl font-bold" style={{ color: "var(--m-text-heading)" }}>{filesModalSubject.name} — Files</h2>
                  <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>Upload and manage attachments</p>
                </div>
              </div>
              <button onClick={() => setFilesModalSubject(null)} className="p-1.5 rounded-xl hover:opacity-75"><X size={20} /></button>
            </div>
            <div className="mt-5 flex-1 overflow-y-auto space-y-6 pr-1">
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: "var(--m-text-heading)" }}>Upload (Max 20MB)</p>
                <FileUpload accessToken={accessToken} userId={userId} subjectId={filesModalSubject.id} onUploadSuccess={handleUploadSuccess} allowAutopilot={true} />
              </div>
              <div>
                <h3 className="font-[Roboto_Slab] text-base font-semibold mb-3" style={{ color: "var(--m-text-heading)" }}>Files ({attachedFiles.filter((f) => f.subjectId === filesModalSubject.id).length})</h3>
                {attachedFiles.filter((f) => f.subjectId === filesModalSubject.id).length ? (
                  <div className="grid gap-3">
                    {attachedFiles.filter((f) => f.subjectId === filesModalSubject.id).map((file) => (
                      <div key={file.id} className="flex items-center justify-between rounded-2xl p-3.5 shadow-2xs" style={{ border: "1px solid var(--m-border)", backgroundColor: "var(--m-surface-hover)" }}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-primary)" }}>
                            {file.mimeType.includes("image") ? <ImageIcon size={18} /> : file.mimeType.includes("pdf") ? <FileText size={18} /> : <Paperclip size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>{file.fileName}</p>
                            <p className="text-[11px]" style={{ color: "var(--m-text-sub)" }}>Uploaded {new Date(file.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <button onClick={() => handleDownloadFile(file)} className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition hover:scale-105" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}><Download size={14} />Download</button>
                          <button onClick={() => handleDeleteFile(file)} className="p-1.5 rounded-xl transition" style={{ color: "var(--m-danger)" }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: "var(--m-border)" }}>
                    <Paperclip size={24} className="mx-auto mb-2" style={{ color: "var(--m-text-muted)" }} />
                    <p className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>No files yet</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 flex justify-end shrink-0" style={{ borderTop: "1px solid var(--m-border-light)" }}>
              <button onClick={() => setFilesModalSubject(null)} className="rounded-xl px-4 py-2 text-xs font-bold" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Share Note Modal ─── */}
      {shareNoteModalOpen && noteToShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl" style={{ backgroundColor: "var(--m-surface)", color: "var(--m-text)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold font-[Roboto_Slab]">Share Note</h3>
              <button onClick={() => setShareNoteModalOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs mb-4 opacity-80">
              Sharing: <span className="font-bold">{noteToShare.title || "Untitled"}</span>
            </p>
            {friends.length === 0 ? (
              <div className="py-6 text-center opacity-60">
                <p className="text-xs mb-4">You need to add friends before you can share notes.</p>
                <button onClick={() => { setShareNoteModalOpen(false); setFriendsModalOpen(true); }} className="px-4 py-2 rounded-xl text-xs font-bold transition hover:opacity-80" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                  Find Friends
                </button>
              </div>
            ) : (
              <form onSubmit={handleShareNoteSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block opacity-70">Select Friend</label>
                  <select
                    required
                    value={shareRecipientIdentifier}
                    onChange={(e) => setShareRecipientIdentifier(e.target.value)}
                    className="w-full rounded-xl border p-3 text-xs focus:outline-none focus:ring-2 bg-transparent"
                    style={{ borderColor: "var(--m-border-light)", color: "var(--m-text)" }}
                  >
                    <option value="" disabled style={{ color: "black" }}>Choose a mutual friend...</option>
                    {friends.map(f => {
                      const friendName = f.requester_id === userId 
                        ? f.target_actual_identifier || f.target_identifier 
                        : f.requester_identifier;
                      return <option key={f.id} value={friendName} style={{ color: "black" }}>{friendName}</option>;
                    })}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSharing || !shareRecipientIdentifier.trim()}
                  className="w-full rounded-xl py-3 text-xs font-bold transition flex items-center justify-center gap-2"
                  style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
                >
                  {isSharing ? "Sending..." : "Send Note"}
                  <Send size={14} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── Inbox Modal ─── */}
      <InboxModal
        isOpen={inboxOpen}
        onClose={() => setInboxOpen(false)}
        pendingShares={pendingShares}
        pendingFriendRequests={pendingFriendRequests}
        onAcceptFriendRequest={handleAcceptFriendRequest}
        onDeclineFriendRequest={handleDeclineFriendRequest}
        onAcceptShare={handleAcceptShare}
        onDeclineShare={handleDeclineShare}
      />

      {/* ─── Friends Modal ─── */}
      <FriendsModal
        isOpen={friendsModalOpen}
        onClose={() => setFriendsModalOpen(false)}
        friends={friends}
        userId={userId}
        addFriendDraft={addFriendDraft}
        setAddFriendDraft={setAddFriendDraft}
        isAddingFriend={isAddingFriend}
        onSendFriendRequest={handleSendFriendRequest}
      />

      {/* Toast Notification */}
      {/* ─── Theme Selector Modal ─── */}
      <ThemeSelector isOpen={themeSelectorOpen} onClose={() => setThemeSelectorOpen(false)} />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold shadow-xl animate-in fade-in slide-in-from-bottom-3 ${toast.type === "error" ? "bg-[#e74c3c] text-white" : toast.type === "info" ? "bg-[#3498db] text-white" : ""
          }`} style={toast.type === "success" ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" } : {}}>
          {toast.type === "success" && <CheckCircle2 size={16} />}
          {toast.type === "error" && <AlertCircle size={16} />}
          {toast.type === "info" && <Sparkles size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
      {/* ─── Chat Modal ─── */}
      {chatModalOpen && (
        <ChatModal
          userId={userId}
          userNameDisplay={userNameDisplay}
          friends={friends}
          onClose={() => setChatModalOpen(false)}
        />
      )}

      {/* ─── Profile Modal ─── */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 animate-in fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}>
          <div className="relative w-full max-w-4xl max-h-full overflow-y-auto custom-scrollbar rounded-3xl" style={{ backgroundColor: "var(--m-bg)", border: "1px solid var(--m-border)" }}>
            <button 
              onClick={() => setIsProfileOpen(false)} 
              className="absolute top-4 right-4 z-50 p-2 rounded-full hover:bg-black/10 transition"
              style={{ color: "var(--m-text)" }}
            >
              <X size={20} />
            </button>
            <div className="p-6">
              <UserProfile 
                appearance={{
                  baseTheme: dark,
                  variables: {
                    colorPrimary: 'var(--m-primary)',
                    colorBackground: 'var(--m-bg)',
                    colorText: 'var(--m-text)',
                    colorTextSecondary: 'var(--m-text-sub)',
                    colorInputBackground: 'var(--m-surface)',
                    colorInputBorder: 'var(--m-border)',
                  },
                  elements: {
                    card: 'shadow-none bg-transparent',
                    navbar: 'hidden md:block', // Keep navbar for desktop, but clerk handles mobile well
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

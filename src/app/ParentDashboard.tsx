import { useEffect, useState, useCallback } from "react";
import { useClerk } from "@clerk/clerk-react";
import {
  Activity,
  ArrowUpRight,
  Award,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  Flame,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Notebook,
  Palette,
  Target,
  Timer,
  Trophy,
  Users,
  Wallet,
  X,
  Zap,
  LoaderCircle,
  ChevronRight,
  FileText,
  Star,
} from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import ThemeSelector from "./components/ThemeSelector";
import {
  fetchParentReport,
  subscribeToWorkspace,
  type ParentReport,
  type Task,
  type ScheduleItem,
  type Subject,
  type NoteEntry,
  type GradeEntry,
  type Flashcard,
  type FocusLogEntry,
  type StreakData,
  type DirectMessage,
  type ChatActivityReport,
} from "../lib/supabase";
import type { FinanceData } from "../lib/finance-types";
import {
  formatCurrency,
  calculateNetWorth,
  calculateMonthlyIncome,
  calculateMonthlyExpenses,
  calculateSavingsRate,
} from "../lib/finance-calculations";

interface ParentDashboardProps {
  parentUserId: string;
  parentUsername: string;
  childUserId: string;
  childUsername: string;
  onSignOut: () => void;
}

type ParentNav = "Overview" | "Schedule" | "Subjects" | "Grades" | "Cards" | "Focus" | "Finance" | "Chat";

const navItems: { id: ParentNav; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "Overview", label: "Overview", icon: LayoutDashboard },
  { id: "Schedule", label: "Schedule & Tasks", icon: CalendarDays },
  { id: "Subjects", label: "Subjects & Notes", icon: BookOpen },
  { id: "Grades", label: "Grades", icon: GraduationCap },
  { id: "Cards", label: "Flashcards", icon: Brain },
  { id: "Focus", label: "Focus & Streak", icon: Target },
  { id: "Finance", label: "Finance", icon: Wallet },
  { id: "Chat", label: "Chat Activity", icon: MessageCircle },
];

export default function ParentDashboard({
  parentUserId,
  parentUsername,
  childUserId,
  childUsername,
  onSignOut,
}: ParentDashboardProps) {
  const { signOut } = useClerk();
  const { themeConfig } = useTheme();
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<ParentNav>("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("Just now");
  const [report, setReport] = useState<ParentReport | null>(null);

  // Derived data from report
  const workspace = report?.workspace;
  const tasks = workspace?.tasks || [];
  const scheduleItems = workspace?.scheduleItems || [];
  const subjects = workspace?.subjects || [];
  const notes = workspace?.notes || [];
  const grades = workspace?.grades || [];
  const flashcards = workspace?.flashcards || [];
  const focusLog = workspace?.focusLog || [];
  const streak = workspace?.streak;
  const finance = workspace?.finance;
  const chatActivity = report?.chatActivity || [];
  const friendCount = report?.friendCount || 0;

  const loadReport = useCallback(async (showInitialLoading = false) => {
    if (showInitialLoading) setLoading(true);
    setIsRefreshing(true);
    try {
      const data = await fetchParentReport(childUserId);
      setReport(data);
      setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err) {
      console.error("Failed to load parent report:", err);
    } finally {
      if (showInitialLoading) setLoading(false);
      setIsRefreshing(false);
    }
  }, [childUserId]);

  useEffect(() => {
    loadReport(true);

    // Auto-refresh poll every 5 seconds for rapid sync
    const interval = setInterval(() => {
      loadReport(false);
    }, 5000);

    // Subscribe to realtime workspace changes on Supabase
    const unsubscribeWorkspace = subscribeToWorkspace(childUserId, (newWorkspace) => {
      setReport((prev) => (prev ? { ...prev, workspace: newWorkspace } : null));
      setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    });

    return () => {
      clearInterval(interval);
      unsubscribeWorkspace();
    };
  }, [loadReport, childUserId]);

  const handleSignOut = async () => {
    sessionStorage.removeItem("parentMode");
    sessionStorage.removeItem("childUserId");
    sessionStorage.removeItem("childUsername");
    await signOut();
    onSignOut();
  };

  // Helper formatters
  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const completedTasks = tasks.filter((t) => t.done).length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const avgGrade = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + (g.score / g.total) * 100, 0) / grades.length) : 0;
  const totalFocusMinutes = focusLog.reduce((s, f) => s + f.minutes, 0);
  const totalMessages = chatActivity.reduce((s, c) => s + c.messageCount, 0);

  if (loading) {
    return (
      <main
        className={`dreamit-dash grid min-h-screen place-items-center font-[DM_Sans] ${themeConfig.cssClass}`}
        style={{ backgroundColor: "var(--m-bg)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <LoaderCircle className="animate-spin" size={32} style={{ color: "var(--m-primary)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--m-text-sub)" }}>
            Loading {childUsername}'s report...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`dreamit-dash flex min-h-screen font-[DM_Sans] ${themeConfig.cssClass}`}
      style={{ backgroundColor: "var(--m-bg)", color: "var(--m-text)" }}
    >
      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-30 h-screen w-64 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          backgroundColor: "var(--m-surface-solid)",
          borderRight: "1px solid var(--m-border)",
        }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--m-border-light)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="grid size-9 place-items-center rounded-xl shadow-sm"
              style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
            >
              <Eye size={18} />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>Parent Monitor</p>
              <p className="text-[10px]" style={{ color: "var(--m-text-sub)" }}>Watching: {childUsername}</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-black/5 transition"
          >
            <X size={18} style={{ color: "var(--m-text-sub)" }} />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200"
                style={{
                  backgroundColor: isActive
                    ? "color-mix(in srgb, var(--m-primary) 12%, transparent)"
                    : "transparent",
                  color: isActive ? "var(--m-primary)" : "var(--m-text-sub)",
                }}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 space-y-2" style={{ borderTop: "1px solid var(--m-border-light)" }}>
          <button
            onClick={() => setThemeSelectorOpen(true)}
            className="w-full flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition hover:opacity-80"
            style={{ color: "var(--m-text-sub)" }}
          >
            <Palette size={14} style={{ color: "var(--m-primary)" }} />
            {themeConfig.name}
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition hover:opacity-80 text-red-500"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Bar */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3"
          style={{
            backgroundColor: "color-mix(in srgb, var(--m-bg) 85%, transparent)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--m-border-light)",
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg transition hover:opacity-80"
              style={{ color: "var(--m-text-sub)" }}
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-bold" style={{ color: "var(--m-text-heading)" }}>
                📊 Monitoring: <span style={{ color: "var(--m-primary)" }}>{childUsername}</span>'s Account
              </h1>
              <p className="text-[10px] sm:text-xs" style={{ color: "var(--m-text-sub)" }}>
                Read-only view • Synced: {lastRefreshedAt} • Logged in as {parentUsername}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: "color-mix(in srgb, #22c55e 15%, transparent)",
                color: "#22c55e",
                border: "1px solid color-mix(in srgb, #22c55e 30%, transparent)",
              }}
            >
              <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              Live Sync
            </div>
            <button
              onClick={() => loadReport(false)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition hover:scale-105 disabled:opacity-50"
              style={{
                backgroundColor: "color-mix(in srgb, var(--m-primary) 10%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <Activity size={14} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Syncing..." : "Refresh"}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          {activeNav === "Overview" && (
            <OverviewSection
              tasks={tasks}
              completedTasks={completedTasks}
              totalTasks={totalTasks}
              completionRate={completionRate}
              avgGrade={avgGrade}
              totalFocusMinutes={totalFocusMinutes}
              totalMessages={totalMessages}
              friendCount={friendCount}
              streak={streak}
              subjects={subjects}
              notes={notes}
              grades={grades}
              finance={finance}
              formatDate={formatDate}
            />
          )}
          {activeNav === "Schedule" && <ScheduleSection tasks={tasks} scheduleItems={scheduleItems} formatDate={formatDate} />}
          {activeNav === "Subjects" && <SubjectsSection subjects={subjects} notes={notes} formatDate={formatDate} />}
          {activeNav === "Grades" && <GradesSection grades={grades} subjects={subjects} />}
          {activeNav === "Cards" && <FlashcardsSection flashcards={flashcards} subjects={subjects} />}
          {activeNav === "Focus" && <FocusSection focusLog={focusLog} streak={streak} />}
          {activeNav === "Finance" && <FinanceSection finance={finance} />}
          {activeNav === "Chat" && <ChatSection chatActivity={chatActivity} childUserId={childUserId} formatDate={formatDate} />}
        </div>
      </div>

      <ThemeSelector isOpen={themeSelectorOpen} onClose={() => setThemeSelectorOpen(false)} />
    </main>
  );
}

/* ═══════════════════ SECTION COMPONENTS ═══════════════════ */

function SectionCard({ children, title, icon: Icon }: { children: React.ReactNode; title: string; icon: typeof LayoutDashboard }) {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 transition-colors duration-300"
      style={{
        backgroundColor: "var(--m-surface-solid)",
        border: "1px solid var(--m-border)",
      }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="grid size-8 place-items-center rounded-lg"
          style={{
            backgroundColor: "color-mix(in srgb, var(--m-primary) 12%, transparent)",
            color: "var(--m-primary)",
          }}
        >
          <Icon size={16} />
        </div>
        <h2 className="text-sm font-bold" style={{ color: "var(--m-text-heading)" }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: typeof Zap; accent?: string }) {
  return (
    <div
      className="rounded-xl p-4 flex items-center gap-3 transition-all duration-300"
      style={{
        backgroundColor: "var(--m-surface-solid)",
        border: "1px solid var(--m-border)",
      }}
    >
      <div
        className="grid size-10 place-items-center rounded-xl shrink-0"
        style={{
          backgroundColor: accent || "color-mix(in srgb, var(--m-primary) 10%, transparent)",
          color: accent ? "#fff" : "var(--m-primary)",
        }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-lg sm:text-xl font-bold" style={{ color: "var(--m-text-heading)" }}>{value}</p>
        <p className="text-[10px] font-medium" style={{ color: "var(--m-text-sub)" }}>{label}</p>
      </div>
    </div>
  );
}

/* ─── Overview ─── */
function OverviewSection({
  tasks, completedTasks, totalTasks, completionRate, avgGrade, totalFocusMinutes,
  totalMessages, friendCount, streak, subjects, notes, grades, finance, formatDate,
}: any) {
  const accounts = finance?.accounts || [];
  const currency = finance?.profile?.currency || "INR";
  const netWorth = calculateNetWorth(accounts);
  const transactions = finance?.transactions || [];
  const totalIncomeAll = transactions.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Task Completion" value={`${completionRate}%`} icon={CheckCircle2} />
        <StatCard label="Average Grade" value={`${avgGrade}%`} icon={GraduationCap} />
        <StatCard label="Focus Minutes" value={`${totalFocusMinutes}m`} icon={Timer} />
        <StatCard label="Messages (24h)" value={totalMessages} icon={MessageCircle} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Current Streak" value={`${streak?.currentStreak || 0} days`} icon={Flame} />
        <StatCard label="Total XP" value={streak?.totalXP || 0} icon={Zap} />
        <StatCard label="Level" value={`Lvl ${streak?.level || 1}`} icon={Trophy} />
        <StatCard label="Finance Balance" value={formatCurrency(netWorth > 0 ? netWorth : totalIncomeAll, currency)} icon={Wallet} />
      </div>

      {/* Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Recent Tasks" icon={CalendarDays}>
          {tasks.length === 0 ? (
            <div className="py-5 text-center space-y-1">
              <p className="text-xs font-semibold" style={{ color: "var(--m-text-sub)" }}>No active tasks recorded</p>
              <p className="text-[10px] max-w-xs mx-auto" style={{ color: "var(--m-text-muted)" }}>
                When tasks are added in the student workspace, they automatically sync and appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {tasks.slice(0, 8).map((task: Task) => (
                <div key={task.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${task.done ? "bg-green-500 border-green-500" : ""}`}
                    style={{ borderColor: task.done ? undefined : "var(--m-border)" }}
                  >
                    {task.done && <CheckCircle2 size={10} className="text-white" />}
                  </span>
                  <span
                    className={task.done ? "line-through opacity-50" : ""}
                    style={{ color: "var(--m-text)" }}
                  >
                    {task.title}
                  </span>
                  {task.priority && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
                      style={{
                        backgroundColor:
                          task.priority === "high" ? "#ef44441a" : task.priority === "medium" ? "#f59e0b1a" : "#22c55e1a",
                        color: task.priority === "high" ? "#ef4444" : task.priority === "medium" ? "#f59e0b" : "#22c55e",
                      }}
                    >
                      {task.priority}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Subjects & Workspaces" icon={BookOpen}>
          {subjects.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No subjects configured.</p>
          ) : (
            <div className="space-y-2">
              {subjects.map((sub: Subject) => {
                const subNotes = (notes || []).filter((n: NoteEntry) => n.subjectId === sub.id);
                const subTasks = (tasks || []).filter((t: Task) => t.course?.toLowerCase() === sub.name.toLowerCase());
                return (
                  <div
                    key={sub.id}
                    className="flex items-center gap-2.5 rounded-lg p-2.5 text-xs"
                    style={{ backgroundColor: "var(--m-surface-alt)" }}
                  >
                    <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                    <span className="font-semibold" style={{ color: "var(--m-text-heading)" }}>{sub.name}</span>
                    <span className="ml-auto text-[10px] font-medium" style={{ color: "var(--m-text-sub)" }}>
                      {subNotes.length} notes • {subTasks.length} tasks
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/* ─── Schedule & Tasks ─── */
function ScheduleSection({ tasks, scheduleItems, formatDate }: { tasks: Task[]; scheduleItems: ScheduleItem[]; formatDate: (d: string) => string }) {
  return (
    <div className="space-y-4">
      <SectionCard title="All Tasks" icon={CalendarDays}>
        {tasks.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No tasks found.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-xl p-3 text-xs"
                style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}
              >
                <span
                  className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 ${task.done ? "bg-green-500 border-green-500" : ""}`}
                  style={{ borderColor: task.done ? undefined : "var(--m-border)" }}
                >
                  {task.done && <CheckCircle2 size={12} className="text-white" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${task.done ? "line-through opacity-50" : ""}`} style={{ color: "var(--m-text-heading)" }}>
                    {task.title}
                  </p>
                  <p style={{ color: "var(--m-text-sub)" }}>
                    {task.course} • {task.time}{task.deadline ? ` • Due: ${formatDate(task.deadline)}` : ""}
                  </p>
                </div>
                {task.priority && (
                  <span
                    className="text-[9px] font-bold px-2 py-1 rounded-full shrink-0"
                    style={{
                      backgroundColor: task.priority === "high" ? "#ef44441a" : task.priority === "medium" ? "#f59e0b1a" : "#22c55e1a",
                      color: task.priority === "high" ? "#ef4444" : task.priority === "medium" ? "#f59e0b" : "#22c55e",
                    }}
                  >
                    {task.priority}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Schedule" icon={Clock3}>
        {scheduleItems.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No schedule items found.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {scheduleItems.map((item, i) => (
              <div
                key={item.id || i}
                className="flex items-center gap-3 rounded-xl p-3 text-xs"
                style={{ backgroundColor: "var(--m-surface-alt)" }}
              >
                <div
                  className="grid size-8 place-items-center rounded-lg shrink-0 text-[10px] font-bold"
                  style={{ backgroundColor: "color-mix(in srgb, var(--m-primary) 10%, transparent)", color: "var(--m-primary)" }}
                >
                  {item.time}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: "var(--m-text-heading)" }}>{item.title}</p>
                  {item.note && <p style={{ color: "var(--m-text-sub)" }}>{item.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ─── Subjects & Notes ─── */
function SubjectsSection({ subjects, notes, formatDate }: { subjects: Subject[]; notes: NoteEntry[]; formatDate: (d: string) => string }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Subjects" icon={BookOpen}>
        {subjects.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No subjects found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subjects.map((sub) => {
              const subNotes = notes.filter((n) => n.subjectId === sub.id);
              return (
                <div
                  key={sub.id}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="size-3 rounded-full" style={{ backgroundColor: sub.color }} />
                    <span className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>{sub.name}</span>
                    <span className="ml-auto text-[10px] font-semibold" style={{ color: "var(--m-text-sub)" }}>
                      {subNotes.length} notes
                    </span>
                  </div>
                  {sub.description && (
                    <p className="text-[10px] mb-2" style={{ color: "var(--m-text-sub)" }}>{sub.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="All Notes" icon={Notebook}>
        {notes.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No notes found.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {notes.map((note) => {
              const sub = subjects.find((s) => s.id === note.subjectId);
              return (
                <div
                  key={note.id}
                  className="rounded-xl p-3 text-xs"
                  style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={12} style={{ color: "var(--m-primary)" }} />
                    <span className="font-bold" style={{ color: "var(--m-text-heading)" }}>{note.title}</span>
                    {sub && (
                      <span className="ml-auto flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ backgroundColor: sub.color }} />
                        <span style={{ color: "var(--m-text-sub)" }}>{sub.name}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] truncate" style={{ color: "var(--m-text-sub)" }}>
                    {note.content.substring(0, 150)}...
                  </p>
                  <p className="text-[9px] mt-1" style={{ color: "var(--m-text-sub)" }}>
                    Updated: {formatDate(note.updatedAt)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ─── Grades ─── */
function GradesSection({ grades, subjects }: { grades: GradeEntry[]; subjects: Subject[] }) {
  // Group grades by subject
  const gradesBySubject = new Map<number, GradeEntry[]>();
  grades.forEach((g) => {
    if (!gradesBySubject.has(g.subjectId)) gradesBySubject.set(g.subjectId, []);
    gradesBySubject.get(g.subjectId)!.push(g);
  });

  return (
    <SectionCard title="All Grades" icon={GraduationCap}>
      {grades.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No grades recorded.</p>
      ) : (
        <div className="space-y-4">
          {Array.from(gradesBySubject.entries()).map(([subId, subGrades]) => {
            const sub = subjects.find((s) => s.id === subId);
            const avg = Math.round(subGrades.reduce((s, g) => s + (g.score / g.total) * 100, 0) / subGrades.length);
            return (
              <div key={subId}>
                <div className="flex items-center gap-2 mb-2">
                  {sub && <span className="size-3 rounded-full" style={{ backgroundColor: sub.color }} />}
                  <span className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>
                    {sub?.name || "Unknown Subject"}
                  </span>
                  <span className="ml-auto text-xs font-bold" style={{ color: avg >= 70 ? "#22c55e" : avg >= 50 ? "#f59e0b" : "#ef4444" }}>
                    Avg: {avg}%
                  </span>
                </div>
                <div className="space-y-1.5">
                  {subGrades.map((g) => {
                    const pct = Math.round((g.score / g.total) * 100);
                    return (
                      <div
                        key={g.id}
                        className="flex items-center gap-3 rounded-lg p-2.5 text-xs"
                        style={{ backgroundColor: "var(--m-surface-alt)" }}
                      >
                        <span style={{ color: "var(--m-text)" }}>{g.assignmentName}</span>
                        <span className="ml-auto font-bold" style={{ color: pct >= 70 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444" }}>
                          {g.score}/{g.total} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

/* ─── Flashcards ─── */
function FlashcardsSection({ flashcards, subjects }: { flashcards: Flashcard[]; subjects: Subject[] }) {
  const easyCount = flashcards.filter((f) => f.difficulty === "easy").length;
  const medCount = flashcards.filter((f) => f.difficulty === "medium").length;
  const hardCount = flashcards.filter((f) => f.difficulty === "hard").length;
  const totalReviews = flashcards.reduce((s, f) => s + f.reviewCount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Cards" value={flashcards.length} icon={Brain} />
        <StatCard label="Easy" value={easyCount} icon={CheckCircle2} />
        <StatCard label="Medium" value={medCount} icon={Star} />
        <StatCard label="Hard" value={hardCount} icon={Flame} />
      </div>
      <SectionCard title="Flashcard Details" icon={Brain}>
        <p className="text-xs mb-3" style={{ color: "var(--m-text-sub)" }}>
          Total reviews completed: <strong>{totalReviews}</strong>
        </p>
        {flashcards.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No flashcards created.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {flashcards.slice(0, 20).map((fc) => {
              const sub = subjects.find((s) => s.id === fc.subjectId);
              return (
                <div
                  key={fc.id}
                  className="rounded-lg p-3 text-xs"
                  style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: fc.difficulty === "easy" ? "#22c55e1a" : fc.difficulty === "medium" ? "#f59e0b1a" : "#ef44441a",
                        color: fc.difficulty === "easy" ? "#22c55e" : fc.difficulty === "medium" ? "#f59e0b" : "#ef4444",
                      }}
                    >
                      {fc.difficulty}
                    </span>
                    {sub && <span className="text-[10px]" style={{ color: "var(--m-text-sub)" }}>{sub.name}</span>}
                    <span className="ml-auto text-[10px]" style={{ color: "var(--m-text-sub)" }}>
                      Reviewed {fc.reviewCount}×
                    </span>
                  </div>
                  <p className="font-semibold" style={{ color: "var(--m-text-heading)" }}>{fc.front}</p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ─── Focus & Streak ─── */
function FocusSection({ focusLog, streak }: { focusLog: FocusLogEntry[]; streak?: StreakData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Current Streak" value={`${streak?.currentStreak || 0} days`} icon={Flame} />
        <StatCard label="Longest Streak" value={`${streak?.longestStreak || 0} days`} icon={Trophy} />
        <StatCard label="Total XP" value={streak?.totalXP || 0} icon={Zap} />
        <StatCard label="Level" value={streak?.level || 1} icon={Award} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Tasks Completed" value={streak?.tasksCompleted || 0} icon={CheckCircle2} />
        <StatCard label="Focus Sessions" value={streak?.focusSessionsCompleted || 0} icon={Timer} />
        <StatCard label="Cards Studied" value={streak?.flashcardsStudied || 0} icon={Brain} />
      </div>
      <SectionCard title="Focus Log (Last 7 Days)" icon={Target}>
        {focusLog.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No focus sessions recorded.</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {focusLog.slice(-7).map((entry, i) => {
              const maxMin = Math.max(...focusLog.slice(-7).map((f) => f.minutes), 1);
              const height = (entry.minutes / maxMin) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-bold" style={{ color: "var(--m-text-sub)" }}>
                    {entry.minutes}m
                  </span>
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${Math.max(height, 4)}%`,
                      backgroundColor: "var(--m-primary)",
                      opacity: 0.7 + (i / 10),
                    }}
                  />
                  <span className="text-[8px]" style={{ color: "var(--m-text-sub)" }}>
                    {new Date(entry.date).toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ─── Finance ─── */
function FinanceSection({ finance }: { finance?: FinanceData }) {
  const currency = finance?.profile?.currency || "INR";
  const accounts = finance?.accounts || [];
  const transactions = finance?.transactions || [];
  const budgets = finance?.budgets || [];
  const goals = finance?.goals || [];

  const currentMonth = new Date();
  const netWorth = calculateNetWorth(accounts);
  const monthlyIncome = calculateMonthlyIncome(transactions, currentMonth);
  const monthlyExpenses = calculateMonthlyExpenses(transactions, currentMonth);

  const totalIncomeAll = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpensesAll = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const displayIncome = monthlyIncome > 0 ? monthlyIncome : (totalIncomeAll > 0 ? totalIncomeAll : (finance?.profile?.monthlyIncome || 0));
  const displayExpenses = monthlyExpenses > 0 ? monthlyExpenses : totalExpensesAll;
  const savings = displayIncome - displayExpenses;
  const savingsRate = displayIncome > 0 ? Math.max(0, Math.min(100, Math.round(calculateSavingsRate(displayIncome, displayExpenses)))) : 0;

  const hasAnyFinance = accounts.length > 0 || transactions.length > 0 || budgets.length > 0 || goals.length > 0 || (finance?.profile?.monthlyIncome ?? 0) > 0;

  if (!hasAnyFinance) {
    return (
      <div className="space-y-4">
        <SectionCard title="Finance Overview & Reports" icon={Wallet}>
          <div className="text-center py-10 space-y-3">
            <div
              className="size-14 mx-auto rounded-2xl grid place-items-center"
              style={{
                backgroundColor: "color-mix(in srgb, var(--m-primary) 12%, transparent)",
                color: "var(--m-primary)",
              }}
            >
              <Wallet size={28} />
            </div>
            <h3 className="text-sm font-bold" style={{ color: "var(--m-text-heading)" }}>
              No Financial Records Logged Yet
            </h3>
            <p className="text-xs max-w-md mx-auto leading-relaxed" style={{ color: "var(--m-text-sub)" }}>
              When your child logs expenses, income, links accounts, sets budgets, or saves for goals in their Money dashboard, their complete financial records will sync and update here automatically.
            </p>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Balance / Net Worth" value={formatCurrency(netWorth > 0 ? netWorth : (totalIncomeAll - totalExpensesAll), currency)} icon={Wallet} />
        <StatCard label="Total Income" value={formatCurrency(displayIncome, currency)} icon={ArrowUpRight} />
        <StatCard label="Total Expenses" value={formatCurrency(displayExpenses, currency)} icon={CreditCard} />
        <StatCard label="Savings Rate" value={`${savingsRate}%`} icon={Target} />
      </div>

      {/* Linked Accounts */}
      <SectionCard title="Bank & Wallet Accounts" icon={Wallet}>
        {accounts.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No specific bank accounts configured.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-xl p-3.5 flex items-center justify-between"
                style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}
              >
                <div>
                  <p className="text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>{acc.name}</p>
                  <p className="text-[10px] uppercase font-semibold mt-0.5" style={{ color: "var(--m-text-sub)" }}>
                    {acc.type}
                  </p>
                </div>
                <p className="text-sm font-bold" style={{ color: acc.balance >= 0 ? "var(--m-primary)" : "#ef4444" }}>
                  {formatCurrency(acc.balance, currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Itemized Transactions */}
      <SectionCard title="Recent Transactions (Full Transparency)" icon={ArrowUpRight}>
        {transactions.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No recent transactions recorded.</p>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {transactions.map((tx) => {
              const isIncome = tx.type === "income";
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl p-3 text-xs"
                  style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="size-8 rounded-lg grid place-items-center text-xs font-bold shrink-0"
                      style={{
                        backgroundColor: isIncome ? "#22c55e1a" : "#ef44441a",
                        color: isIncome ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {isIncome ? "+" : "-"}
                    </span>
                    <div>
                      <p className="font-semibold" style={{ color: "var(--m-text-heading)" }}>
                        {tx.description || tx.merchant || (isIncome ? "Income" : "Expense")}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--m-text-sub)" }}>
                        {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {tx.paymentMethod ? ` • ${tx.paymentMethod}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-sm" style={{ color: isIncome ? "#22c55e" : "#ef4444" }}>
                    {isIncome ? "+" : "-"}{formatCurrency(tx.amount, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Budgets & Goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Active Budgets" icon={Target}>
          {budgets.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No active budgets set.</p>
          ) : (
            <div className="space-y-2.5">
              {budgets.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl p-3 text-xs flex justify-between items-center"
                  style={{ backgroundColor: "var(--m-surface-alt)" }}
                >
                  <span className="font-bold" style={{ color: "var(--m-text-heading)" }}>Category {b.categoryId}</span>
                  <span className="font-bold" style={{ color: "var(--m-primary)" }}>{formatCurrency(b.amount, currency)} / {b.period}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Savings Goals" icon={Award}>
          {goals.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>No active savings goals.</p>
          ) : (
            <div className="space-y-2.5">
              {goals.map((g) => {
                const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
                return (
                  <div
                    key={g.id}
                    className="rounded-xl p-3 text-xs space-y-1.5"
                    style={{ backgroundColor: "var(--m-surface-alt)" }}
                  >
                    <div className="flex justify-between font-bold">
                      <span style={{ color: "var(--m-text-heading)" }}>{g.name}</span>
                      <span style={{ color: "var(--m-primary)" }}>{pct}%</span>
                    </div>
                    <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: "var(--m-primary)" }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px]" style={{ color: "var(--m-text-sub)" }}>
                      <span>Saved: {formatCurrency(g.currentAmount, currency)}</span>
                      <span>Target: {formatCurrency(g.targetAmount, currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/* ─── Chat Activity (Full Transparency) ─── */
function ChatSection({
  chatActivity,
  childUserId,
  formatDate,
}: {
  chatActivity: ChatActivityReport[];
  childUserId: string;
  formatDate: (d: string) => string;
}) {
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);
  const totalMessages = chatActivity.reduce((s, c) => s + c.messageCount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total Conversations" value={chatActivity.length} icon={Users} />
        <StatCard label="Total Messages (24h)" value={totalMessages} icon={MessageCircle} />
        <StatCard
          label="Most Active With"
          value={chatActivity.length > 0 ? chatActivity[0].friendUsername : "—"}
          icon={Star}
        />
      </div>

      <SectionCard title="Chat Conversations (Full Transparency)" icon={MessageCircle}>
        {chatActivity.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>
            No chat activity in the last 24 hours.
          </p>
        ) : (
          <div className="space-y-3">
            {chatActivity.map((convo) => (
              <div key={convo.friendId}>
                {/* Friend Header */}
                <button
                  onClick={() => setExpandedFriend(expandedFriend === convo.friendId ? null : convo.friendId)}
                  className="w-full flex items-center gap-3 rounded-xl p-3 text-xs transition-all hover:opacity-80"
                  style={{
                    backgroundColor: "var(--m-surface-alt)",
                    border: expandedFriend === convo.friendId ? "1px solid var(--m-primary)" : "1px solid var(--m-border-light)",
                  }}
                >
                  <div
                    className="grid size-8 place-items-center rounded-full text-[10px] font-bold shrink-0"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)",
                      color: "var(--m-primary)",
                    }}
                  >
                    {convo.friendUsername[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold" style={{ color: "var(--m-text-heading)" }}>
                      {convo.friendUsername}
                    </p>
                    <p style={{ color: "var(--m-text-sub)" }}>
                      {convo.messageCount} messages • Last: {formatDate(convo.lastMessageAt)}
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className={`transition-transform ${expandedFriend === convo.friendId ? "rotate-90" : ""}`}
                    style={{ color: "var(--m-text-sub)" }}
                  />
                </button>

                {/* Expanded Messages */}
                {expandedFriend === convo.friendId && (
                  <div
                    className="mt-2 rounded-xl p-3 space-y-2 max-h-[300px] overflow-y-auto"
                    style={{ backgroundColor: "var(--m-bg)", border: "1px solid var(--m-border-light)" }}
                  >
                    {convo.messages.map((msg) => {
                      const isChild = msg.sender_id === childUserId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isChild ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className="max-w-[75%] rounded-2xl px-3 py-2 text-xs"
                            style={{
                              backgroundColor: isChild
                                ? "color-mix(in srgb, var(--m-primary) 15%, transparent)"
                                : "var(--m-surface-alt)",
                              border: "1px solid var(--m-border-light)",
                            }}
                          >
                            <p className="text-[9px] font-bold mb-0.5" style={{ color: "var(--m-text-sub)" }}>
                              {isChild ? "Your Child" : convo.friendUsername} • {formatDate(msg.created_at)}
                            </p>
                            <p style={{ color: "var(--m-text)" }}>{msg.content}</p>
                            {msg.file_url && (
                              <p className="text-[9px] mt-1 flex items-center gap-1" style={{ color: "var(--m-primary)" }}>
                                📎 {msg.file_name || "Attachment"}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

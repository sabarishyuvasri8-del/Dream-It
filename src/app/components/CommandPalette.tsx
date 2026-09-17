import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Timer,
  CheckSquare,
  Sparkles,
  StickyNote,
  Calendar,
  Camera,
  Users,
  MessageCircle,
  Bell,
  Palette,
  FolderPlus,
  Maximize2,
  X,
  ArrowRight,
  CornerDownLeft,
  LayoutDashboard,
  GraduationCap,
  Layers,
  Wallet,
  Clock,
  BookOpen
} from "lucide-react";
import { NoteEntry, Task, Subject } from "../../lib/supabase";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Smart Actions" | "Notes" | "Quick Actions" | "Navigation" | "Settings & Tools";
  icon: React.ReactNode;
  badge?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  // Navigation
  activeNav: string;
  onNavigate: (nav: any) => void;
  // Dynamic Actions
  onStartPomodoro: (minutes: number, subjectName?: string) => void;
  onCreateTask: (title: string) => void;
  onSearchNoteSelect: (note: NoteEntry) => void;
  onAskAI: (question: string) => void;
  // Modal Triggers
  onOpenSnapAndSolve: () => void;
  onOpenFriends: () => void;
  onOpenMessages: () => void;
  onOpenInbox: () => void;
  onOpenThemeSelector: () => void;
  onOpenSubjectsModal: () => void;
  onToggleWideAngle?: () => void;
  // Data
  notes: NoteEntry[];
  tasks: Task[];
  subjects: Subject[];
}

export default function CommandPalette({
  isOpen,
  onClose,
  activeNav,
  onNavigate,
  onStartPomodoro,
  onCreateTask,
  onSearchNoteSelect,
  onAskAI,
  onOpenSnapAndSolve,
  onOpenFriends,
  onOpenMessages,
  onOpenInbox,
  onOpenThemeSelector,
  onOpenSubjectsModal,
  onToggleWideAngle,
  notes,
  tasks,
  subjects,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input automatically when opened and reset query
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Natural Language & Query Intent Parsing
  const commandItems = useMemo<CommandItem[]>(() => {
    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();
    const items: CommandItem[] = [];

    // ─── 1. Pomodoro Intent Detection ───
    // Matches "Start 25m Pomodoro", "25m pomodoro", "pomodoro 30", "focus 45", "timer 15"
    const pomodoroMatch =
      lower.match(/^(?:start\s+)?(\d+)\s*(?:m|min|minutes)?\s*(?:pomodoro|focus|timer)/i) ||
      lower.match(/^(?:start\s+)?(?:pomodoro|focus|timer)\s*(\d+)?(?:\s*(?:m|min|minutes))?/i);

    if (pomodoroMatch) {
      const minutes = pomodoroMatch[1] ? parseInt(pomodoroMatch[1], 10) : 25;
      const validMinutes = isNaN(minutes) || minutes <= 0 ? 25 : minutes;
      items.push({
        id: `intent-pomodoro-${validMinutes}`,
        title: `Start ${validMinutes}m Focus Session`,
        subtitle: `Launch ${validMinutes}-minute Pomodoro timer with auto-tracking & analytics`,
        category: "Smart Actions",
        icon: <Timer size={16} className="text-amber-400" />,
        badge: `${validMinutes}m Focus`,
        onSelect: () => {
          onStartPomodoro(validMinutes);
          onClose();
        },
      });
    }

    // ─── 2. Task Creation Intent ───
    // Matches "Create task: Biology Homework", "task: Study for physics test", "add task: ...", "todo: ..."
    const taskMatch = lower.match(/^(?:create\s+task:|task:|add\s+task:|new\s+task:|todo:)\s*(.+)/i);
    if (taskMatch && taskMatch[1]?.trim()) {
      const taskTitle = taskMatch[1].trim();
      items.push({
        id: "intent-create-task",
        title: `Create task: "${taskTitle}"`,
        subtitle: `Add new task to today's study plan (+5 XP)`,
        category: "Smart Actions",
        icon: <CheckSquare size={16} className="text-emerald-400" />,
        badge: "New Task",
        onSelect: () => {
          onCreateTask(taskTitle);
          onClose();
        },
      });
    } else if (trimmed.length > 2 && !pomodoroMatch && !lower.startsWith("ask") && !lower.startsWith("ai:")) {
      // Provide instant "Create task: [query]" suggestion for any typed text
      items.push({
        id: "suggest-create-task",
        title: `Create task: "${trimmed}"`,
        subtitle: `Quick-add this item to your tasks list`,
        category: "Smart Actions",
        icon: <CheckSquare size={16} className="text-emerald-400" />,
        badge: "Press Enter",
        onSelect: () => {
          onCreateTask(trimmed);
          onClose();
        },
      });
    }

    // ─── 3. Ask AI Intent ───
    // Matches "Ask AI: Explain photosynthesis", "ai: How does gravity work?", "explain: ...", "tutor: ..."
    const aiMatch = lower.match(/^(?:ask\s+ai:|ai:|ask:|explain:|tutor:)\s*(.+)/i);
    if (aiMatch && aiMatch[1]?.trim()) {
      const question = aiMatch[1].trim();
      items.push({
        id: "intent-ask-ai",
        title: `Ask AI: "${question}"`,
        subtitle: `Send question to Dream It AI Tutor for step-by-step guidance`,
        category: "Smart Actions",
        icon: <Sparkles size={16} className="text-indigo-400" />,
        badge: "Dream It AI",
        onSelect: () => {
          onAskAI(question);
          onClose();
        },
      });
    } else if (trimmed.length > 2 && (lower.includes("?") || lower.startsWith("how") || lower.startsWith("what") || lower.startsWith("why") || lower.startsWith("explain"))) {
      items.push({
        id: "suggest-ask-ai",
        title: `Ask AI: "${trimmed}"`,
        subtitle: `Get instant explanation from Dream It AI companion`,
        category: "Smart Actions",
        icon: <Sparkles size={16} className="text-indigo-400" />,
        badge: "AI Assistant",
        onSelect: () => {
          onAskAI(trimmed);
          onClose();
        },
      });
    }

    // ─── 4. Notes Search & Jump ───
    // Clean note query if prefixed with "Search note:" or "note:"
    const noteSearchClean = lower.replace(/^(?:search\s+note:|note:|find\s+note:)\s*/i, "").trim();
    if (noteSearchClean) {
      const matchingNotes = notes.filter((n) => {
        const titleMatch = n.title?.toLowerCase().includes(noteSearchClean);
        const contentMatch = n.content?.toLowerCase().includes(noteSearchClean);
        return titleMatch || contentMatch;
      });

      matchingNotes.slice(0, 5).forEach((n) => {
        const subject = subjects.find((s) => s.id === n.subjectId);
        const cleanContent = (n.content || "").replace(/#+\s|[*_`]/g, "").slice(0, 75);
        items.push({
          id: `note-${n.id}`,
          title: n.title || "Untitled Note",
          subtitle: cleanContent ? `${cleanContent}...` : (subject ? `Subject: ${subject.name}` : "Personal Note"),
          category: "Notes",
          icon: <StickyNote size={16} className="text-amber-300" />,
          badge: subject?.name || "Note",
          onSelect: () => {
            onSearchNoteSelect(n);
            onClose();
          },
        });
      });
    }

    // ─── 5. Core Quick Actions ───
    const quickActions: CommandItem[] = [
      {
        id: "act-snap-solve",
        title: "Snap & Solve (Multimodal Camera Assistant)",
        subtitle: "Point camera or upload image for step-by-step math & science solving",
        category: "Quick Actions",
        icon: <Camera size={16} className="text-purple-400" />,
        badge: "Vision AI",
        onSelect: () => {
          onOpenSnapAndSolve();
          onClose();
        },
      },
      {
        id: "act-pomodoro-25",
        title: "Start 25m Pomodoro Focus",
        subtitle: "Classic 25m focus sprint + 5m break",
        category: "Quick Actions",
        icon: <Timer size={16} className="text-amber-400" />,
        badge: "Focus",
        onSelect: () => {
          onStartPomodoro(25);
          onClose();
        },
      },
      {
        id: "act-pomodoro-50",
        title: "Start 50m Deep Work Session",
        subtitle: "Extended 50m study sprint for heavy topics",
        category: "Quick Actions",
        icon: <Clock size={16} className="text-blue-400" />,
        badge: "Deep Work",
        onSelect: () => {
          onStartPomodoro(50);
          onClose();
        },
      },
      {
        id: "act-new-note",
        title: "Open Notes & Create Document",
        subtitle: "Open rich markdown editor with KaTeX math and flashcard generator",
        category: "Quick Actions",
        icon: <BookOpen size={16} className="text-emerald-400" />,
        badge: "Notes",
        onSelect: () => {
          onNavigate("Notes");
          onClose();
        },
      },
    ];

    // Filter quick actions if query is present
    quickActions.forEach((item) => {
      if (!trimmed || item.title.toLowerCase().includes(lower) || item.subtitle?.toLowerCase().includes(lower)) {
        items.push(item);
      }
    });

    // ─── 6. Navigation Destintions ───
    const navDestinations: { label: string; navKey: any; icon: React.ReactNode; desc: string }[] = [
      { label: "Today (Dashboard)", navKey: "Today", icon: <LayoutDashboard size={16} />, desc: "Overview, tasks, stats & streak" },
      { label: "Planner (Timeline & Calendar)", navKey: "Planner", icon: <Calendar size={16} />, desc: "Drag & drop study schedule" },
      { label: "Focus Timer (Pomodoro)", navKey: "Focus", icon: <Timer size={16} />, desc: "Focus timer and study heatmaps" },
      { label: "Notes & Knowledge Base", navKey: "Notes", icon: <StickyNote size={16} />, desc: "Markdown notes and AI summaries" },
      { label: "Projects & Course Syllabus", navKey: "Projects", icon: <FolderPlus size={16} />, desc: "Subjects, syllabi and files" },
      { label: "Flashcards (Spaced Repetition)", navKey: "Cards", icon: <Layers size={16} />, desc: "Review and memorize active decks" },
      { label: "Grade Tracker & GPA", navKey: "Grades", icon: <GraduationCap size={16} />, desc: "Grades, goals and analytics" },
      { label: "Student Budget & Expenses", navKey: "Money", icon: <Wallet size={16} />, desc: "Pocket money and allowance tracker" },
    ];

    navDestinations.forEach((dest) => {
      if (!trimmed || dest.label.toLowerCase().includes(lower) || dest.desc.toLowerCase().includes(lower)) {
        items.push({
          id: `nav-${dest.navKey}`,
          title: `Go to ${dest.label}`,
          subtitle: dest.desc,
          category: "Navigation",
          icon: dest.icon,
          badge: activeNav === dest.navKey ? "Current Tab" : undefined,
          onSelect: () => {
            onNavigate(dest.navKey);
            onClose();
          },
        });
      }
    });

    // ─── 7. Tools & Settings ───
    const toolActions: CommandItem[] = [
      {
        id: "tool-friends",
        title: "Study Friends & Study Buddy",
        subtitle: "View friends, accept requests, or invite classmates",
        category: "Settings & Tools",
        icon: <Users size={16} className="text-cyan-400" />,
        badge: "Social",
        onSelect: () => {
          onOpenFriends();
          onClose();
        },
      },
      {
        id: "tool-messages",
        title: "Direct Messages & Classmate Chat",
        subtitle: "Chat 1-on-1 with mutual study friends",
        category: "Settings & Tools",
        icon: <MessageCircle size={16} className="text-teal-400" />,
        badge: "Chat",
        onSelect: () => {
          onOpenMessages();
          onClose();
        },
      },
      {
        id: "tool-inbox",
        title: "Notifications & Shared Notes Inbox",
        subtitle: "View pending study requests and shared notes",
        category: "Settings & Tools",
        icon: <Bell size={16} className="text-amber-400" />,
        badge: "Inbox",
        onSelect: () => {
          onOpenInbox();
          onClose();
        },
      },
      {
        id: "tool-theme",
        title: "Customize Theme & Color Palette",
        subtitle: "Switch between Cyberpunk, Emerald, Minimal, Dark & Light modes",
        category: "Settings & Tools",
        icon: <Palette size={16} className="text-pink-400" />,
        badge: "Appearance",
        onSelect: () => {
          onOpenThemeSelector();
          onClose();
        },
      },
      {
        id: "tool-subjects",
        title: "Manage Subjects & Course Folders",
        subtitle: "Add, edit or reorganize academic courses",
        category: "Settings & Tools",
        icon: <FolderPlus size={16} className="text-orange-400" />,
        badge: "Courses",
        onSelect: () => {
          onOpenSubjectsModal();
          onClose();
        },
      },
    ];

    if (onToggleWideAngle) {
      toolActions.push({
        id: "tool-wide-angle",
        title: "Toggle Wide Angle Notes Mode",
        subtitle: "Expand notes section to full screen for distraction-free writing",
        category: "Settings & Tools",
        icon: <Maximize2 size={16} className="text-blue-400" />,
        badge: "Focus",
        onSelect: () => {
          onToggleWideAngle();
          onClose();
        },
      });
    }

    toolActions.forEach((tool) => {
      if (!trimmed || tool.title.toLowerCase().includes(lower) || tool.subtitle?.toLowerCase().includes(lower)) {
        items.push(tool);
      }
    });

    return items;
  }, [
    query,
    notes,
    subjects,
    activeNav,
    onStartPomodoro,
    onCreateTask,
    onAskAI,
    onSearchNoteSelect,
    onOpenSnapAndSolve,
    onNavigate,
    onOpenFriends,
    onOpenMessages,
    onOpenInbox,
    onOpenThemeSelector,
    onOpenSubjectsModal,
    onToggleWideAngle,
    onClose,
  ]);

  // Ensure selectedIndex stays within bounds when commandItems change
  useEffect(() => {
    setSelectedIndex(0);
  }, [commandItems.length, query]);

  // Keyboard navigation within the palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (commandItems.length > 0 ? (prev + 1) % commandItems.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (commandItems.length > 0 ? (prev - 1 + commandItems.length) % commandItems.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (commandItems[selectedIndex]) {
        commandItems[selectedIndex].onSelect();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Auto-scroll the selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col border transition-all duration-200"
        style={{
          backgroundColor: "var(--m-surface, #181920)",
          borderColor: "var(--m-border, rgba(255,255,255,0.1))",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 35px -5px rgba(99, 102, 241, 0.25)",
          color: "var(--m-text, #ffffff)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Bar */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b shrink-0"
          style={{ borderColor: "var(--m-border, rgba(255,255,255,0.08))" }}
        >
          <Search size={19} className="opacity-50 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, 'Start 25m Pomodoro', 'task: ...', or 'ai: ...'"
            className="flex-1 bg-transparent text-sm sm:text-base font-medium focus:outline-none placeholder:opacity-40"
            style={{ color: "var(--m-text)" }}
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-md opacity-50 hover:opacity-100 transition cursor-pointer"
              title="Clear search"
            >
              <X size={15} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded border opacity-60 border-neutral-700">
              ESC
            </kbd>
          )}
        </div>

        {/* Results Container */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2 space-y-1 custom-scrollbar"
        >
          {commandItems.length === 0 ? (
            <div className="py-12 px-6 text-center opacity-60 space-y-2">
              <Sparkles size={28} className="mx-auto opacity-40 mb-1" />
              <p className="text-sm font-semibold">No matching commands found</p>
              <p className="text-xs opacity-75 max-w-sm mx-auto">
                Tip: Type <span className="font-mono font-bold text-indigo-400">task: your task</span> to create a task, or <span className="font-mono font-bold text-amber-400">Start 25m Pomodoro</span> to begin focus.
              </p>
            </div>
          ) : (
            (() => {
              // Group items by category for clean section headers
              let runningIndex = 0;
              const categories = Array.from(new Set(commandItems.map((i) => i.category)));

              return categories.map((cat) => {
                const catItems = commandItems.filter((i) => i.category === cat);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider opacity-50">
                      {cat}
                    </div>
                    {catItems.map((item) => {
                      const itemIndex = runningIndex++;
                      const isSelected = itemIndex === selectedIndex;

                      return (
                        <div
                          key={item.id}
                          data-index={itemIndex}
                          onClick={() => item.onSelect()}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl cursor-pointer transition-all duration-100 ${
                            isSelected
                              ? "bg-indigo-600/20 dark:bg-indigo-500/25 border border-indigo-500/40 shadow-xs"
                              : "hover:bg-black/5 dark:hover:bg-white/5 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`p-2 rounded-xl shrink-0 transition ${
                                isSelected
                                  ? "bg-indigo-500/20 text-indigo-400"
                                  : "bg-black/5 dark:bg-white/5 opacity-70"
                              }`}
                            >
                              {item.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-semibold truncate leading-snug">
                                {item.title}
                              </p>
                              {item.subtitle && (
                                <p className="text-[11px] opacity-60 truncate mt-0.5">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.badge && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isSelected
                                    ? "bg-indigo-500/30 text-indigo-300"
                                    : "bg-black/10 dark:bg-white/10 opacity-70"
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                            <div
                              className={`flex items-center gap-1 text-[11px] opacity-0 transition-opacity font-medium ${
                                isSelected ? "opacity-100 text-indigo-400" : ""
                              }`}
                            >
                              <span className="hidden sm:inline">Select</span>
                              <CornerDownLeft size={13} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* Bottom Status Bar / Keyboard Hints */}
        <div
          className="flex items-center justify-between px-5 py-3 border-t text-[11px] opacity-60 shrink-0 select-none"
          style={{ borderColor: "var(--m-border, rgba(255,255,255,0.08))" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 text-[9px] font-mono">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 text-[9px] font-mono">
                ↓
              </kbd>{" "}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 text-[9px] font-mono">
                ↵
              </kbd>{" "}
              Execute
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <span>Powered by</span>
            <span className="font-bold text-indigo-400">Dream It Universal Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}

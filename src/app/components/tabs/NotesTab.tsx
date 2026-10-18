import React, { FC, RefObject, useState, useMemo, useEffect } from "react";
import {
  Plus,
  Notebook,
  Sparkles,
  Brain,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  Award,
  Zap,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  Columns,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Code,
  List,
  CheckSquare,
  Table as TableIcon,
  Play,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit3,
  Eye,
  PenSquare,
  Search,
  X,
  Trash2,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { NoteEntry, Subject, Task, ScheduleItem, GradeEntry, Flashcard } from "../../../lib/supabase";
import MarkdownRenderer from "../MarkdownRenderer";

export interface NotesTabProps {
  notes: NoteEntry[];
  subjects: Subject[];
  activeNote: NoteEntry | null;
  noteSearchQuery: string;
  setNoteSearchQuery: (q: string) => void;
  noteSubjectFilter: number | null;
  setNoteSubjectFilter: (id: number | null) => void;
  noteCountBySubject?: Map<number, number>;
  noteSubjectId: number;
  handleSubjectChange: (id: number) => void;
  noteTitleDraft: string;
  handleTitleChange: (title: string) => void;
  noteDraft: string;
  handleContentChange: (content: string) => void;
  noteMode: "edit" | "preview";
  setNoteMode: (mode: "edit" | "preview") => void;
  noteTextAreaRef?: RefObject<HTMLTextAreaElement | null>;
  isSummarizingNote?: boolean;
  summarizeNoteWithAI: () => void;
  handleOpenAIFlashcards?: (options?: { note: any; subjectId: number }) => void;
  selectNote: (note: NoteEntry) => void;
  createNewNote: () => void;
  saveNote: () => void;
  deleteNote: (id: string) => void;
  setNoteToShare?: (note: NoteEntry | null) => void;
  setShareNoteModalOpen?: (open: boolean) => void;
  // Relational Zero-Setup Subject Intelligence Props
  tasks?: Task[];
  scheduleItems?: ScheduleItem[];
  grades?: GradeEntry[];
  flashcards?: Flashcard[];
  onStartFocusSession?: (subjectName: string, durationMinutes: number) => void;
  onToggleTaskDone?: (taskId: number) => void;
}

/** Utility to strip markdown syntax and title duplication for a clean, human-readable card preview */
function stripMarkdown(content: string, title?: string, maxLength = 120): string {
  if (!content) return "Empty note content...";
  let text = content.trim();

  // Strip leading heading or first line if it duplicates the title
  if (title && title.trim()) {
    const cleanTitle = title.trim().toLowerCase();
    const firstLine = text.split("\n")[0].replace(/^#+\s*/, "").trim().toLowerCase();
    if (firstLine === cleanTitle || cleanTitle.includes(firstLine) || firstLine.includes(cleanTitle)) {
      text = text.substring(text.indexOf("\n") + 1).trim();
    }
  }

  const plain = text
    .replace(/^#+\s+/gm, "") // headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1") // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^>\s+/gm, "") // blockquotes
    .replace(/^[-*+]\s+/gm, "") // list bullets
    .replace(/^\d+\.\s+/gm, "") // ordered list
    .replace(/\$\$(.*?)\$\$/gs, "$1") // math blocks
    .replace(/\$(.*?)\$/g, "$1") // inline math
    .replace(/<[^>]*>/g, "") // html tags
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLength ? plain.slice(0, maxLength) + "…" : plain || "No additional text";
}

export const NotesTab: FC<NotesTabProps> = ({
  notes,
  subjects,
  activeNote,
  noteSearchQuery,
  setNoteSearchQuery,
  noteSubjectFilter,
  setNoteSubjectFilter,
  noteCountBySubject,
  noteSubjectId,
  handleSubjectChange,
  noteTitleDraft,
  handleTitleChange,
  noteDraft,
  handleContentChange,
  noteMode,
  setNoteMode,
  noteTextAreaRef,
  isSummarizingNote = false,
  summarizeNoteWithAI,
  handleOpenAIFlashcards,
  selectNote,
  createNewNote,
  saveNote,
  deleteNote,
  setNoteToShare,
  setShareNoteModalOpen,
  tasks = [],
  scheduleItems = [],
  grades = [],
  flashcards = [],
  onStartFocusSession,
  onToggleTaskDone,
}) => {
  const [showIntelPanel, setShowIntelPanel] = useState(false);
  const [isWideAngle, setIsWideAngle] = useState(false);
  const [showNotesSidebar, setShowNotesSidebar] = useState(true);
  const [wideContentMode, setWideContentMode] = useState<"full" | "focused">("full");

  // Mobile dedicated view state: "list" shows the cards list, "editor" shows the full-screen editor
  const [mobileActiveView, setMobileActiveView] = useState<"list" | "editor">("list");

  // Handle ESC key to exit Wide Angle mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isWideAngle) {
        setIsWideAngle(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWideAngle]);

  // Active Subject for this Note
  const currentSubject = useMemo(() => {
    return subjects.find((s) => s.id === noteSubjectId) || null;
  }, [subjects, noteSubjectId]);

  // Relational intelligence for this Subject
  const linkedSchedule = useMemo(() => {
    if (!currentSubject) return [];
    return scheduleItems.filter(
      (item) => item.course && item.course.toLowerCase() === currentSubject.name.toLowerCase()
    );
  }, [scheduleItems, currentSubject]);

  const linkedTasks = useMemo(() => {
    if (!currentSubject) return [];
    return tasks.filter(
      (t) => t.course && t.course.toLowerCase() === currentSubject.name.toLowerCase() && !t.done
    );
  }, [tasks, currentSubject]);

  const linkedGrades = useMemo(() => {
    if (!currentSubject) return [];
    return grades.filter((g) => Number(g.subjectId) === Number(currentSubject.id));
  }, [grades, currentSubject]);

  const latestGrade = useMemo(() => {
    if (!linkedGrades.length) return null;
    return linkedGrades[linkedGrades.length - 1];
  }, [linkedGrades]);

  const linkedCards = useMemo(() => {
    if (!currentSubject) return [];
    return flashcards.filter((c) => Number(c.subjectId) === Number(currentSubject.id));
  }, [flashcards, currentSubject]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => !noteSubjectFilter || Number(n.subjectId) === Number(noteSubjectFilter))
      .filter(
        (n) =>
          !noteSearchQuery.trim() ||
          n.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
          n.content.toLowerCase().includes(noteSearchQuery.toLowerCase())
      );
  }, [notes, noteSubjectFilter, noteSearchQuery]);

  // Mobile note selection handler
  const handleSelectNote = (note: NoteEntry) => {
    selectNote(note);
    setMobileActiveView("editor");
  };

  // Mobile new note handler
  const handleCreateNewNote = () => {
    createNewNote();
    setMobileActiveView("editor");
  };

  // Delete note handler
  const handleDeleteNote = (id: string) => {
    deleteNote(id);
    setMobileActiveView("list");
  };

  // Formatting Helper for Textarea
  const insertFormatting = (prefix: string, suffix: string = "", placeholder: string = "") => {
    const textarea = noteTextAreaRef?.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const replacement = prefix + (selectedText || placeholder) + suffix;

    const newContent =
      textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    handleContentChange(newContent);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selectedText || placeholder).length);
    }, 10);
  };

  return (
    <section
      className={`transition-all duration-300 w-full min-w-0 max-w-full ${
        isWideAngle
          ? "fixed inset-0 z-[45] flex gap-4 p-3 sm:p-5 md:p-6 overflow-hidden backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200"
          : `grid gap-4 sm:gap-6 items-start ${showNotesSidebar ? "xl:grid-cols-[320px_minmax(0,1fr)]" : "grid-cols-1"}`
      }`}
      style={isWideAngle ? { backgroundColor: "var(--m-bg)", color: "var(--m-text)" } : undefined}
    >
      {/* ═══════════════════════════════════════════════════════════════════════
          COLUMN 1: NOTES LIST (Responsive: Edge-to-edge on mobile list view,
          Sleek side panel on desktop)
          ═══════════════════════════════════════════════════════════════════════ */}
      {showNotesSidebar && (
        <div
          className={`flex-col w-full min-w-0 transition-all duration-200 ${
            mobileActiveView === "list" ? "flex" : "hidden"
          } xl:flex ${
            isWideAngle
              ? "h-full w-[280px] sm:w-[320px] border shadow-2xl z-10 animate-in slide-in-from-left-4 duration-200"
              : "h-auto xl:h-[calc(100vh-140px)] xl:min-h-[520px] pb-32 sm:pb-5 xl:minimal-surface xl:rounded-2xl xl:p-5"
          }`}
        >
          {/* List Header */}
          <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
            <div className="min-w-0">
              <h2 className="font-[Roboto_Slab] text-xl sm:text-2xl font-bold tracking-tight truncate" style={{ color: "var(--m-text-heading)" }}>
                Notes & Journal
              </h2>
              <p className="text-xs font-medium opacity-80" style={{ color: "var(--m-text-sub)" }}>
                {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"} {noteSubjectFilter ? "in subject" : "total"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCreateNewNote}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition hover:scale-105 active:scale-95 shadow-xs cursor-pointer shrink-0"
                style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
                title="Create New Note"
              >
                <Plus size={15} />
                <span>New</span>
              </button>
              <button
                onClick={() => setShowNotesSidebar(false)}
                className="hidden xl:flex p-1.5 rounded-lg border transition hover:opacity-80 cursor-pointer"
                style={{
                  backgroundColor: "var(--m-surface-alt)",
                  borderColor: "var(--m-border)",
                  color: "var(--m-text-sub)",
                }}
                title="Hide Notes Sidebar"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3 shrink-0">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              value={noteSearchQuery}
              onChange={(e) => setNoteSearchQuery(e.target.value)}
              placeholder="Search notes, topics, formulas..."
              className="w-full rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm outline-none border transition focus:ring-2"
              style={{
                borderColor: "var(--m-border)",
                backgroundColor: "var(--m-input-bg)",
                color: "var(--m-text)",
                fontSize: "15px",
              }}
            />
            {noteSearchQuery && (
              <button
                onClick={() => setNoteSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full opacity-60 hover:opacity-100"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Horizontal Scrollable Subject Filter Chips (Smartphone optimized) */}
          <div
            onWheel={(e) => {
              if (e.deltaY !== 0 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
            onMouseDown={(e) => {
              const el = e.currentTarget;
              el.dataset.down = "true";
              el.dataset.startX = String(e.pageX - el.offsetLeft);
              el.dataset.scrollLeft = String(el.scrollLeft);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.dataset.down = "false";
            }}
            onMouseUp={(e) => {
              e.currentTarget.dataset.down = "false";
            }}
            onMouseMove={(e) => {
              const el = e.currentTarget;
              if (el.dataset.down !== "true") return;
              e.preventDefault();
              const x = e.pageX - el.offsetLeft;
              const walk = (x - Number(el.dataset.startX || 0)) * 1.5;
              el.scrollLeft = Number(el.dataset.scrollLeft || 0) - walk;
            }}
            className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 shrink-0 no-scrollbar select-none cursor-grab active:cursor-grabbing w-full min-w-0"
            style={{
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x pan-y",
            }}
          >
            <button
              onClick={() => setNoteSubjectFilter(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
                noteSubjectFilter === null ? "shadow-xs scale-[1.02]" : "opacity-75 hover:opacity-100"
              }`}
              style={
                noteSubjectFilter === null
                  ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }
                  : { backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)", border: "1px solid var(--m-border-light)" }
              }
            >
              All ({notes.length})
            </button>
            {subjects.map((s) => {
              const count = noteCountBySubject
                ? noteCountBySubject.get(s.id) || 0
                : notes.filter((n) => Number(n.subjectId) === Number(s.id)).length;
              const isSelected = Number(noteSubjectFilter) === Number(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setNoteSubjectFilter(isSelected ? null : s.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
                    isSelected ? "shadow-xs scale-[1.02]" : "opacity-75 hover:opacity-100"
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }
                      : { backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)", border: "1px solid var(--m-border-light)" }
                  }
                >
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span>{s.name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Notes Cards List */}
          <div className="flex-1 space-y-3 overflow-visible xl:overflow-y-auto custom-scrollbar pr-0.5 mt-1">
            {filteredNotes.map((note) => {
              const noteSub = subjects.find((s) => Number(s.id) === Number(note.subjectId));
              const isSelected = activeNote?.id === note.id;
              return (
                <div
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className={`group w-full text-left rounded-2xl p-4 transition-all duration-200 cursor-pointer border minimal-surface ${
                    isSelected
                      ? "ring-2 ring-[var(--m-primary)] shadow-md"
                      : "hover:border-[var(--m-primary)]/40 hover:shadow-xs active:scale-[0.99]"
                  }`}
                  style={{
                    backgroundColor: isSelected ? "var(--m-surface-hover)" : "var(--m-surface-solid)",
                    borderColor: isSelected ? "var(--m-primary)" : "var(--m-border-light)",
                  }}
                >
                  {/* Card Header: Subject pill + Date */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {noteSub ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-tight"
                        style={{
                          backgroundColor: `${noteSub.color}18`,
                          color: noteSub.color,
                          border: `1px solid ${noteSub.color}35`,
                        }}
                      >
                        <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: noteSub.color }} />
                        <span className="truncate max-w-[130px]">{noteSub.name}</span>
                      </span>
                    ) : (
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text-muted)" }}
                      >
                        General
                      </span>
                    )}
                    <span className="text-[10px] font-[DM_Mono] shrink-0 opacity-75" style={{ color: "var(--m-text-sub)" }}>
                      {new Date(note.updatedAt || Date.now()).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Note Title */}
                  <h3 className="text-sm sm:text-base font-bold leading-snug line-clamp-2" style={{ color: "var(--m-text-heading)" }}>
                    {note.title || "Untitled Note"}
                  </h3>

                  {/* Clean Markdown-stripped preview text */}
                  <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed opacity-75" style={{ color: "var(--m-text)" }}>
                    {stripMarkdown(note.content, note.title)}
                  </p>

                  {/* Card Footer */}
                  <div
                    className="mt-3 flex items-center justify-between text-[10px] font-[DM_Mono] pt-2"
                    style={{ borderTop: "1px solid var(--m-border-light)", color: "var(--m-text-sub)" }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock size={11} className="opacity-70" />
                      <span>{Math.max(1, Math.ceil(note.content.split(/\s+/).filter(Boolean).length / 200))}m read</span>
                      <span>•</span>
                      <span>{note.content.split(/\s+/).filter(Boolean).length} words</span>
                    </span>
                    <ChevronRight size={14} className="opacity-40 group-hover:opacity-90 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}

            {filteredNotes.length === 0 && (
              <div className="py-12 px-4 text-center">
                <Notebook className="mx-auto mb-2.5 opacity-40" size={32} />
                <p className="text-xs font-semibold" style={{ color: "var(--m-text-heading)" }}>
                  {noteSearchQuery || noteSubjectFilter ? "No matching notes" : "No notes yet"}
                </p>
                <p className="text-[11px] mt-1" style={{ color: "var(--m-text-muted)" }}>
                  {noteSearchQuery || noteSubjectFilter
                    ? "Try clearing filters to see all notes."
                    : "Create your first note to start studying."}
                </p>
                <button
                  onClick={handleCreateNewNote}
                  className="mt-3.5 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition hover:scale-105 shadow-xs cursor-pointer"
                  style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
                >
                  <Plus size={13} />
                  <span>New Note</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) for 1-thumb quick note creation */}
      {mobileActiveView === "list" && (
        <button
          onClick={handleCreateNewNote}
          className="xl:hidden fixed right-5 bottom-24 z-30 flex items-center gap-2 rounded-full px-4 py-3 shadow-xl transition-all active:scale-95 cursor-pointer font-bold text-xs"
          style={{
            backgroundColor: "var(--m-primary)",
            color: "var(--m-primary-text)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
          }}
          aria-label="Create New Note"
        >
          <Plus size={18} />
          <span>New Note</span>
        </button>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          COLUMN 2: NOTE EDITOR & READER (Responsive: Full-screen on mobile
          editor view with Back button, main panel on desktop)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div
        className={`flex-col minimal-surface relative w-full min-w-0 rounded-2xl p-3.5 sm:p-6 transition-all duration-200 ${
          mobileActiveView === "editor" ? "flex" : "hidden"
        } xl:flex ${
          isWideAngle
            ? "h-full border shadow-2xl overflow-hidden"
            : "h-auto xl:h-[calc(100vh-140px)] overflow-visible xl:overflow-hidden pb-32 sm:pb-5"
        }`}
      >
        {/* ─── Editor Header Bar (Sticky on mobile for instant access) ─── */}
        <div
          className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 shrink-0 backdrop-blur-md pt-1 -mt-1 w-full"
          style={{
            borderBottom: "1px solid var(--m-border-light)",
            backgroundColor: "color-mix(in srgb, var(--m-surface-solid) 92%, transparent)",
          }}
        >
          {/* Left Actions: Mobile Back Button + Subject Picker + Sidebar Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            {/* Mobile Back Button (returns to list) */}
            <button
              onClick={() => setMobileActiveView("list")}
              className="xl:hidden inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition hover:opacity-80 active:scale-95 cursor-pointer shadow-xs shrink-0"
              style={{
                backgroundColor: "var(--m-surface-alt)",
                border: "1px solid var(--m-border)",
                color: "var(--m-primary)",
              }}
              title="Back to Notes List"
            >
              <ChevronLeft size={16} />
              <span>Notes</span>
            </button>

            {/* Desktop Show Notes Sidebar Toggle */}
            {!showNotesSidebar && (
              <button
                onClick={() => setShowNotesSidebar(true)}
                className="hidden xl:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition hover:scale-105 cursor-pointer shadow-xs"
                style={{
                  backgroundColor: "var(--m-surface-alt)",
                  color: "var(--m-primary)",
                  border: "1px solid var(--m-border)",
                }}
                title="Show Notes Sidebar"
              >
                <PanelLeftOpen size={13} />
                <span>Notes ({notes.length})</span>
              </button>
            )}

            {/* Subject Selector */}
            <div className="relative inline-flex items-center">
              <select
                value={noteSubjectId}
                onChange={(e) => handleSubjectChange(Number(e.target.value))}
                className="rounded-xl border pl-2.5 pr-6 py-1.5 text-xs font-bold outline-none cursor-pointer transition hover:opacity-90 max-w-[130px] sm:max-w-[190px] truncate appearance-none"
                style={{
                  borderColor: currentSubject ? `${currentSubject.color}50` : "var(--m-border)",
                  backgroundColor: "var(--m-input-bg)",
                  color: currentSubject ? currentSubject.color : "var(--m-primary)",
                }}
              >
                <option value={0}>General Study</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 pointer-events-none opacity-60" />
            </div>

            <span className="hidden sm:inline text-xs opacity-40">|</span>
            <span className="hidden sm:inline text-[11px] font-[DM_Mono]" style={{ color: "var(--m-text-sub)" }}>
              {activeNote
                ? `Updated ${new Date(activeNote.updatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Draft Note"}
            </span>
          </div>

          {/* Right Actions: Mode, Flashcards, AI, Subject Hub, Wide Screen */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {/* Edit / Read Segmented Switcher */}
            <div className="flex rounded-xl p-0.5 text-xs font-bold" style={{ backgroundColor: "var(--m-surface-alt)" }}>
              <button
                onClick={() => setNoteMode("edit")}
                className="rounded-lg px-2.5 py-1 transition cursor-pointer text-xs flex items-center gap-1"
                style={
                  noteMode === "edit"
                    ? {
                        backgroundColor: "var(--m-surface)",
                        color: "var(--m-primary)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      }
                    : { color: "var(--m-text-sub)" }
                }
              >
                <Edit3 size={12} />
                <span>Edit</span>
              </button>
              <button
                onClick={() => setNoteMode("preview")}
                className="rounded-lg px-2.5 py-1 transition cursor-pointer text-xs flex items-center gap-1"
                style={
                  noteMode === "preview"
                    ? {
                        backgroundColor: "var(--m-surface)",
                        color: "var(--m-primary)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      }
                    : { color: "var(--m-text-sub)" }
                }
              >
                <Eye size={12} />
                <span>Read</span>
              </button>
            </div>

            {/* Subject Intelligence Drawer Toggle */}
            <button
              onClick={() => setShowIntelPanel((prev) => !prev)}
              className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition hover:scale-105 cursor-pointer"
              style={
                showIntelPanel
                  ? {
                      backgroundColor: "var(--m-primary-transparent)",
                      color: "var(--m-primary)",
                      border: "1px solid var(--m-primary)",
                    }
                  : {
                      backgroundColor: "var(--m-surface-alt)",
                      color: "var(--m-text-sub)",
                      border: "1px solid var(--m-border)",
                    }
              }
              title="Toggle Subject Intelligence Hub"
            >
              <Zap size={13} className={showIntelPanel ? "text-amber-500 fill-amber-500" : ""} />
              <span className="hidden md:inline">Subject Hub</span>
              {showIntelPanel ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
            </button>

            {/* AI Flashcards Button */}
            {handleOpenAIFlashcards && (
              <button
                onClick={() =>
                  handleOpenAIFlashcards({
                    note:
                      activeNote ||
                      (noteDraft.trim()
                        ? {
                            id: "draft",
                            subjectId: noteSubjectId,
                            title: noteTitleDraft.trim() || "Untitled Note",
                            content: noteDraft,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          }
                        : null),
                    subjectId: noteSubjectId,
                  })
                }
                disabled={!noteDraft.trim()}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-40 border cursor-pointer"
                style={{
                  color: "var(--m-primary)",
                  borderColor: "var(--m-border)",
                  backgroundColor: "var(--m-surface-alt)",
                }}
                title="Make AI Flashcards"
              >
                <Sparkles size={13} className="text-amber-500" />
                <span className="hidden md:inline">Flashcards</span>
              </button>
            )}

            {/* AI Summarize Button */}
            <button
              onClick={summarizeNoteWithAI}
              disabled={isSummarizingNote || !noteDraft.trim()}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-40 minimal-surface cursor-pointer"
              style={{ color: "var(--m-primary)" }}
              title="AI Summarize"
            >
              {isSummarizingNote ? <Sparkles size={13} className="animate-spin" /> : <Brain size={13} />}
              <span className="hidden md:inline">{isSummarizingNote ? "Summarizing..." : "AI Summarize"}</span>
            </button>

            {/* Desktop Wide Angle Toggle Button */}
            <div className="hidden sm:flex items-center gap-1">
              {isWideAngle ? (
                <button
                  onClick={() => setIsWideAngle(false)}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition hover:scale-105 shadow-sm cursor-pointer"
                  style={{
                    backgroundColor: "var(--m-primary)",
                    color: "var(--m-primary-text)",
                  }}
                  title="Exit Wide Angle Mode (Esc)"
                >
                  <Minimize2 size={13} />
                  <span>Exit Wide</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsWideAngle(true);
                    setShowNotesSidebar(false);
                  }}
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition hover:scale-105 shadow-xs cursor-pointer"
                  style={{
                    backgroundColor: "var(--m-surface-alt)",
                    color: "var(--m-primary)",
                    border: "1px solid var(--m-border)",
                  }}
                  title="Wide Angle Fullscreen Mode"
                >
                  <Maximize2 size={13} className="text-emerald-500" />
                  <span className="hidden md:inline">Wide Angle</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Note Title Input (In edit mode or clean header in preview mode) */}
        {noteMode === "edit" ? (
          <div className={`relative mb-2 shrink-0 ${isWideAngle && wideContentMode === 'focused' ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
            <input
              value={noteTitleDraft}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter Note Title (e.g. Thermodynamics)..."
              className="w-full font-[Roboto_Slab] text-base sm:text-2xl font-bold bg-transparent outline-none px-2 py-1.5 rounded-xl border transition focus:ring-2"
              style={
                {
                  color: "var(--m-text-heading)",
                  borderColor: noteTitleDraft.trim() ? "transparent" : "var(--m-border)",
                  backgroundColor: noteTitleDraft.trim() ? "transparent" : "var(--m-surface-hover)",
                  "--tw-ring-color": "var(--m-primary)",
                  fontSize: "18px",
                } as any
              }
            />
          </div>
        ) : (
          noteTitleDraft && !noteDraft.trim().startsWith("# ") && (
            <div className={`mb-3 pb-2 border-b shrink-0 ${isWideAngle && wideContentMode === 'focused' ? 'max-w-4xl mx-auto w-full' : 'w-full'}`} style={{ borderColor: "var(--m-border-light)" }}>
              <h1 className="font-[Roboto_Slab] text-xl sm:text-2xl font-bold leading-snug" style={{ color: "var(--m-text-heading)" }}>
                {noteTitleDraft}
              </h1>
            </div>
          )
        )}

        {/* Quick Formatting Bar (Edit Mode Only - Touch-friendly horizontal scroll) */}
        {noteMode === "edit" && (
          <div
            className={`flex items-center gap-1 mb-2.5 px-2 py-1.5 rounded-xl border shrink-0 overflow-x-auto no-scrollbar ${
              isWideAngle && wideContentMode === 'focused' ? 'max-w-4xl mx-auto w-full' : 'w-full'
            }`}
            style={{
              backgroundColor: "var(--m-surface-alt)",
              borderColor: "var(--m-border-light)",
            }}
          >
            <button
              type="button"
              onClick={() => insertFormatting("# ", "", "Main Heading")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-xs font-bold shrink-0"
              title="Heading 1"
            >
              <Heading1 size={14} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("## ", "", "Subheading")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-xs font-bold shrink-0"
              title="Heading 2"
            >
              <Heading2 size={14} />
            </button>
            <span className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-0.5 shrink-0" />
            <button
              type="button"
              onClick={() => insertFormatting("**", "**", "bold text")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
              title="Bold"
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("*", "*", "italic text")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
              title="Italic"
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("`", "`", "code")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
              title="Inline Code"
            >
              <Code size={14} />
            </button>
            <span className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-0.5 shrink-0" />
            <button
              type="button"
              onClick={() => insertFormatting("- ", "", "List item")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
              title="Bullet List"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("- [ ] ", "", "Todo item")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0"
              title="Checklist Item"
            >
              <CheckSquare size={14} />
            </button>
            <button
              type="button"
              onClick={() =>
                insertFormatting(
                  "\n| Concept | Definition | Key Formula |\n| :--- | :--- | :--- |\n| ",
                  " | Example | $$E=mc^2$$ |\n",
                  "Energy"
                )
              }
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-xs flex items-center gap-1 font-medium shrink-0"
              title="Insert Table"
            >
              <TableIcon size={14} />
              <span className="text-[10px]">Table</span>
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("$$\n", "\n$$", "f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0"
              title="LaTeX Math Formula"
            >
              $$
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("> [!NOTE]\n> ", "", "Important concept to remember...")}
              className="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0"
              title="Callout Box"
            >
              Callout
            </button>
          </div>
        )}

        {/* Editor Layout: Editor Area + Subject Intelligence Panel */}
        <div className={`flex-1 min-h-0 grid gap-4 mb-3 overflow-visible xl:overflow-hidden ${showIntelPanel ? "lg:grid-cols-[1fr_300px]" : "grid-cols-1"}`}>
          {/* Note Body Area */}
          <div className={`flex flex-col h-auto xl:h-full min-h-0 overflow-visible xl:overflow-hidden ${isWideAngle && wideContentMode === 'focused' ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
            {noteMode === "edit" ? (
              <textarea
                ref={noteTextAreaRef}
                value={noteDraft}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Write your study notes here... Use the quick format bar above or standard Markdown"
                className="w-full h-auto min-h-[380px] sm:min-h-[480px] xl:h-full flex-1 bg-transparent outline-none leading-relaxed resize-y xl:resize-none custom-scrollbar p-3.5 sm:p-4 rounded-xl border border-transparent focus:border-black/10 dark:focus:border-white/10 overflow-y-auto"
                style={{ color: "var(--m-text)", fontSize: "16px" }}
              />
            ) : (
              <div
                className="w-full h-auto xl:h-full min-h-[350px] flex-1 overflow-visible xl:overflow-y-auto custom-scrollbar p-3.5 sm:p-6 rounded-2xl select-text"
                style={{ backgroundColor: "var(--m-surface-hover)", border: "1px solid var(--m-border-light)" }}
              >
                <MarkdownRenderer content={noteDraft} />
              </div>
            )}
          </div>

          {/* Zero-Setup Subject Intelligence Panel */}
          {showIntelPanel && (
            <aside
              className="flex flex-col gap-3 p-3.5 rounded-2xl border overflow-y-auto custom-scrollbar h-full min-h-0"
              style={{
                backgroundColor: "var(--m-surface-alt)",
                borderColor: "var(--m-border-light)",
              }}
            >
              {/* Subject Banner & Quick Focus Button */}
              <div
                className="p-3 rounded-xl border flex flex-col gap-2"
                style={{
                  backgroundColor: "var(--m-surface)",
                  borderColor: "var(--m-border-light)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-600 dark:text-emerald-400 font-bold">
                    ⚡ Subject Intelligence
                  </span>
                  {currentSubject && (
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: currentSubject.color }}
                      title={currentSubject.name}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm" style={{ color: "var(--m-text-heading)" }}>
                    {currentSubject ? currentSubject.name : "General Study"}
                  </h4>
                  {onStartFocusSession && currentSubject && (
                    <button
                      onClick={() => onStartFocusSession(currentSubject.name, 25)}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition hover:scale-105 shadow-xs cursor-pointer"
                      style={{
                        backgroundColor: "var(--m-primary)",
                        color: "var(--m-primary-text)",
                      }}
                      title="Start 25m Focus Session on this subject"
                    >
                      <Play size={10} fill="currentColor" />
                      <span>25m Focus</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Academic Deadlines & Upcoming Exams */}
              <div
                className="p-3 rounded-xl border space-y-2"
                style={{
                  backgroundColor: "var(--m-surface)",
                  borderColor: "var(--m-border-light)",
                }}
              >
                <div className="flex items-center justify-between text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-indigo-500" />
                    <span>Upcoming Deadlines</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60">{linkedSchedule.length}</span>
                </div>

                {linkedSchedule.length > 0 ? (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                    {linkedSchedule.slice(0, 4).map((item, i) => (
                      <div
                        key={item.id || i}
                        className="flex items-center justify-between text-[11px] p-1.5 rounded-lg border"
                        style={{
                          backgroundColor: "var(--m-surface-hover)",
                          borderColor: "var(--m-border-light)",
                        }}
                      >
                        <span className="font-medium truncate flex-1">{item.title}</span>
                        <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 shrink-0 ml-1">
                          {item.time}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] opacity-60 italic py-1">No upcoming deadlines for this course.</p>
                )}
              </div>

              {/* Subject Mastery & Latest Scores */}
              <div
                className="p-3 rounded-xl border space-y-2"
                style={{
                  backgroundColor: "var(--m-surface)",
                  borderColor: "var(--m-border-light)",
                }}
              >
                <div className="flex items-center justify-between text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>
                  <div className="flex items-center gap-1.5">
                    <Award size={13} className="text-amber-500" />
                    <span>Mastery & Performance</span>
                  </div>
                  {latestGrade && (
                    <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {Math.round((latestGrade.score / latestGrade.total) * 100)}%
                    </span>
                  )}
                </div>

                {latestGrade ? (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-200 truncate">
                      {latestGrade.assignmentName}
                    </p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono">
                      Score: {latestGrade.score}/{latestGrade.total} ({Math.round((latestGrade.score / latestGrade.total) * 100)}%)
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] opacity-60 italic py-1">No mock test scores recorded yet.</p>
                )}
              </div>

              {/* Flashcards Deck Info */}
              <div
                className="p-3 rounded-xl border space-y-2"
                style={{
                  backgroundColor: "var(--m-surface)",
                  borderColor: "var(--m-border-light)",
                }}
              >
                <div className="flex items-center justify-between text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>
                  <div className="flex items-center gap-1.5">
                    <Layers size={13} className="text-purple-500" />
                    <span>Flashcards</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60">{linkedCards.length} cards</span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] opacity-70">
                    {linkedCards.length} cards ready to review
                  </p>
                  {handleOpenAIFlashcards && (
                    <button
                      onClick={() =>
                        handleOpenAIFlashcards({
                          note: activeNote || {
                            id: "draft",
                            subjectId: noteSubjectId,
                            title: noteTitleDraft.trim() || "Untitled Note",
                            content: noteDraft,
                          },
                          subjectId: noteSubjectId,
                        })
                      }
                      disabled={!noteDraft.trim()}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold border transition hover:opacity-80 disabled:opacity-40"
                      style={{
                        borderColor: "var(--m-border)",
                        backgroundColor: "var(--m-surface-alt)",
                        color: "var(--m-primary)",
                      }}
                    >
                      + Make Cards
                    </button>
                  )}
                </div>
              </div>

              {/* Linked Active Tasks */}
              <div
                className="p-3 rounded-xl border space-y-2"
                style={{
                  backgroundColor: "var(--m-surface)",
                  borderColor: "var(--m-border-light)",
                }}
              >
                <div className="flex items-center justify-between text-xs font-bold" style={{ color: "var(--m-text-heading)" }}>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span>Active Tasks</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60">{linkedTasks.length}</span>
                </div>

                {linkedTasks.length > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {linkedTasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 text-[11px] p-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 transition"
                        style={{
                          backgroundColor: "var(--m-surface-hover)",
                          borderColor: "var(--m-border-light)",
                        }}
                      >
                        {onToggleTaskDone && (
                          <button
                            onClick={() => onToggleTaskDone(task.id)}
                            className="size-3.5 rounded border grid place-items-center shrink-0 cursor-pointer"
                            style={{ borderColor: "var(--m-border)" }}
                            title="Mark as done"
                          >
                            {task.done && <span className="size-2 bg-emerald-500 rounded-xs" />}
                          </button>
                        )}
                        <span className="truncate flex-1 font-medium">{task.title}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] opacity-60 italic py-1">No open tasks for this course.</p>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* ─── Footer Controls & Stats ─── */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 pt-3 shrink-0 mt-auto ${
            isWideAngle && wideContentMode === 'focused' ? 'max-w-4xl mx-auto w-full' : 'w-full'
          }`}
          style={{ borderTop: "1px solid var(--m-border-light)" }}
        >
          <div className="flex items-center gap-3 text-[10px] font-[DM_Mono]" style={{ color: "var(--m-text-muted)" }}>
            <span>{noteDraft.length} chars</span>
            <span>•</span>
            <span>{noteDraft.split(/\s+/).filter(Boolean).length} words</span>
            <span>•</span>
            <span>
              ~{Math.max(1, Math.ceil(noteDraft.split(/\s+/).filter(Boolean).length / 200))}m read
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeNote && (
              <>
                {setNoteToShare && setShareNoteModalOpen && (
                  <button
                    onClick={() => {
                      setNoteToShare(activeNote);
                      setShareNoteModalOpen(true);
                    }}
                    className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:opacity-80 minimal-surface flex items-center gap-1.5 cursor-pointer shadow-xs"
                    style={{ color: "var(--m-primary)" }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                )}
                <button
                  onClick={() => handleDeleteNote(activeNote.id)}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:opacity-80 minimal-surface flex items-center gap-1.5 cursor-pointer shadow-xs"
                  style={{ color: "var(--m-danger)" }}
                  title="Delete Note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </>
            )}
            <button
              onClick={saveNote}
              className="rounded-xl px-5 py-2 text-xs font-bold transition hover:scale-105 shadow-sm cursor-pointer"
              style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
            >
              {activeNote ? "Save Changes" : "Save Note"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NotesTab;

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
  ChevronRight,
  ExternalLink,
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
  const [showIntelPanel, setShowIntelPanel] = useState(true);
  const [isWideAngle, setIsWideAngle] = useState(false);
  const [showNotesSidebar, setShowNotesSidebar] = useState(true);
  const [wideContentMode, setWideContentMode] = useState<"full" | "focused">("full");

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
      className={`transition-all duration-300 ${
        isWideAngle
          ? "fixed inset-0 z-[45] flex gap-4 p-3 sm:p-5 md:p-6 overflow-hidden backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200"
          : `grid gap-5 sm:gap-7 items-start ${showNotesSidebar ? "xl:grid-cols-[280px_1fr]" : "grid-cols-1"}`
      }`}
      style={isWideAngle ? { backgroundColor: "var(--m-bg)", color: "var(--m-text)" } : undefined}
    >
      {/* Notes Sidebar List */}
      {showNotesSidebar && (
        <div
          className={`flex flex-col minimal-surface shrink-0 ${
            isWideAngle
              ? "rounded-2xl p-4 h-full w-[280px] sm:w-[320px] border shadow-2xl z-10 animate-in slide-in-from-left-4 duration-200"
              : "rounded-xl p-5 h-[calc(100vh-140px)] min-h-[500px]"
          }`}
        >
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div>
              <h2 className="font-[Roboto_Slab] text-xl font-semibold" style={{ color: "var(--m-text-heading)" }}>
                Notes & Journal
              </h2>
              <p className="text-[10px]" style={{ color: "var(--m-text-sub)" }}>
                {notes.length} total notes
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={createNewNote}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition hover:scale-105 shadow-xs cursor-pointer"
                style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
                title="New Note"
              >
                <Plus size={14} />
                <span>New</span>
              </button>
              <button
                onClick={() => setShowNotesSidebar(false)}
                className="p-1.5 rounded-lg border transition hover:opacity-80 cursor-pointer"
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

        {/* Filters */}
        <div className="space-y-2 mb-3 shrink-0">
          <input
            value={noteSearchQuery}
            onChange={(e) => setNoteSearchQuery(e.target.value)}
            placeholder="🔍 Search notes..."
            className="w-full rounded-xl px-3 py-2 text-xs outline-none border"
            style={{
              borderColor: "var(--m-border)",
              backgroundColor: "var(--m-input-bg)",
              color: "var(--m-text)",
            }}
          />
          <select
            value={noteSubjectFilter ?? ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              setNoteSubjectFilter(val);
              if (val) {
                const noteInSub = notes.find((n) => Number(n.subjectId) === Number(val));
                if (noteInSub) {
                  selectNote(noteInSub);
                } else {
                  handleSubjectChange(val);
                }
              }
            }}
            className="w-full rounded-xl px-3 py-2 text-xs outline-none border cursor-pointer"
            style={{
              borderColor: "var(--m-border)",
              backgroundColor: "var(--m-input-bg)",
              color: "var(--m-text)",
            }}
          >
            <option value="">All Subjects ({notes.length})</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({noteCountBySubject ? noteCountBySubject.get(s.id) || 0 : notes.filter((n) => n.subjectId === s.id).length})
              </option>
            ))}
          </select>
        </div>

        {/* Notes List */}
        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
          {notes
            .filter((n) => !noteSubjectFilter || Number(n.subjectId) === Number(noteSubjectFilter))
            .filter(
              (n) =>
                !noteSearchQuery.trim() ||
                n.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
                n.content.toLowerCase().includes(noteSearchQuery.toLowerCase())
            )
            .map((note) => {
              const noteSub = subjects.find((s) => Number(s.id) === Number(note.subjectId));
              const isSelected = activeNote?.id === note.id;
              return (
                <button
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className="w-full text-left rounded-2xl p-3.5 transition duration-200 feature-chip contain-note cursor-pointer"
                  style={
                    isSelected
                      ? {
                          backgroundColor: "var(--m-primary)",
                          color: "var(--m-primary-text)",
                          boxShadow: "0 4px 15px rgba(36,76,59,0.25)",
                        }
                      : {
                          backgroundColor: "var(--m-surface-alt)",
                          border: "1px solid var(--m-border-light)",
                          color: "var(--m-text)",
                        }
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold truncate flex-1">{note.title || "Untitled Note"}</p>
                    {noteSub && (
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: noteSub.color }}
                        title={noteSub.name}
                      />
                    )}
                  </div>
                  <p className="text-[10px] mt-1.5 line-clamp-2 leading-relaxed opacity-80">
                    {note.content.trim() || "Empty note content..."}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between text-[9px] font-[DM_Mono] opacity-70">
                    <span>
                      {new Date(note.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span>{note.content.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                </button>
              );
            })}
          {notes.length === 0 && (
            <div className="py-12 text-center opacity-60">
              <Notebook className="mx-auto mb-2 opacity-40" size={28} />
              <p className="text-xs">No notes found.</p>
              <p className="text-[10px] mt-1">Click "+ New" to create your first note.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Main Note Editor Container */}
      <div
        className={`flex flex-col minimal-surface relative overflow-hidden flex-1 ${
          isWideAngle
            ? "rounded-2xl p-4 sm:p-6 h-full border shadow-2xl"
            : "rounded-xl p-5 h-[calc(100vh-140px)] min-h-[500px]"
        }`}
      >
        {/* Header Bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 shrink-0"
          style={{ borderBottom: "1px solid var(--m-border-light)" }}
        >
          {/* Subject Selector, Sidebar Toggle & Metadata */}
          <div className="flex items-center gap-2 flex-wrap">
            {!showNotesSidebar && (
              <button
                onClick={() => setShowNotesSidebar(true)}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition hover:scale-105 cursor-pointer shadow-xs"
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

            {isWideAngle && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Wide Angle</span>
              </div>
            )}

            <select
              value={noteSubjectId}
              onChange={(e) => handleSubjectChange(Number(e.target.value))}
              className="rounded-xl border px-3 py-1.5 text-xs font-bold outline-none cursor-pointer transition hover:opacity-90"
              style={{
                borderColor: "var(--m-border)",
                backgroundColor: "var(--m-input-bg)",
                color: "var(--m-primary)",
              }}
            >
              <option value={0}>General Study</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <span className="text-xs text-[#78887c]">|</span>
            <span className="text-[11px] font-[DM_Mono]" style={{ color: "var(--m-text-sub)" }}>
              {activeNote
                ? `Updated ${new Date(activeNote.updatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Draft Note"}
            </span>
          </div>

          {/* Mode & Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Subject Intelligence Drawer Toggle */}
            <button
              onClick={() => setShowIntelPanel((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition hover:scale-105 cursor-pointer"
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
              title="Toggle Zero-Setup Subject Intelligence Hub"
            >
              <Zap size={14} className={showIntelPanel ? "text-amber-500 fill-amber-500" : ""} />
              <span className="hidden sm:inline">Subject Hub</span>
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
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-40 border cursor-pointer"
                style={{
                  color: "var(--m-primary)",
                  borderColor: "var(--m-border)",
                  backgroundColor: "var(--m-surface-alt)",
                }}
                title="Generate 15–20 flashcards and chapter summary from this note"
              >
                <Sparkles size={14} className="text-amber-500" />
                <span className="hidden md:inline">AI Flashcards</span>
              </button>
            )}

            {/* AI Summarize Button */}
            <button
              onClick={summarizeNoteWithAI}
              disabled={isSummarizingNote || !noteDraft.trim()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-40 minimal-surface cursor-pointer"
              style={{ color: "var(--m-primary)" }}
            >
              {isSummarizingNote ? <Sparkles size={14} className="animate-spin" /> : <Brain size={14} />}
              <span className="hidden md:inline">{isSummarizingNote ? "Summarizing..." : "AI Summarize"}</span>
            </button>

            {/* Edit / Preview Tabs */}
            <div className="flex rounded-xl p-1 text-xs font-bold" style={{ backgroundColor: "var(--m-surface-alt)" }}>
              <button
                onClick={() => setNoteMode("edit")}
                className="rounded-lg px-3 py-1 transition cursor-pointer"
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
                📝 Edit
              </button>
              <button
                onClick={() => setNoteMode("preview")}
                className="rounded-lg px-3 py-1 transition cursor-pointer"
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
                👁️ Preview
              </button>
            </div>

            {/* In Wide Angle Mode: Edge-to-Edge vs Focused reading width */}
            {isWideAngle && (
              <button
                onClick={() => setWideContentMode((m) => (m === "full" ? "focused" : "full"))}
                className="hidden sm:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition hover:scale-105 cursor-pointer"
                style={{
                  backgroundColor: "var(--m-surface-alt)",
                  color: "var(--m-text-sub)",
                  border: "1px solid var(--m-border)",
                }}
                title={wideContentMode === "full" ? "Switch to Focused Reading Width (centered)" : "Switch to Full Edge-to-Edge Width"}
              >
                <Columns size={13} />
                <span>{wideContentMode === "full" ? "Edge-to-Edge" : "Centered"}</span>
              </button>
            )}

            {/* Wide Angle Mode Toggle Button */}
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
                <span>Exit Wide Angle</span>
                <kbd className="hidden sm:inline-block text-[9px] px-1 py-0.2 rounded border border-white/30 font-mono opacity-80">
                  ESC
                </kbd>
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsWideAngle(true);
                  setShowNotesSidebar(false);
                }}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition hover:scale-105 shadow-xs cursor-pointer"
                style={{
                  backgroundColor: "var(--m-surface-alt)",
                  color: "var(--m-primary)",
                  border: "1px solid var(--m-border)",
                }}
                title="Enter Wide Angle Mode (Note will cover the entire screen)"
              >
                <Maximize2 size={13} className="text-emerald-500" />
                <span>Wide Angle</span>
              </button>
            )}
          </div>
        </div>

        {/* Note Title Input */}
        <div className={`relative mb-2 shrink-0 ${isWideAngle && wideContentMode === 'focused' ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
          <input
            value={noteTitleDraft}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Enter Note Title (e.g., Chapter 4: Thermodynamics)..."
            className="w-full font-[Roboto_Slab] text-2xl font-bold bg-transparent outline-none px-2 py-1.5 rounded-xl border transition focus:ring-2"
            style={
              {
                color: "var(--m-text-heading)",
                borderColor: noteTitleDraft.trim() ? "transparent" : "var(--m-border)",
                backgroundColor: noteTitleDraft.trim() ? "transparent" : "var(--m-surface-hover)",
                "--tw-ring-color": "var(--m-primary)",
              } as any
            }
          />
        </div>

        {/* Rich Quick-Formatting Bar (Edit Mode Only) */}
        {noteMode === "edit" && (
          <div
            className={`flex flex-wrap items-center gap-1 mb-3 px-2 py-1.5 rounded-xl border shrink-0 ${isWideAngle && wideContentMode === 'focused' ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}
            style={{
              backgroundColor: "var(--m-surface-alt)",
              borderColor: "var(--m-border-light)",
            }}
          >
            <button
              type="button"
              onClick={() => insertFormatting("# ", "", "Main Heading")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-xs font-bold"
              title="Heading 1"
            >
              <Heading1 size={14} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("## ", "", "Subheading")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-xs font-bold"
              title="Heading 2"
            >
              <Heading2 size={14} />
            </button>
            <span className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1" />
            <button
              type="button"
              onClick={() => insertFormatting("**", "**", "bold text")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
              title="Bold"
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("*", "*", "italic text")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
              title="Italic"
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("`", "`", "code")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
              title="Inline Code"
            >
              <Code size={14} />
            </button>
            <span className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1" />
            <button
              type="button"
              onClick={() => insertFormatting("- ", "", "List item")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
              title="Bullet List"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("- [ ] ", "", "Todo item")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
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
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-xs flex items-center gap-1 font-medium"
              title="Insert Table"
            >
              <TableIcon size={14} />
              <span className="text-[10px] hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("$$\n", "\n$$", "f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx")}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400"
              title="LaTeX Math Formula"
            >
              $$
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("> [!NOTE]\n> ", "", "Important concept to remember...")}
              className="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400"
              title="Callout Box"
            >
              Callout
            </button>
          </div>
        )}

        {/* Editor Layout: Editor + Subject Intelligence Panel */}
        <div className={`flex-1 min-h-0 grid gap-4 mb-3 overflow-hidden ${showIntelPanel ? "lg:grid-cols-[1fr_300px]" : "grid-cols-1"}`}>
          {/* Note Body Area */}
          <div className={`flex flex-col h-full min-h-0 overflow-hidden ${isWideAngle && wideContentMode === 'focused' ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
            {noteMode === "edit" ? (
              <textarea
                ref={noteTextAreaRef}
                value={noteDraft}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Write your study notes here... (Use the quick format bar above or standard Markdown)"
                className="w-full h-full min-h-0 flex-1 bg-transparent outline-none text-xs leading-6 resize-none custom-scrollbar p-3 rounded-xl border border-transparent focus:border-black/10 dark:focus:border-white/10 overflow-y-auto"
                style={{ color: "var(--m-text)" }}
              />
            ) : (
              <div
                className="w-full h-full min-h-0 flex-1 overflow-y-auto custom-scrollbar p-4 rounded-xl select-text"
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

        {/* Footer Controls & Stats */}
        <div
          className={`flex items-center justify-between pt-3 shrink-0 mt-auto ${isWideAngle && wideContentMode === 'focused' ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}
          style={{ borderTop: "1px solid var(--m-border-light)" }}
        >
          <div className="flex items-center gap-4 text-[10px] font-[DM_Mono]" style={{ color: "var(--m-text-muted)" }}>
            <span>{noteDraft.length} chars</span>
            <span>•</span>
            <span>{noteDraft.split(/\s+/).filter(Boolean).length} words</span>
            <span>•</span>
            <span>
              ~{Math.max(1, Math.ceil(noteDraft.split(/\s+/).filter(Boolean).length / 200))} min read
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
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80 minimal-surface flex items-center gap-1.5 cursor-pointer"
                    style={{ color: "var(--m-primary)" }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Share
                  </button>
                )}
                <button
                  onClick={() => deleteNote(activeNote.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80 minimal-surface cursor-pointer"
                  style={{ color: "var(--m-danger)" }}
                >
                  Delete
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

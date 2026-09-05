import React, { FC, RefObject } from "react";
import { Plus, Notebook, Sparkles, Brain, Send } from "lucide-react";
import { NoteEntry, Subject } from "../../../lib/supabase";
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
}) => {
  return (
    <section className="grid gap-5 sm:gap-7 xl:grid-cols-[280px_1fr]">
      {/* Notes Sidebar List */}
      <div
        className="flex flex-col rounded-xl p-5 minimal-surface feature-zoom"
        style={{ maxHeight: "calc(100vh - 140px)" }}
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
          <button
            onClick={createNewNote}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition hover:scale-105 shadow-xs cursor-pointer"
            style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
            title="New Note"
          >
            <Plus size={15} />
            <span>New</span>
          </button>
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
            onChange={(e) => setNoteSubjectFilter(e.target.value ? Number(e.target.value) : null)}
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
            <div className="py-10 text-center">
              <Notebook size={32} className="mx-auto opacity-40" style={{ color: "var(--m-primary)" }} />
              <p className="mt-2 text-xs font-semibold" style={{ color: "var(--m-text-sub)" }}>
                No notes yet
              </p>
              <p className="mt-1 text-[10px] opacity-70">Click + New to create your first note!</p>
            </div>
          )}
        </div>
      </div>

      {/* Note Editor Area */}
      <div className="flex flex-col rounded-xl p-5 minimal-surface feature-zoom" style={{ minHeight: "600px" }}>
        {/* Editor Top Bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4"
          style={{ borderBottom: "1px solid var(--m-border-light)" }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <select
              value={noteSubjectId}
              onChange={(e) => handleSubjectChange(Number(e.target.value))}
              className="rounded-xl border px-3 py-1.5 text-xs font-bold outline-none cursor-pointer"
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
                <span>AI Flashcards</span>
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
              <span>{isSummarizingNote ? "Summarizing..." : "AI Summarize"}</span>
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
          </div>
        </div>

        {/* Note Title Input */}
        <div className="relative mb-4">
          <input
            value={noteTitleDraft}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Enter Note Title..."
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

        {/* Editor / Preview Content Body */}
        <div className="flex-1 min-h-[350px] mb-4">
          {noteMode === "edit" ? (
            <textarea
              ref={noteTextAreaRef}
              value={noteDraft}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Write your note here... (Markdown supported: # Title, **bold**, - lists, > quotes)"
              className="w-full h-full min-h-[350px] bg-transparent outline-none text-xs leading-6 resize-none custom-scrollbar p-1"
              style={{ color: "var(--m-text)" }}
            />
          ) : (
            <div
              className="w-full h-full min-h-[350px] overflow-y-auto custom-scrollbar p-3 rounded-xl"
              style={{ backgroundColor: "var(--m-surface-hover)", border: "1px solid var(--m-border-light)" }}
            >
              <MarkdownRenderer content={noteDraft} />
            </div>
          )}
        </div>

        {/* Footer Controls & Stats */}
        <div
          className="flex items-center justify-between pt-4 shrink-0"
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

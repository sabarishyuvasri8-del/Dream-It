import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import {
  FileText,
  Download,
  Maximize2,
  Minimize2,
  Printer,
  Edit3,
  Eye,
  FileCheck2,
  BookOpen,
  Loader2,
  RefreshCw,
  X,
  Check,
  Sparkles,
  Copy,
} from "lucide-react";
import {
  compileMarkdownToPdf,
  downloadCompiledPdf,
  openPrintRenderedElement,
  formatPdfBytes,
  type PdfDocumentSpec,
  type CompiledPdfResult,
  type PdfStyleTheme,
} from "../../lib/pdfGenerator";

const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

export interface AIPdfSandboxCardProps {
  spec: PdfDocumentSpec;
  onSaveToNotes?: (title: string, content: string, subject?: string) => void;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

type SandboxTab = "preview" | "pdf" | "edit";

export const AIPdfSandboxCard: React.FC<AIPdfSandboxCardProps> = ({
  spec,
  onSaveToNotes,
  showToast,
}) => {
  const [title, setTitle] = useState(spec.title || "Study Document");
  const [subtitle, setSubtitle] = useState(spec.subtitle || "");
  const [subject, setSubject] = useState(spec.subject || "");
  const [content, setContent] = useState(spec.content || "");
  const [theme, setTheme] = useState<PdfStyleTheme>(spec.theme || "academic");

  const [activeTab, setActiveTab] = useState<SandboxTab>("preview");
  const [isCompiling, setIsCompiling] = useState(true);
  const [compiled, setCompiled] = useState<CompiledPdfResult | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  const paperRef = useRef<HTMLDivElement | null>(null);
  const modalPaperRef = useRef<HTMLDivElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Sync if incoming spec prop changes
  useEffect(() => {
    setTitle(spec.title || "Study Document");
    setSubtitle(spec.subtitle || "");
    setSubject(spec.subject || "");
    setContent(spec.content || "");
    if (spec.theme) setTheme(spec.theme);
  }, [spec.title, spec.subtitle, spec.subject, spec.content, spec.theme]);

  // Compile binary PDF whenever document fields or theme change (debounced for live editing)
  const runCompile = useCallback(async () => {
    setIsCompiling(true);
    setCompileError(null);
    try {
      const result = await compileMarkdownToPdf({
        title,
        subtitle,
        subject,
        filename: spec.filename,
        content,
        author: spec.author || "Dream It AI",
        createdAt: spec.createdAt,
        theme,
      });

      // Revoke previous Blob URL cleanly to prevent memory leaks
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      blobUrlRef.current = result.blobUrl;
      setCompiled(result);
    } catch (err: any) {
      console.error("[AIPdfSandboxCard] PDF compilation failed:", err);
      setCompileError(err?.message || "Failed to compile PDF document.");
    } finally {
      setIsCompiling(false);
    }
  }, [title, subtitle, subject, spec.filename, spec.author, spec.createdAt, content, theme]);

  useEffect(() => {
    const timer = setTimeout(() => {
      runCompile();
    }, 180);
    return () => clearTimeout(timer);
  }, [runCompile]);

  // Cleanup Blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // Close fullscreen studio on Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const handleDownload = () => {
    if (!compiled) return;
    downloadCompiledPdf(compiled);
    showToast?.(`Downloaded ${compiled.filename}`, "success");
  };

  const handlePrintKatex = () => {
    const targetEl = isFullscreen ? modalPaperRef.current : paperRef.current;
    if (targetEl) {
      openPrintRenderedElement(targetEl, title);
    } else {
      setActiveTab("preview");
      setTimeout(() => {
        if (paperRef.current) {
          openPrintRenderedElement(paperRef.current, title);
        }
      }, 120);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(`# ${title}\n\n${content}`);
      setCopiedMd(true);
      showToast?.("Document Markdown copied!", "success");
      setTimeout(() => setCopiedMd(false), 1800);
    } catch {
      showToast?.("Failed to copy Markdown", "error");
    }
  };

  const handleSaveToNotes = () => {
    if (!onSaveToNotes) return;
    onSaveToNotes(title, content, subject || undefined);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 2500);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const dateLabel =
    spec.createdAt ||
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Paper preview renderer shared between inline sandbox and fullscreen studio
  const renderPaperSheet = (refObj: React.RefObject<HTMLDivElement | null>) => (
    <div
      ref={refObj}
      className="mx-auto w-full max-w-[740px] rounded-lg bg-white text-[#111827] shadow-xl overflow-hidden border border-black/10"
      style={{
        fontFamily:
          theme === "minimal"
            ? '"DM Sans", system-ui, sans-serif'
            : '"Source Serif 4", Georgia, Cambria, serif',
      }}
    >
      {/* Document Cover Header matching the selected PDF theme */}
      {theme === "executive" ? (
        <div className="bg-[#0f172a] text-white px-6 sm:px-9 py-6 sm:py-7 border-t-[4px] border-indigo-500">
          <div className="text-[10px] font-sans font-bold tracking-[0.14em] uppercase text-slate-300 mb-2">
            {(subject || "DREAM IT STUDIO").toUpperCase()} &nbsp;|&nbsp; {dateLabel.toUpperCase()}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold leading-snug tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      ) : (
        <div className="px-6 sm:px-9 pt-6 sm:pt-8 pb-4 border-b border-gray-200">
          <div
            className="h-1 w-10 rounded-full mb-3"
            style={{ backgroundColor: theme === "academic" ? "#1e3a8a" : "#0f172a" }}
          />
          <div
            className="text-[10px] font-sans font-bold tracking-[0.12em] uppercase mb-1.5"
            style={{ color: theme === "academic" ? "#1e3a8a" : "#475569" }}
          >
            {(subject || "DREAM IT AI").toUpperCase()} &nbsp;•&nbsp; {dateLabel}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold leading-snug tracking-tight text-[#111827]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm italic text-gray-600 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Document Body (Full KaTeX + GFM Tables + Source Serif 4) */}
      <div
        className="px-6 sm:px-9 py-5 sm:py-7 text-[#1f2937]"
        style={
          {
            "--m-text-heading": "#111827",
            "--m-text": "#1f2937",
            "--m-text-sub": "#4b5563",
            "--m-border-light": "#e5e7eb",
            "--m-surface-alt": "#f8fafc",
            "--m-primary": theme === "executive" ? "#4f46e5" : theme === "academic" ? "#1e3a8a" : "#0f172a",
          } as React.CSSProperties
        }
      >
        <Suspense
          fallback={
            <div className="py-10 flex items-center justify-center text-xs text-gray-400 gap-2">
              <Loader2 size={14} className="animate-spin" /> Rendering document preview...
            </div>
          }
        >
          <MarkdownRenderer content={content} serif={theme !== "minimal"} />
        </Suspense>
      </div>

      {/* Subtle Paper Footer */}
      <div className="px-6 sm:px-9 py-3 border-t border-gray-200 flex items-center justify-between text-[10px] font-sans text-gray-400 bg-gray-50/70">
        <span className="truncate max-w-[70%]">Dream It PDF Sandbox • {title}</span>
        <span>{compiled ? `${compiled.pageCount} ${compiled.pageCount === 1 ? "page" : "pages"} • A4` : "A4"}</span>
      </div>
    </div>
  );

  return (
    <>
      {/* ─── Inline Sandbox Card in Chat Stream ─── */}
      <div
        className="w-full my-2.5 rounded-2xl overflow-hidden border shadow-md transition-all"
        style={{
          backgroundColor: "var(--m-surface)",
          borderColor: "var(--m-border)",
        }}
      >
        {/* Top Studio Header */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b"
          style={{
            borderColor: "var(--m-border-light)",
            backgroundColor: "var(--m-surface-alt)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="size-8 rounded-xl bg-rose-500/15 text-rose-500 border border-rose-500/25 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4
                  className="text-xs sm:text-[13px] font-bold truncate"
                  style={{ color: "var(--m-text-heading)" }}
                  title={title}
                >
                  {title}
                </h4>
                <span className="text-[9.5px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-400 shrink-0">
                  PDF Sandbox
                </span>
              </div>
              <div
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] font-mono mt-0.5"
                style={{ color: "var(--m-text-sub)" }}
              >
                {isCompiling ? (
                  <span className="inline-flex items-center gap-1 text-indigo-400">
                    <Loader2 size={10} className="animate-spin" /> Compiling PDF...
                  </span>
                ) : compiled ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-emerald-500">
                      <FileCheck2 size={11} /> Ready
                    </span>
                    <span>•</span>
                    <span>
                      {compiled.pageCount} {compiled.pageCount === 1 ? "page" : "pages"}
                    </span>
                    <span>•</span>
                    <span>{formatPdfBytes(compiled.sizeBytes)}</span>
                    <span>•</span>
                    <span>{wordCount} words</span>
                  </>
                ) : (
                  <span className="text-rose-400">{compileError || "Compile error"}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Quick Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!compiled || isCompiling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition hover:scale-102 active:scale-98 disabled:opacity-40 shadow-xs"
              style={{
                backgroundColor: "var(--m-primary)",
                color: "var(--m-primary-text, #ffffff)",
              }}
              title="Download compiled A4 PDF"
            >
              <Download size={13} />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 rounded-xl border transition hover:opacity-80"
              style={{
                borderColor: "var(--m-border)",
                color: "var(--m-text-sub)",
                backgroundColor: "var(--m-surface)",
              }}
              title="Open Fullscreen PDF Sandbox Studio"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Mode Switcher & Style Toolbar */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b text-[11px]"
          style={{
            borderColor: "var(--m-border-light)",
            backgroundColor: "var(--m-surface)",
          }}
        >
          {/* Tabs: A4 Preview | Native PDF | Live Edit */}
          <div
            className="inline-flex items-center rounded-xl p-0.5 border"
            style={{
              borderColor: "var(--m-border-light)",
              backgroundColor: "var(--m-surface-alt)",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
                activeTab === "preview" ? "shadow-xs font-semibold" : "opacity-65 hover:opacity-100"
              }`}
              style={
                activeTab === "preview"
                  ? { backgroundColor: "var(--m-surface)", color: "var(--m-text-heading)" }
                  : { color: "var(--m-text-sub)" }
              }
            >
              <Eye size={12} />
              <span>A4 Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pdf")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
                activeTab === "pdf" ? "shadow-xs font-semibold" : "opacity-65 hover:opacity-100"
              }`}
              style={
                activeTab === "pdf"
                  ? { backgroundColor: "var(--m-surface)", color: "var(--m-text-heading)" }
                  : { color: "var(--m-text-sub)" }
              }
            >
              <FileText size={12} />
              <span>Compiled PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
                activeTab === "edit" ? "shadow-xs font-semibold" : "opacity-65 hover:opacity-100"
              }`}
              style={
                activeTab === "edit"
                  ? { backgroundColor: "var(--m-surface)", color: "var(--m-text-heading)" }
                  : { color: "var(--m-text-sub)" }
              }
            >
              <Edit3 size={12} />
              <span>Edit</span>
            </button>
          </div>

          {/* Theme Style Selector + Secondary Actions */}
          <div className="flex items-center gap-1.5">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as PdfStyleTheme)}
              className="rounded-lg px-2 py-1 text-[11px] font-medium outline-none border cursor-pointer"
              style={{
                backgroundColor: "var(--m-surface-alt)",
                borderColor: "var(--m-border-light)",
                color: "var(--m-text)",
              }}
              title="PDF Document Style"
            >
              <option value="academic">Academic Serif</option>
              <option value="executive">Executive Banner</option>
              <option value="minimal">Minimal Sans</option>
            </select>

            <button
              type="button"
              onClick={handlePrintKatex}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border transition hover:opacity-80"
              style={{
                borderColor: "var(--m-border-light)",
                color: "var(--m-text-sub)",
              }}
              title="Print / Save High-Res Math PDF"
            >
              <Printer size={12} />
              <span className="hidden sm:inline">Print</span>
            </button>

            {onSaveToNotes && (
              <button
                type="button"
                onClick={handleSaveToNotes}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border transition hover:opacity-80"
                style={{
                  borderColor: "var(--m-border-light)",
                  color: savedNote ? "#10b981" : "var(--m-text-sub)",
                }}
                title="Save to Study Notes"
              >
                {savedNote ? <Check size={12} /> : <BookOpen size={12} />}
                <span className="hidden sm:inline">{savedNote ? "Saved" : "Notes"}</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── Sandbox Viewport ─── */}
        <div
          className="relative w-full overflow-y-auto custom-scrollbar"
          style={{
            maxHeight: "480px",
            backgroundColor: "rgba(15, 23, 42, 0.35)",
          }}
        >
          {activeTab === "preview" && (
            <div className="p-3 sm:p-5">{renderPaperSheet(paperRef)}</div>
          )}

          {activeTab === "pdf" && (
            <div className="w-full h-[460px] flex flex-col items-center justify-center bg-[#1e222a]">
              {compiled?.blobUrl ? (
                <iframe
                  src={`${compiled.blobUrl}#toolbar=1&navpanes=0&view=FitH`}
                  title={title}
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-xs text-white/60 p-6">
                  <Loader2 size={20} className="animate-spin text-indigo-400" />
                  <span>Compiling live A4 PDF binary...</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "edit" && (
            <div className="p-3.5 sm:p-4 space-y-3" style={{ backgroundColor: "var(--m-surface)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                    Document Title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl px-3 py-1.5 text-xs outline-none border"
                    style={{
                      backgroundColor: "var(--m-input-bg)",
                      borderColor: "var(--m-border)",
                      color: "var(--m-text)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                    Subject / Subtitle
                  </label>
                  <input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Optional subtitle or syllabus tag"
                    className="w-full rounded-xl px-3 py-1.5 text-xs outline-none border"
                    style={{
                      backgroundColor: "var(--m-input-bg)",
                      borderColor: "var(--m-border)",
                      color: "var(--m-text)",
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                    Markdown Source (Auto-recompiles PDF live)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className="flex items-center gap-1 text-[10.5px] opacity-75 hover:opacity-100"
                  >
                    {copiedMd ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    {copiedMd ? "Copied" : "Copy Source"}
                  </button>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  className="w-full rounded-xl p-3 text-xs font-mono leading-relaxed outline-none border resize-y custom-scrollbar"
                  style={{
                    backgroundColor: "var(--m-input-bg)",
                    borderColor: "var(--m-border)",
                    color: "var(--m-text)",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Fullscreen PDF Sandbox Studio Modal (Split Editor + Live Preview) ─── */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[9998] flex flex-col backdrop-blur-md"
          style={{ backgroundColor: "var(--m-bg)" }}
        >
          {/* Fullscreen Top Bar */}
          <div
            className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b shrink-0"
            style={{
              backgroundColor: "var(--m-surface)",
              borderColor: "var(--m-border)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-xl bg-rose-500/15 text-rose-500 border border-rose-500/25 flex items-center justify-center shrink-0">
                <Sparkles size={17} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate" style={{ color: "var(--m-text-heading)" }}>
                  {title}
                </h3>
                <p className="text-[11px] font-mono" style={{ color: "var(--m-text-sub)" }}>
                  PDF Sandbox Studio {compiled ? `• ${compiled.pageCount} pages • ${formatPdfBytes(compiled.sizeBytes)}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as PdfStyleTheme)}
                className="rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none border cursor-pointer"
                style={{
                  backgroundColor: "var(--m-surface-alt)",
                  borderColor: "var(--m-border)",
                  color: "var(--m-text)",
                }}
              >
                <option value="academic">Academic Serif</option>
                <option value="executive">Executive Banner</option>
                <option value="minimal">Minimal Sans</option>
              </select>

              <button
                type="button"
                onClick={runCompile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition hover:opacity-80"
                style={{
                  borderColor: "var(--m-border)",
                  color: "var(--m-text)",
                }}
                title="Recompile PDF"
              >
                <RefreshCw size={13} className={isCompiling ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Rebuild</span>
              </button>

              <button
                type="button"
                onClick={handlePrintKatex}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition hover:opacity-80"
                style={{
                  borderColor: "var(--m-border)",
                  color: "var(--m-text)",
                }}
              >
                <Printer size={13} />
                <span className="hidden sm:inline">Print / KaTeX</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={!compiled || isCompiling}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition hover:scale-102 active:scale-98 disabled:opacity-40 shadow-sm"
                style={{
                  backgroundColor: "var(--m-primary)",
                  color: "var(--m-primary-text, #ffffff)",
                }}
              >
                <Download size={14} />
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded-xl border transition hover:opacity-80"
                style={{
                  borderColor: "var(--m-border)",
                  color: "var(--m-text-sub)",
                }}
                title="Exit Fullscreen (Esc)"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Fullscreen Split Workspace: Editor (Left) + Live Document/PDF Preview (Right) */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
            {/* Left Pane: Live Sandbox Editor */}
            <div
              className="flex flex-col border-r overflow-hidden"
              style={{
                borderColor: "var(--m-border)",
                backgroundColor: "var(--m-surface)",
              }}
            >
              <div
                className="px-4 py-2.5 border-b flex items-center justify-between text-xs font-semibold"
                style={{
                  borderColor: "var(--m-border-light)",
                  color: "var(--m-text-sub)",
                }}
              >
                <span className="flex items-center gap-1.5">
                  <Edit3 size={13} /> Live Document Editor
                </span>
                <span className="text-[10.5px] font-mono opacity-75">Auto-compiles PDF</span>
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Document Title"
                    className="rounded-xl px-3 py-2 text-xs font-semibold outline-none border"
                    style={{
                      backgroundColor: "var(--m-input-bg)",
                      borderColor: "var(--m-border)",
                      color: "var(--m-text)",
                    }}
                  />
                  <input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Subtitle or syllabus tag"
                    className="rounded-xl px-3 py-2 text-xs outline-none border"
                    style={{
                      backgroundColor: "var(--m-input-bg)",
                      borderColor: "var(--m-border)",
                      color: "var(--m-text)",
                    }}
                  />
                </div>

                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="flex-1 w-full rounded-xl p-4 text-xs sm:text-[13px] font-mono leading-relaxed outline-none border resize-none custom-scrollbar"
                  style={{
                    backgroundColor: "var(--m-input-bg)",
                    borderColor: "var(--m-border)",
                    color: "var(--m-text)",
                  }}
                />
              </div>
            </div>

            {/* Right Pane: Live A4 Preview / Native Compiled PDF */}
            <div className="flex flex-col overflow-hidden bg-[#14171f]">
              <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between text-xs text-white/70">
                <div className="inline-flex items-center rounded-lg bg-white/5 p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                      activeTab !== "pdf" ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
                    }`}
                  >
                    A4 Paper View
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("pdf")}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                      activeTab === "pdf" ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
                    }`}
                  >
                    Native Binary PDF
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white"
                >
                  <Minimize2 size={12} /> Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === "pdf" ? (
                  compiled?.blobUrl ? (
                    <iframe
                      src={`${compiled.blobUrl}#toolbar=1&navpanes=0&view=FitH`}
                      title={title}
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-white/60 gap-2">
                      <Loader2 size={16} className="animate-spin" /> Compiling binary PDF...
                    </div>
                  )
                ) : (
                  <div className="p-6 sm:p-8">{renderPaperSheet(modalPaperRef)}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIPdfSandboxCard;

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Sparkles,
  Brain,
  BookOpen,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  Folder,
  Layers,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Flame,
  FileUp,
  File
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Subject, NoteEntry, AttachedFile } from '../../lib/supabase';
import { extractTextFromFile } from './pdfExtractor';
import { generateFlashcardsAndSummary, GeneratedCard, ChapterSummary, FlashcardGenerationResult } from './flashcardAIGenerator';

interface PDFFlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  userNotes: NoteEntry[];
  attachedFiles: AttachedFile[];
  initialFile?: AttachedFile | null;
  initialNote?: NoteEntry | null;
  initialSubjectId?: number | null;
  onAddFlashcards: (
    newCards: Array<{
      subjectId: number;
      front: string;
      back: string;
      difficulty: 'easy' | 'medium' | 'hard';
    }>
  ) => void;
  onSaveNote?: (title: string, content: string, subjectId: number) => void;
  onAddXP?: (amount: number) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type SourceType = 'upload' | 'workspace_file' | 'note' | 'paste';

export function PDFFlashcardModal({
  isOpen,
  onClose,
  subjects,
  userNotes,
  attachedFiles,
  initialFile,
  initialNote,
  initialSubjectId,
  onAddFlashcards,
  onSaveNote,
  onAddXP,
  showToast,
}: PDFFlashcardModalProps) {
  const [sourceType, setSourceType] = useState<SourceType>(
    initialFile ? 'workspace_file' : initialNote ? 'note' : 'upload'
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(
    initialSubjectId || (subjects.length > 0 ? subjects[0].id : 0)
  );

  // Source selection states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string>(initialFile?.id || '');
  const [selectedNoteId, setSelectedNoteId] = useState<string>(initialNote?.id || '');
  const [pastedText, setPastedText] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Results state
  const [generatedResult, setGeneratedResult] = useState<FlashcardGenerationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'cards' | 'summary'>('cards');
  const [previewCardIndex, setPreviewCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [hasSavedCards, setHasSavedCards] = useState<boolean>(false);
  const [hasSavedNote, setHasSavedNote] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial selections on open
  useEffect(() => {
    if (initialFile) {
      setSourceType('workspace_file');
      setSelectedFileId(initialFile.id);
      setSelectedSubjectId(initialFile.subjectId || (subjects[0]?.id ?? 0));
    } else if (initialNote) {
      setSourceType('note');
      setSelectedNoteId(initialNote.id);
      setSelectedSubjectId(initialNote.subjectId || (subjects[0]?.id ?? 0));
    }
  }, [initialFile, initialNote, subjects]);

  if (!isOpen) return null;

  // ─── Extract & Generate Handler ───
  const handleStartGeneration = async () => {
    setIsProcessing(true);
    setStatusMessage('Reading document content...');

    try {
      let contentText = '';
      let docTitle = customTitle.trim();

      const selectedSubName = subjects.find((s) => s.id === selectedSubjectId)?.name || 'General';

      if (sourceType === 'upload') {
        if (!uploadedFile) {
          showToast('Please select or drop a PDF / document first.', 'error');
          setIsProcessing(false);
          return;
        }
        setStatusMessage(`Extracting text from ${uploadedFile.name}...`);
        const extracted = await extractTextFromFile(uploadedFile);
        contentText = extracted.text;
        if (!docTitle) docTitle = extracted.title;
      } else if (sourceType === 'workspace_file') {
        const fileObj = attachedFiles.find((f) => f.id === selectedFileId);
        if (!fileObj) {
          showToast('Please choose a file from your course workspace.', 'error');
          setIsProcessing(false);
          return;
        }
        docTitle = docTitle || fileObj.fileName;
        setStatusMessage(`Retrieving workspace file: ${fileObj.fileName}...`);
        
        // If storage URL or file data available
        if (fileObj.storagePath) {
          try {
            const res = await fetch(fileObj.storagePath);
            if (res.ok) {
              const blob = await res.blob();
              const fileInstance = new window.File([blob], fileObj.fileName, { type: fileObj.mimeType });
              const extracted = await extractTextFromFile(fileInstance);
              contentText = extracted.text;
            }
          } catch {
            contentText = `Document: ${fileObj.fileName}. Subject: ${selectedSubName}.`;
          }
        }
        if (!contentText) {
          contentText = `Course material for ${fileObj.fileName} in subject ${selectedSubName}.`;
        }
      } else if (sourceType === 'note') {
        const noteObj = userNotes.find((n) => n.id === selectedNoteId);
        if (!noteObj) {
          showToast('Please select a study note from your journal.', 'error');
          setIsProcessing(false);
          return;
        }
        docTitle = docTitle || noteObj.title;
        contentText = `# ${noteObj.title}\n\n${noteObj.content}`;
      } else {
        // Pasted text
        if (!pastedText.trim()) {
          showToast('Please enter or paste your chapter text.', 'error');
          setIsProcessing(false);
          return;
        }
        contentText = pastedText.trim();
        docTitle = docTitle || 'Pasted Lecture Notes';
      }

      setStatusMessage('Synthesizing 15–20 Active-Recall Concept Pairs with Spaced Repetition ratings...');

      const aiResponse = await generateFlashcardsAndSummary(contentText, docTitle, selectedSubName);

      if (aiResponse.error || !aiResponse.result) {
        showToast(aiResponse.error || 'Failed to generate flashcards.', 'error');
        setIsProcessing(false);
        return;
      }

      setGeneratedResult(aiResponse.result);
      setPreviewCardIndex(0);
      setIsFlipped(false);
      setHasSavedCards(false);
      setHasSavedNote(false);
      showToast(`Generated ${aiResponse.result.flashcards.length} active-recall cards & summary! ⚡`);
    } catch (err: any) {
      console.error('Extraction/Generation failed:', err);
      showToast(err?.message || 'Failed processing document. Please retry.', 'error');
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  // ─── Save Cards to Deck ───
  const handleCommitCards = () => {
    if (!generatedResult || generatedResult.flashcards.length === 0) return;

    const cardsToAdd = generatedResult.flashcards.map((c) => ({
      subjectId: selectedSubjectId,
      front: c.front,
      back: c.back,
      difficulty: c.difficulty,
    }));

    onAddFlashcards(cardsToAdd);
    setHasSavedCards(true);

    if (onAddXP) onAddXP(30);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
    });

    showToast(`Added ${cardsToAdd.length} cards to your Spaced Repetition deck! (+30 XP) 🏆`);
  };

  // ─── Save Summary to Notes ───
  const handleCommitSummary = () => {
    if (!generatedResult || !onSaveNote) return;

    const sum = generatedResult.summary;
    let markdown = `# ${sum.title}\n\n`;
    markdown += `> **Executive Overview**: ${sum.overview}\n\n`;
    markdown += `## Core Foundational Principles\n`;
    sum.coreKeyTakeaways.forEach((point) => {
      markdown += `- ${point}\n`;
    });

    if (sum.keyFormulasAndDefinitions && sum.keyFormulasAndDefinitions.length > 0) {
      markdown += `\n## Key Formulas & Critical Definitions\n`;
      markdown += `| Principle / Formula | Description | Unit / Context |\n`;
      markdown += `| :--- | :--- | :--- |\n`;
      sum.keyFormulasAndDefinitions.forEach((item) => {
        markdown += `| **${item.termOrFormula}** | ${item.description} | \`${item.siUnitOrContext || 'N/A'}\` |\n`;
      });
    }

    if (sum.examPitfalls && sum.examPitfalls.length > 0) {
      markdown += `\n## ⚠️ High-Yield Exam Traps to Avoid\n`;
      sum.examPitfalls.forEach((pitfall) => {
        markdown += `- **Watchout**: ${pitfall}\n`;
      });
    }

    onSaveNote(sum.title, markdown, selectedSubjectId);
    setHasSavedNote(true);
    showToast(`Executive summary saved as new note in Notes Journal! 📝`);
  };

  // Edit card front/back
  const handleEditCard = (cardId: string, field: 'front' | 'back', val: string) => {
    if (!generatedResult) return;
    setGeneratedResult({
      ...generatedResult,
      flashcards: generatedResult.flashcards.map((c) =>
        c.id === cardId ? { ...c, [field]: val } : c
      ),
    });
  };

  // Delete card
  const handleDeleteCard = (cardId: string) => {
    if (!generatedResult) return;
    const remaining = generatedResult.flashcards.filter((c) => c.id !== cardId);
    setGeneratedResult({
      ...generatedResult,
      flashcards: remaining,
      totalCards: remaining.length,
    });
    if (previewCardIndex >= remaining.length) {
      setPreviewCardIndex(Math.max(0, remaining.length - 1));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden minimal-surface"
        style={{ backgroundColor: 'var(--m-surface-solid)', borderColor: 'var(--m-border)' }}
      >
        {/* ─── Header ─── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--m-border-light)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="grid size-10 place-items-center rounded-2xl shadow-sm text-white"
              style={{ backgroundColor: 'var(--m-primary)' }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-[Roboto_Slab] text-lg font-bold" style={{ color: 'var(--m-text-heading)' }}>
                  1-Click PDF to Flashcards & Summary
                </h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: 'var(--m-primary)' }}
                >
                  AI Studio
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--m-text-sub)' }}>
                Extract 15–20 active-recall concept pairs & spaced repetition cards in seconds
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl opacity-70 hover:opacity-100 hover:bg-white/10 transition"
            style={{ color: 'var(--m-text)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Body Area ─── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {!generatedResult ? (
            /* STEP 1: INGESTION FORM */
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              {/* Source Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 rounded-2xl border" style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)' }}>
                {[
                  { id: 'upload', label: 'Upload File', icon: UploadCloud },
                  { id: 'workspace_file', label: 'Course Files', icon: Folder },
                  { id: 'note', label: 'Study Note', icon: BookOpen },
                  { id: 'paste', label: 'Paste Text', icon: FileText },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setSourceType(id as SourceType)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      sourceType === id ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={
                      sourceType === id
                        ? { backgroundColor: 'var(--m-primary)', color: 'var(--m-primary-text)' }
                        : { color: 'var(--m-text)' }
                    }
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Target Subject Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--m-text-muted)' }}>
                  Assign to Subject / Course
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                  className="w-full rounded-2xl px-4 py-3 text-xs font-medium border"
                  style={{ backgroundColor: 'var(--m-surface-alt)', color: 'var(--m-text)', borderColor: 'var(--m-border)' }}
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                  {subjects.length === 0 && <option value={0}>General Studies</option>}
                </select>
              </div>

              {/* Source Content Input Panels */}
              {sourceType === 'upload' && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition hover:border-[var(--m-primary)] hover:bg-white/5"
                  style={{ borderColor: 'var(--m-border)' }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadedFile(e.target.files[0]);
                        if (!customTitle) {
                          setCustomTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                  />
                  <div
                    className="size-14 rounded-2xl grid place-items-center mx-auto mb-3 text-white"
                    style={{ backgroundColor: 'var(--m-primary)' }}
                  >
                    <FileUp size={28} />
                  </div>
                  {uploadedFile ? (
                    <div>
                      <p className="font-bold text-sm" style={{ color: 'var(--m-text-heading)' }}>
                        {uploadedFile.name}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--m-text-sub)' }}>
                        {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to synthesize
                      </p>
                      <span className="inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                        ✓ File Selected
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold text-sm" style={{ color: 'var(--m-text-heading)' }}>
                        Drop your Chapter PDF or Textbook handout here
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--m-text-sub)' }}>
                        Supports PDF, TXT, Markdown documents (Up to 30 pages)
                      </p>
                      <button
                        type="button"
                        className="mt-4 px-4 py-2 rounded-xl text-xs font-bold border"
                        style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)', color: 'var(--m-text)' }}
                      >
                        Browse Computer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {sourceType === 'workspace_file' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--m-text-muted)' }}>
                    Select from Uploaded Subject Files
                  </label>
                  {attachedFiles.length > 0 ? (
                    <select
                      value={selectedFileId}
                      onChange={(e) => setSelectedFileId(e.target.value)}
                      className="w-full rounded-2xl px-4 py-3 text-xs border"
                      style={{ backgroundColor: 'var(--m-surface-alt)', color: 'var(--m-text)', borderColor: 'var(--m-border)' }}
                    >
                      <option value="">Select a course file...</option>
                      {attachedFiles.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.fileName} ({subjects.find((s) => s.id === f.subjectId)?.name || 'General'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-5 rounded-2xl border text-center" style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)' }}>
                      <p className="text-xs" style={{ color: 'var(--m-text-sub)' }}>
                        No files uploaded in your subject workspace yet. Switch to &apos;Upload File&apos; above!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {sourceType === 'note' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--m-text-muted)' }}>
                    Select from Your Notes Journal
                  </label>
                  {userNotes.length > 0 ? (
                    <select
                      value={selectedNoteId}
                      onChange={(e) => setSelectedNoteId(e.target.value)}
                      className="w-full rounded-2xl px-4 py-3 text-xs border"
                      style={{ backgroundColor: 'var(--m-surface-alt)', color: 'var(--m-text)', borderColor: 'var(--m-border)' }}
                    >
                      <option value="">Select a study note...</option>
                      {userNotes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title} ({subjects.find((s) => s.id === n.subjectId)?.name || 'Note'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-5 rounded-2xl border text-center" style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)' }}>
                      <p className="text-xs" style={{ color: 'var(--m-text-sub)' }}>
                        No notes found in your journal yet.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {sourceType === 'paste' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--m-text-muted)' }}>
                    Paste Chapter Text or Lecture Notes
                  </label>
                  <textarea
                    rows={6}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste textbook excerpts, definitions, formulas, or teacher notes here..."
                    className="w-full rounded-2xl p-4 text-xs font-mono border outline-none"
                    style={{ backgroundColor: 'var(--m-surface-alt)', color: 'var(--m-text)', borderColor: 'var(--m-border)' }}
                  />
                </div>
              )}

              {/* Optional Custom Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--m-text-muted)' }}>
                  Chapter or Deck Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ray Optics & Optical Instruments, Gauss's Theorem"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full rounded-2xl px-4 py-2.5 text-xs border"
                  style={{ backgroundColor: 'var(--m-surface-alt)', color: 'var(--m-text)', borderColor: 'var(--m-border)' }}
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleStartGeneration}
                disabled={isProcessing}
                className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                style={{ backgroundColor: 'var(--m-primary)', color: 'var(--m-primary-text)' }}
              >
                {isProcessing ? (
                  <>
                    <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>{statusMessage || 'Extracting Concepts & Synthesizing Deck...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Generate 15–20 Active-Recall Flashcards & Summary</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* STEP 2: PREVIEW & 1-CLICK COMMIT */
            <div className="space-y-6">
              {/* Deck Summary Ribbon */}
              <div
                className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border"
                style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)' }}
              >
                <div>
                  <h3 className="font-[Roboto_Slab] text-base font-bold" style={{ color: 'var(--m-text-heading)' }}>
                    {generatedResult.title}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--m-text-sub)' }}>
                    {generatedResult.flashcards.length} active-recall cards ready • Target:{' '}
                    <strong style={{ color: 'var(--m-primary)' }}>
                      {subjects.find((s) => s.id === selectedSubjectId)?.name || 'Course'}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('cards')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      activeTab === 'cards' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={
                      activeTab === 'cards'
                        ? { backgroundColor: 'var(--m-primary)', color: 'var(--m-primary-text)' }
                        : { color: 'var(--m-text)' }
                    }
                  >
                    Flashcards ({generatedResult.flashcards.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      activeTab === 'summary' ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={
                      activeTab === 'summary'
                        ? { backgroundColor: 'var(--m-primary)', color: 'var(--m-primary-text)' }
                        : { color: 'var(--m-text)' }
                    }
                  >
                    Executive Summary
                  </button>
                </div>
              </div>

              {/* TAB 1: FLASHCARDS PREVIEW */}
              {activeTab === 'cards' && (
                <div className="space-y-6">
                  {/* Interactive Flip Card Preview */}
                  {generatedResult.flashcards.length > 0 && (
                    <div className="max-w-xl mx-auto">
                      <div className="flex items-center justify-between text-xs mb-2 px-2" style={{ color: 'var(--m-text-sub)' }}>
                        <span>
                          Preview Card {previewCardIndex + 1} of {generatedResult.flashcards.length}
                        </span>
                        <span className="uppercase font-mono text-[10px] font-bold">
                          {generatedResult.flashcards[previewCardIndex]?.conceptCategory || 'Concept'}
                        </span>
                      </div>

                      <div
                        onClick={() => setIsFlipped(!isFlipped)}
                        className="w-full min-h-[200px] sm:min-h-[220px] rounded-3xl p-6 text-center cursor-pointer border shadow-lg transition-all duration-300 hover:shadow-xl flex flex-col justify-center items-center"
                        style={{
                          backgroundColor: isFlipped ? 'var(--m-primary)' : 'var(--m-surface)',
                          borderColor: isFlipped ? 'var(--m-primary)' : 'var(--m-border)',
                          color: isFlipped ? 'var(--m-primary-text)' : 'var(--m-text)',
                        }}
                      >
                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-60 mb-2">
                          {isFlipped ? 'Answer / Concept' : 'Question / Active Recall Prompt'}
                        </span>
                        <p className="font-[Roboto_Slab] text-base sm:text-lg font-semibold leading-relaxed">
                          {isFlipped
                            ? generatedResult.flashcards[previewCardIndex]?.back
                            : generatedResult.flashcards[previewCardIndex]?.front}
                        </p>
                        <p className="text-[11px] mt-4 opacity-50">
                          {isFlipped ? 'Click to flip back' : 'Click card to reveal answer'}
                        </p>
                      </div>

                      {/* Flip Navigation */}
                      <div className="flex items-center justify-between mt-3 px-2">
                        <button
                          onClick={() => {
                            setPreviewCardIndex((prev) => Math.max(0, prev - 1));
                            setIsFlipped(false);
                          }}
                          disabled={previewCardIndex === 0}
                          className="flex items-center gap-1 text-xs font-bold disabled:opacity-30"
                          style={{ color: 'var(--m-primary)' }}
                        >
                          <ChevronLeft size={16} /> Prev
                        </button>
                        <span className="text-xs" style={{ color: 'var(--m-text-sub)' }}>
                          {previewCardIndex + 1} / {generatedResult.flashcards.length}
                        </span>
                        <button
                          onClick={() => {
                            setPreviewCardIndex((prev) =>
                              Math.min(generatedResult.flashcards.length - 1, prev + 1)
                            );
                            setIsFlipped(false);
                          }}
                          disabled={previewCardIndex === generatedResult.flashcards.length - 1}
                          className="flex items-center gap-1 text-xs font-bold disabled:opacity-30"
                          style={{ color: 'var(--m-primary)' }}
                        >
                          Next <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Card List / Editor Grid */}
                  <div>
                    <h4 className="font-[Roboto_Slab] text-sm font-bold mb-3" style={{ color: 'var(--m-text-heading)' }}>
                      All Extracted Cards ({generatedResult.flashcards.length}) — Click text to tweak
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {generatedResult.flashcards.map((card, idx) => (
                        <div
                          key={card.id}
                          className="p-4 rounded-2xl border space-y-2 relative group"
                          style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)' }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--m-primary)' }}>
                              #{idx + 1} • {card.conceptCategory || 'Concept'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                  card.difficulty === 'hard'
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : card.difficulty === 'medium'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/20 text-emerald-400'
                                }`}
                              >
                                {card.difficulty}
                              </span>
                              <button
                                onClick={() => handleDeleteCard(card.id)}
                                className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
                                title="Delete card"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Front</p>
                            <textarea
                              rows={2}
                              value={card.front}
                              onChange={(e) => handleEditCard(card.id, 'front', e.target.value)}
                              className="w-full text-xs font-semibold bg-transparent border-b border-transparent focus:border-[var(--m-primary)] outline-none resize-none"
                              style={{ color: 'var(--m-text-heading)' }}
                            />
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Back</p>
                            <textarea
                              rows={2}
                              value={card.back}
                              onChange={(e) => handleEditCard(card.id, 'back', e.target.value)}
                              className="w-full text-xs bg-transparent border-b border-transparent focus:border-[var(--m-primary)] outline-none resize-none"
                              style={{ color: 'var(--m-text-sub)' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EXECUTIVE SUMMARY PREVIEW */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  {/* Overview Card */}
                  <div
                    className="p-5 rounded-2xl border"
                    style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)' }}
                  >
                    <h4 className="font-bold text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--m-primary)' }}>
                      Executive Chapter Overview
                    </h4>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--m-text)' }}>
                      {generatedResult.summary.overview}
                    </p>
                  </div>

                  {/* Core Principles */}
                  {generatedResult.summary.coreKeyTakeaways.length > 0 && (
                    <div
                      className="p-5 rounded-2xl border space-y-3"
                      style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)' }}
                    >
                      <h4 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--m-text-heading)' }}>
                        Core Foundational Principles
                      </h4>
                      <ul className="space-y-2">
                        {generatedResult.summary.coreKeyTakeaways.map((point, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-xs" style={{ color: 'var(--m-text)' }}>
                            <CheckCircle2 size={15} className="shrink-0 text-emerald-400 mt-0.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Formulas & Definitions */}
                  {generatedResult.summary.keyFormulasAndDefinitions.length > 0 && (
                    <div
                      className="p-5 rounded-2xl border space-y-3"
                      style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)' }}
                    >
                      <h4 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--m-text-heading)' }}>
                        Formulas, Principles & SI Units
                      </h4>
                      <div className="divide-y" style={{ borderColor: 'var(--m-border-light)' }}>
                        {generatedResult.summary.keyFormulasAndDefinitions.map((item, i) => (
                          <div key={i} className="py-2.5 flex items-start justify-between gap-4">
                            <div>
                              <p className="font-bold text-xs" style={{ color: 'var(--m-text-heading)' }}>
                                {item.termOrFormula}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--m-text-sub)' }}>
                                {item.description}
                              </p>
                            </div>
                            {item.siUnitOrContext && (
                              <span className="px-2 py-1 rounded-lg font-mono text-[10px] font-bold bg-white/5 border shrink-0" style={{ borderColor: 'var(--m-border)' }}>
                                {item.siUnitOrContext}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exam Pitfalls */}
                  {generatedResult.summary.examPitfalls.length > 0 && (
                    <div
                      className="p-5 rounded-2xl border space-y-2"
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                    >
                      <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                        <AlertTriangle size={15} />
                        <span>High-Yield Exam Traps & Calculation Pitfalls</span>
                      </div>
                      <ul className="space-y-1.5 pt-1">
                        {generatedResult.summary.examPitfalls.map((pitfall, i) => (
                          <li key={i} className="text-xs text-rose-200/90 leading-relaxed">
                            • {pitfall}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Footer Action Bar ─── */}
        {generatedResult && (
          <div
            className="p-4 border-t flex flex-wrap items-center justify-between gap-3 shrink-0"
            style={{ borderColor: 'var(--m-border-light)', backgroundColor: 'var(--m-surface)' }}
          >
            <button
              onClick={() => setGeneratedResult(null)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold transition hover:bg-white/5 flex items-center gap-1.5"
              style={{ color: 'var(--m-text-sub)' }}
            >
              <RefreshCw size={13} />
              <span>Extract Another</span>
            </button>

            <div className="flex items-center gap-2.5">
              {onSaveNote && (
                <button
                  onClick={handleCommitSummary}
                  disabled={hasSavedNote}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 hover:scale-105 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--m-surface-alt)', borderColor: 'var(--m-border)', color: 'var(--m-text)' }}
                >
                  <BookOpen size={14} />
                  <span>{hasSavedNote ? '✓ Summary Saved' : 'Save Summary to Notes'}</span>
                </button>
              )}

              <button
                onClick={handleCommitCards}
                disabled={hasSavedCards || generatedResult.flashcards.length === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition hover:scale-105 active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                style={{ backgroundColor: 'var(--m-primary)', color: 'var(--m-primary-text)' }}
              >
                <Layers size={14} />
                <span>
                  {hasSavedCards
                    ? '✓ Cards Added to Deck'
                    : `Add ${generatedResult.flashcards.length} Cards to Spaced Repetition (+30 XP)`}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ExamSimulatorApp.tsx
 * AI Exam Simulator & Handwritten Answer Grader for Dream-It.
 * Multi-Agent CBSE Paper Generation, Live Exam Room, Multimodal Vision Grading, and Scorecard.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  BrainCircuit,
  Clock,
  FileCheck2,
  FileText,
  Printer,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  BookOpen,
  Award,
  Layers,
  History,
  Camera,
  Trash2,
  PlusCircle,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import {
  ExamConfig,
  ExamPaper,
  ExamQuestion,
  HandwrittenEvaluationReport,
  CBSEClassLevel,
  ExamDifficulty,
  ExamLengthType,
  StoredExamRecord,
} from "./types";
import { generateCBSEExamPaper } from "./examGenerator";
import { evaluateAnswerSheet } from "./handwrittenGrader";
import { ImageAttachment } from "../../lib/ai-client";

interface ExamSimulatorAppProps {
  userSubjects: { id: number | string; name: string; color?: string }[];
  userNotes: { id: string; subjectId: number | string; title: string; content: string }[];
  onAddGrade?: (assignmentName: string, score: number, total: number, subjectName: string) => void;
  onAddFlashcard?: (front: string, back: string, course: string) => void;
  onAddXP?: (amount: number) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const STORAGE_KEY_EXAMS = "dreamit_cbse_exams_records_v1";

export default function ExamSimulatorApp({
  userSubjects,
  userNotes,
  onAddGrade,
  onAddFlashcard,
  onAddXP,
  showToast,
}: ExamSimulatorAppProps) {
  // Navigation inside the Exam Module
  type ExamView = "generator" | "exam_hall" | "handwritten_grader" | "scorecard" | "history";
  const [currentView, setCurrentView] = useState<ExamView>("generator");

  // Generator Config Form State
  const [classLevel, setClassLevel] = useState<CBSEClassLevel>("Class 10");
  const [selectedSubject, setSelectedSubject] = useState(userSubjects[0]?.name || "Science / Physics");
  const [topicInput, setTopicInput] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("CBSE Board Standard");
  const [lengthType, setLengthType] = useState<ExamLengthType>("diagnostic_20");
  const [isGenerating, setIsGenerating] = useState(false);

  // Active Exam Paper State
  const [activePaper, setActivePaper] = useState<ExamPaper | null>(null);
  const [digitalAnswers, setDigitalAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(1800);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Handwritten Answer Upload State
  const [uploadedPhotos, setUploadedPhotos] = useState<ImageAttachment[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationReport, setEvaluationReport] = useState<HandwrittenEvaluationReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History & Storage
  const [savedExams, setSavedExams] = useState<StoredExamRecord[]>([]);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [isSyncingGrade, setIsSyncingGrade] = useState(false);

  // Load past exams on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EXAMS);
      if (stored) {
        setSavedExams(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed loading saved exam records:", e);
    }
  }, []);

  const saveExamRecord = (record: StoredExamRecord) => {
    setSavedExams((prev) => {
      const updated = [record, ...prev.filter((r) => r.paper.id !== record.paper.id)];
      try {
        localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(updated.slice(0, 30)));
      } catch (e) {
        console.warn("Storage quota:", e);
      }
      return updated;
    });
  };

  // Timer Tick
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && remainingSeconds > 0) {
      interval = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsTimerRunning(false);
            showToast("Time's up! Examination submitted.", "info");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, remainingSeconds, showToast]);

  const formatCountdown = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs}h ${String(mins).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    }
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // ─── Generate Paper Handler ───
  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTopic = topicInput.trim() || (selectedNoteId ? userNotes.find((n) => n.id === selectedNoteId)?.title : "") || "Full Syllabus General Assessment";
    
    let totalMarks = 20;
    let durationMinutes = 30;
    if (lengthType === "mid_term_40") {
      totalMarks = 40;
      durationMinutes = 60;
    } else if (lengthType === "full_board_80") {
      totalMarks = 80;
      durationMinutes = 180;
    }

    const noteContent = selectedNoteId ? userNotes.find((n) => n.id === selectedNoteId)?.content : undefined;

    const config: ExamConfig = {
      classLevel,
      subject: selectedSubject,
      topicOrChapter: finalTopic,
      sourceNoteId: selectedNoteId || undefined,
      sourceNoteContent: noteContent,
      difficulty,
      lengthType,
      totalMarks,
      durationMinutes,
    };

    setIsGenerating(true);
    showToast("Chief CBSE Question Paper Setter & Pedagogy Master are drafting paper...", "info");

    const res = await generateCBSEExamPaper(config);
    setIsGenerating(false);

    if (res.error || !res.paper) {
      showToast(res.error || "Could not generate exam paper.", "error");
      return;
    }

    setActivePaper(res.paper);
    setDigitalAnswers({});
    setUploadedPhotos([]);
    setEvaluationReport(null);
    setRemainingSeconds(res.paper.durationMinutes * 60);
    setIsTimerRunning(true);
    setCurrentView("exam_hall");
    showToast("CBSE Question Paper generated successfully! 📝");
    saveExamRecord({ paper: res.paper });
  };

  // ─── File Upload for Handwritten Sheets ───
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        showToast("Please upload an image (JPG, PNG, WebP) of your handwritten answer sheet.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(",")[1];
        const newAttachment: ImageAttachment = {
          name: file.name,
          mimeType: file.type || "image/jpeg",
          base64Data,
          dataUrl: result,
        };
        setUploadedPhotos((prev) => [...prev, newAttachment]);
        showToast(`Uploaded ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  };

  // ─── Evaluate Submission ───
  const handleEvaluateSubmission = async () => {
    if (!activePaper) return;
    if (uploadedPhotos.length === 0 && Object.keys(digitalAnswers).length === 0) {
      showToast("Please upload at least one photo of your handwritten paper or answer Section A digitally.", "error");
      return;
    }

    setIsEvaluating(true);
    setIsTimerRunning(false);
    showToast("Chief CBSE Board Examiner is evaluating your handwriting & step-marks...", "info");

    const res = await evaluateAnswerSheet(activePaper, uploadedPhotos, digitalAnswers);
    setIsEvaluating(false);

    if (res.error || !res.report) {
      showToast(res.error || "Evaluation failed. Please try again.", "error");
      return;
    }

    setEvaluationReport(res.report);
    setCurrentView("scorecard");
    showToast("Evaluation complete! View your CBSE Scorecard & Step-Marks 🏆");

    if (onAddXP) {
      onAddXP(30);
    }

    // Update stored record
    saveExamRecord({
      paper: activePaper,
      evaluation: res.report,
      userDigitalAnswers: digitalAnswers,
      completedAt: new Date().toISOString(),
    });
  };

  // ─── Sync Grade to Dream-It Gradebook ───
  const handleSyncToGradebook = () => {
    if (!evaluationReport || !activePaper || !onAddGrade) return;
    setIsSyncingGrade(true);
    onAddGrade(
      `${activePaper.subject}: ${activePaper.title.slice(0, 35)}`,
      evaluationReport.obtainedMarks,
      evaluationReport.totalMarks,
      activePaper.subject
    );
    showToast("Synced exam score to Dream-It Gradebook & Parent Portal! 📊");
    setTimeout(() => setIsSyncingGrade(false), 800);
  };

  // ─── Generate Flashcards from Weaknesses ───
  const handleGenerateFlashcardsFromMistakes = () => {
    if (!evaluationReport || !onAddFlashcard) return;
    const lostQuestions = evaluationReport.questionEvaluations.filter((q) => q.awardedMarks < q.maxMarks);
    if (lostQuestions.length === 0) {
      showToast("Congratulations! You scored full marks on all items. No flashcards needed!", "info");
      return;
    }

    lostQuestions.forEach((q) => {
      const front = `Q${q.questionNumber}: ${q.questionText}`;
      const back = `💡 Model Answer:\n${q.idealModelAnswer}\n\n⚠️ Pitfall to Avoid: ${q.lostMarksCritique || "Review key steps."}`;
      onAddFlashcard(front, back, evaluationReport.subject);
    });

    showToast(`Created ${lostQuestions.length} revision flashcards from your mistakes! ✨`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ─── Header & Mode Switcher ─── */}
      <div
        className="rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden"
        style={{
          backgroundColor: "var(--m-surface)",
          border: "1px solid var(--m-border-light)",
        }}
      >
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)", color: "var(--m-primary)" }}>
            <Sparkles size={14} />
            <span>CBSE Board Examination Simulator & Vision Grader</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
            AI Exam Simulator & Handwritten Grader
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: "var(--m-text-sub)" }}>
            Generate official CBSE-pattern question papers, practice under real timer conditions, and let Vision AI evaluate your physical handwritten paper with strict step-marking rubrics.
          </p>
        </div>

        {/* View Buttons */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <button
            onClick={() => setCurrentView("generator")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition feature-chip"
            style={
              currentView === "generator"
                ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }
                : { backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)" }
            }
          >
            <PlusCircle size={15} />
            <span>Create Test</span>
          </button>

          {activePaper && (
            <button
              onClick={() => setCurrentView("exam_hall")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition feature-chip"
              style={
                currentView === "exam_hall"
                  ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }
                  : { backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)" }
              }
            >
              <Clock size={15} />
              <span>Exam Hall</span>
              {isTimerRunning && (
                <span className="size-2 rounded-full bg-red-500 animate-pulse ml-1" />
              )}
            </button>
          )}

          {activePaper && (
            <button
              onClick={() => setCurrentView("handwritten_grader")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition feature-chip"
              style={
                currentView === "handwritten_grader"
                  ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }
                  : { backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)" }
              }
            >
              <UploadCloud size={15} />
              <span>Grade Paper</span>
              {uploadedPhotos.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px]">
                  {uploadedPhotos.length}
                </span>
              )}
            </button>
          )}

          {evaluationReport && (
            <button
              onClick={() => setCurrentView("scorecard")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition feature-chip"
              style={
                currentView === "scorecard"
                  ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }
                  : { backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)" }
              }
            >
              <Award size={15} />
              <span>Scorecard</span>
            </button>
          )}

          <button
            onClick={() => setCurrentView("history")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition feature-chip"
            style={
              currentView === "history"
                ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }
                : { backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)" }
            }
          >
            <History size={15} />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════ VIEW 1: GENERATOR ════════════════════════════ */}
      {currentView === "generator" && (
        <div
          className="rounded-3xl p-6 sm:p-8 space-y-6"
          style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border-light)" }}
        >
          <div className="border-b pb-4" style={{ borderColor: "var(--m-border-light)" }}>
            <h2 className="text-xl font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
              Step 1: Configure CBSE Question Paper
            </h2>
            <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>
              Customized question paper generated by Senior Paper Setters adhering to Blooms Taxonomy and CBSE marking guidelines.
            </p>
          </div>

          <form onSubmit={handleGenerateExam} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Class Level */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
                  Target Class / Standard
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Class 9", "Class 10", "Class 11", "Class 12"] as CBSEClassLevel[]).map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setClassLevel(lvl)}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold transition border"
                      style={
                        classLevel === lvl
                          ? { backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)", borderColor: "var(--m-primary)" }
                          : { backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)", borderColor: "var(--m-border)" }
                      }
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
                  Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs font-medium border"
                  style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)", borderColor: "var(--m-border)" }}
                >
                  {userSubjects.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Biology">Biology</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Social Science">Social Science</option>
                  <option value="English Core">English Core</option>
                </select>
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as ExamDifficulty)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs font-medium border"
                  style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)", borderColor: "var(--m-border)" }}
                >
                  <option value="Foundational">Foundational (Core Concepts & Easy Numericals)</option>
                  <option value="CBSE Board Standard">CBSE Board Standard (Balanced Board Exam Pattern)</option>
                  <option value="High-Scorer Challenger">High-Scorer Challenger (Tricky Derivations & Application)</option>
                </select>
              </div>
            </div>

            {/* Exam Length / Marks */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
                Exam Duration & Weightage
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div
                  onClick={() => setLengthType("diagnostic_20")}
                  className="p-4 rounded-2xl border cursor-pointer transition hover:scale-[1.01]"
                  style={
                    lengthType === "diagnostic_20"
                      ? { backgroundColor: "color-mix(in srgb, var(--m-primary) 10%, transparent)", borderColor: "var(--m-primary)" }
                      : { backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: "var(--m-text-heading)" }}>⚡ Quick Diagnostic</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500">20 Marks</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--m-text-sub)" }}>30 Minutes • 9 Questions • Ideal for daily revision</p>
                </div>

                <div
                  onClick={() => setLengthType("mid_term_40")}
                  className="p-4 rounded-2xl border cursor-pointer transition hover:scale-[1.01]"
                  style={
                    lengthType === "mid_term_40"
                      ? { backgroundColor: "color-mix(in srgb, var(--m-primary) 10%, transparent)", borderColor: "var(--m-primary)" }
                      : { backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: "var(--m-text-heading)" }}>📑 Half Assessment</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-500">40 Marks</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--m-text-sub)" }}>60 Minutes • 18 Questions • Mid-term practice</p>
                </div>

                <div
                  onClick={() => setLengthType("full_board_80")}
                  className="p-4 rounded-2xl border cursor-pointer transition hover:scale-[1.01]"
                  style={
                    lengthType === "full_board_80"
                      ? { backgroundColor: "color-mix(in srgb, var(--m-primary) 10%, transparent)", borderColor: "var(--m-primary)" }
                      : { backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: "var(--m-text-heading)" }}>🏆 Full Board Mock</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500">80 Marks</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--m-text-sub)" }}>180 Minutes • 30+ Questions • Authentic Board Exam</p>
                </div>
              </div>
            </div>

            {/* Chapter / Topic and Source Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
                  Chapter or Specific Topic(s)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Electric Charges and Fields, Gauss Law & Dipole"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs border"
                  style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)", borderColor: "var(--m-border)" }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
                  Or Generate from Your Uploaded Notes
                </label>
                <select
                  value={selectedNoteId}
                  onChange={(e) => setSelectedNoteId(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs border"
                  style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text)", borderColor: "var(--m-border)" }}
                >
                  <option value="">(None - use standard CBSE NCERT syllabus)</option>
                  {userNotes.map((n) => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition hover:scale-[1.01] disabled:opacity-50"
              style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
            >
              {isGenerating ? (
                <>
                  <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing CBSE Paper & Distractor Analysis... (takes ~10s)</span>
                </>
              ) : (
                <>
                  <BrainCircuit size={18} />
                  <span>Generate Complete CBSE Examination Paper</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ════════════════════════════ VIEW 2: EXAM HALL ════════════════════════════ */}
      {currentView === "exam_hall" && activePaper && (
        <div className="space-y-6">
          {/* Top Board Examination Ribbon */}
          <div
            className="rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-4 z-20 shadow-xl backdrop-blur-md"
            style={{ backgroundColor: "color-mix(in srgb, var(--m-surface) 92%, transparent)", border: "1px solid var(--m-border)" }}
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">LIVE EXAMINATION HALL</span>
              <h2 className="text-lg font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
                {activePaper.title}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              {/* Timer Pill */}
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-mono text-base font-bold shadow-inner ${
                  remainingSeconds < 300 ? "animate-pulse text-red-500 bg-red-500/10" : ""
                }`}
                style={{ backgroundColor: "var(--m-surface-alt)", color: remainingSeconds < 300 ? "#ef4444" : "var(--m-primary)" }}
              >
                <Clock size={16} />
                <span>{formatCountdown(remainingSeconds)}</span>
              </div>

              {/* Timer Toggle */}
              <button
                type="button"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="px-3 py-2 rounded-xl text-xs font-bold border transition"
                style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)", color: "var(--m-text)" }}
              >
                {isTimerRunning ? "Pause" : "Resume"}
              </button>

              {/* Print Paper */}
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition"
                style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)", color: "var(--m-text)" }}
                title="Print official question paper to solve on physical answer sheet"
              >
                <Printer size={15} />
                <span className="hidden sm:inline">Print Paper</span>
              </button>

              {/* Ready to Grade */}
              <button
                type="button"
                onClick={() => setCurrentView("handwritten_grader")}
                className="px-4 py-2 rounded-xl text-xs font-bold shadow transition hover:scale-105"
                style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
              >
                Upload Answers
              </button>
            </div>
          </div>

          {/* Paper Content Card */}
          <div
            className="rounded-3xl p-6 sm:p-10 space-y-8 print:p-0 print:border-none print:shadow-none"
            style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border-light)" }}
          >
            {/* Header in CBSE Official Style */}
            <div className="text-center space-y-2 border-b pb-6" style={{ borderColor: "var(--m-border-light)" }}>
              <p className="text-xs uppercase tracking-widest font-bold" style={{ color: "var(--m-text-muted)" }}>
                CENTRAL BOARD OF SECONDARY EDUCATION EXAMINATION
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
                {activePaper.subject} — {activePaper.classLevel}
              </h1>
              <div className="flex justify-center gap-6 text-xs font-medium" style={{ color: "var(--m-text-sub)" }}>
                <span>Maximum Marks: <b>{activePaper.totalMarks}</b></span>
                <span>Time Allowed: <b>{activePaper.durationMinutes} Minutes</b></span>
                <span>Difficulty: <b>{activePaper.difficulty}</b></span>
              </div>
            </div>

            {/* General Instructions */}
            <div className="p-4 rounded-2xl text-xs space-y-1" style={{ backgroundColor: "var(--m-surface-alt)", border: "1px solid var(--m-border-light)" }}>
              <p className="font-bold text-sm mb-1" style={{ color: "var(--m-text-heading)" }}>General Instructions:</p>
              {activePaper.generalInstructions.map((inst, i) => (
                <p key={i} style={{ color: "var(--m-text-sub)" }}>• {inst}</p>
              ))}
            </div>

            {/* Sections */}
            {activePaper.sections.map((sec, secIdx) => (
              <div key={secIdx} className="space-y-6 pt-4 border-t" style={{ borderColor: "var(--m-border-light)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
                      {sec.section}: {sec.title}
                    </h3>
                    <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>{sec.instructions}</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-black/5 dark:bg-white/10" style={{ color: "var(--m-text-muted)" }}>
                    {sec.questions.reduce((acc, q) => acc + q.marks, 0)} Marks Total
                  </span>
                </div>

                <div className="space-y-6">
                  {sec.questions.map((q) => (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl border space-y-3 transition"
                      style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border-light)" }}
                    >
                      {/* Question Topline */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="size-6 rounded-lg grid place-items-center text-xs font-bold" style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}>
                            {q.number}
                          </span>
                          <span className="text-xs font-bold uppercase" style={{ color: "var(--m-text-muted)" }}>
                            [{q.type.replace("-", " ").toUpperCase()}]
                          </span>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10" style={{ color: "var(--m-text-sub)" }}>
                          [{q.marks} {q.marks === 1 ? "Mark" : "Marks"}]
                        </span>
                      </div>

                      {/* Question Text */}
                      <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--m-text-heading)" }}>
                        {q.questionText}
                      </p>

                      {/* Case Study Context if present */}
                      {q.caseStudyScenario && (
                        <div className="p-4 rounded-xl text-xs italic my-2" style={{ backgroundColor: "var(--m-surface)", borderLeft: "3px solid var(--m-primary)", color: "var(--m-text)" }}>
                          <b>Read the case study:</b> {q.caseStudyScenario}
                        </div>
                      )}

                      {/* Section A MCQ Options with Interactive Radio Selector */}
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                          {q.options.map((opt) => {
                            const isSelected = digitalAnswers[q.id] === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => setDigitalAnswers((prev) => ({ ...prev, [q.id]: opt.key }))}
                                className="flex items-center gap-3 p-3 rounded-xl text-xs font-medium text-left border transition"
                                style={
                                  isSelected
                                    ? { backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)", borderColor: "var(--m-primary)", color: "var(--m-text-heading)" }
                                    : { backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)", color: "var(--m-text)" }
                                }
                              >
                                <span className={`size-6 rounded-full grid place-items-center text-xs font-bold shrink-0 border ${
                                  isSelected ? "bg-[var(--m-primary)] text-[var(--m-primary-text)] border-[var(--m-primary)]" : "border-gray-400"
                                }`}>
                                  {opt.key}
                                </span>
                                <span>{opt.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Digital Scratchpad for non-MCQ */}
                      {!q.options && (
                        <div className="pt-2">
                          <textarea
                            placeholder="Type your notes or key steps here, OR solve on physical paper and take a photo..."
                            value={digitalAnswers[q.id] || ""}
                            onChange={(e) => setDigitalAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            rows={2}
                            className="w-full rounded-xl p-3 text-xs border"
                            style={{ backgroundColor: "var(--m-surface)", color: "var(--m-text)", borderColor: "var(--m-border-light)" }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Bottom Actions */}
            <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: "var(--m-border-light)" }}>
              <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>
                Solved on physical paper? Take clear photos and proceed to handwritten vision grading.
              </p>
              <button
                type="button"
                onClick={() => setCurrentView("handwritten_grader")}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition hover:scale-105"
                style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
              >
                <Camera size={16} />
                <span>Upload Handwritten Answer Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════ VIEW 3: HANDWRITTEN GRADER ════════════════════════════ */}
      {currentView === "handwritten_grader" && activePaper && (
        <div
          className="rounded-3xl p-6 sm:p-8 space-y-6"
          style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border-light)" }}
        >
          <div className="border-b pb-4" style={{ borderColor: "var(--m-border-light)" }}>
            <h2 className="text-xl font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
              Step 2: Upload Physical Handwritten Answer Sheets
            </h2>
            <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>
              Take clear photos of your handwritten answers. Our Multimodal Vision AI transcribes your working and grades it against official CBSE step-marking rubrics.
            </p>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            multiple
            accept="image/*"
            className="hidden"
          />

          {/* Drag & Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="rounded-3xl p-8 sm:p-12 border-2 border-dashed text-center cursor-pointer transition hover:border-[var(--m-primary)]"
            style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)" }}
          >
            <div className="size-16 mx-auto rounded-2xl grid place-items-center mb-4 shadow" style={{ backgroundColor: "color-mix(in srgb, var(--m-primary) 15%, transparent)", color: "var(--m-primary)" }}>
              <Camera size={32} />
            </div>
            <h3 className="text-base font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
              Click or Drag Answer Sheet Photos Here
            </h3>
            <p className="text-xs max-w-md mx-auto mt-1" style={{ color: "var(--m-text-sub)" }}>
              Supports Page 1, Page 2, Page 3 (JPG, PNG). Ensure handwriting, question numbers, and calculations are clearly visible.
            </p>
            <button
              type="button"
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-2"
              style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)", color: "var(--m-text)" }}
            >
              <UploadCloud size={14} />
              <span>Select Photos from Device</span>
            </button>
          </div>

          {/* Uploaded Photos Previews */}
          {uploadedPhotos.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
                Uploaded Pages ({uploadedPhotos.length}):
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {uploadedPhotos.map((photo, pIdx) => (
                  <div
                    key={pIdx}
                    className="relative group rounded-2xl overflow-hidden border aspect-[3/4] shadow"
                    style={{ borderColor: "var(--m-border-light)" }}
                  >
                    <img
                      src={photo.dataUrl}
                      alt={photo.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setUploadedPhotos((prev) => prev.filter((_, i) => i !== pIdx))}
                        className="size-8 rounded-full bg-red-600 text-white grid place-items-center hover:scale-110 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold">
                      Page {pIdx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={handleEvaluateSubmission}
            disabled={isEvaluating || (uploadedPhotos.length === 0 && Object.keys(digitalAnswers).length === 0)}
            className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition hover:scale-[1.01] disabled:opacity-50"
            style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
          >
            {isEvaluating ? (
              <>
                <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Evaluating Handwritten Answer Sheet (Transcribing & Step-Marking)...</span>
              </>
            ) : (
              <>
                <FileCheck2 size={18} />
                <span>Evaluate Answer Sheet with CBSE Step-Marking Vision AI</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ════════════════════════════ VIEW 4: SCORECARD ════════════════════════════ */}
      {currentView === "scorecard" && evaluationReport && (
        <div className="space-y-6">
          {/* Grand Score Banner */}
          <div
            className="rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl"
            style={{
              background: "linear-gradient(135deg, color-mix(in srgb, var(--m-primary) 15%, transparent), var(--m-surface))",
              border: "1px solid var(--m-border)",
            }}
          >
            <div className="space-y-2 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                OFFICIAL CBSE CORRECTION REPORT
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
                {evaluationReport.examTitle}
              </h2>
              <p className="text-xs max-w-xl" style={{ color: "var(--m-text-sub)" }}>
                {evaluationReport.overallSummary}
              </p>
            </div>

            {/* Score Pill / Badge */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl sm:text-5xl font-bold font-mono" style={{ color: "var(--m-primary)" }}>
                  {evaluationReport.obtainedMarks}
                  <span className="text-xl font-normal" style={{ color: "var(--m-text-muted)" }}>
                    /{evaluationReport.totalMarks}
                  </span>
                </div>
                <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: "var(--m-text-muted)" }}>
                  {evaluationReport.percentage}% SCORE
                </div>
              </div>

              <div className="size-16 rounded-2xl bg-emerald-500 text-white grid place-items-center shadow-lg font-bold text-2xl font-mono">
                {evaluationReport.cbseGradeBand}
              </div>
            </div>
          </div>

          {/* Action Row: Sync to Gradebook & Flashcards */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl" style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border-light)" }}>
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--m-text-sub)" }}>
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>Step-marking verification completed according to CBSE rubrics.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSyncToGradebook}
                disabled={isSyncingGrade}
                className="px-4 py-2 rounded-xl text-xs font-bold border transition hover:scale-105 flex items-center gap-1.5"
                style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border)", color: "var(--m-primary)" }}
              >
                <TrendingUp size={14} />
                <span>{isSyncingGrade ? "Syncing..." : "Add to Gradebook & Parent View"}</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateFlashcardsFromMistakes}
                className="px-4 py-2 rounded-xl text-xs font-bold transition hover:scale-105 flex items-center gap-1.5"
                style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
              >
                <Layers size={14} />
                <span>Generate Flashcards from Weaknesses</span>
              </button>
            </div>
          </div>

          {/* Strengths and Critical Areas to Improve */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl border space-y-3" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)" }}>
              <div className="flex items-center gap-2 text-emerald-500 text-sm font-bold">
                <CheckCircle2 size={18} />
                <span>Examiner Identified Strengths</span>
              </div>
              <ul className="space-y-1.5 text-xs">
                {evaluationReport.strengths.map((str, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ color: "var(--m-text)" }}>
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 rounded-3xl border space-y-3" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)" }}>
              <div className="flex items-center gap-2 text-red-500 text-sm font-bold">
                <AlertCircle size={18} />
                <span>Critical Areas to Improve (Marks Dropped Here)</span>
              </div>
              <ul className="space-y-1.5 text-xs">
                {evaluationReport.criticalAreasToImprove.map((area, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ color: "var(--m-text)" }}>
                    <span className="text-red-500 font-bold">•</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Question-by-Question Detailed Review */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
              Detailed Question-by-Question Marking & Model Answers
            </h3>

            {evaluationReport.questionEvaluations.map((qe) => {
              const isFullMarks = qe.awardedMarks === qe.maxMarks;
              const isExpanded = expandedQuestionId === qe.questionId;
              const matchedOriginalQuestion = activePaper?.sections.flatMap(s => s.questions).find(q => q.number === qe.questionNumber);

              return (
                <div
                  key={qe.questionId}
                  className="rounded-2xl border overflow-hidden transition"
                  style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)" }}
                >
                  {/* Header Row */}
                  <div
                    onClick={() => setExpandedQuestionId(isExpanded ? null : qe.questionId)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-7 rounded-xl grid place-items-center text-xs font-bold" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text-heading)" }}>
                        Q{qe.questionNumber}
                      </span>
                      <div>
                        <p className="text-xs font-bold line-clamp-1" style={{ color: "var(--m-text-heading)" }}>
                          {qe.questionText}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--m-text-sub)" }}>
                          Student: {qe.studentAnswerText.slice(0, 50)}...
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                          isFullMarks
                            ? "bg-emerald-500/20 text-emerald-500"
                            : qe.awardedMarks > 0
                            ? "bg-amber-500/20 text-amber-500"
                            : "bg-red-500/20 text-red-500"
                        }`}
                      >
                        {qe.awardedMarks} / {qe.maxMarks} Marks
                      </span>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>

                  {/* Expanded Breakdown */}
                  {isExpanded && (
                    <div className="p-5 border-t space-y-4 text-xs" style={{ borderColor: "var(--m-border-light)", backgroundColor: "var(--m-surface-alt)" }}>
                      {/* Transcribed Handwriting */}
                      <div className="p-3.5 rounded-xl border space-y-1" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)" }}>
                        <p className="font-bold text-[11px] uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
                          Your Hand-written Answer (Transcribed by Vision AI):
                        </p>
                        <p className="font-mono text-xs italic" style={{ color: "var(--m-text)" }}>
                          "{qe.studentAnswerText}"
                        </p>
                      </div>

                      {/* Step Marking Breakdown */}
                      {qe.stepBreakdown && qe.stepBreakdown.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="font-bold text-[11px] uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
                            CBSE Step-Marking Scheme Applied:
                          </p>
                          <div className="space-y-1">
                            {qe.stepBreakdown.map((step, sIdx) => (
                              <div
                                key={sIdx}
                                className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5"
                              >
                                <span style={{ color: "var(--m-text)" }}>• {step.stepDescription}</span>
                                <span className="font-bold font-mono ml-2 shrink-0" style={{ color: step.awardedMarks > 0 ? "#10b981" : "#ef4444" }}>
                                  +{step.awardedMarks} / {step.maxMarks} m
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lost Marks Critique (Red Warning) */}
                      {qe.lostMarksCritique && (
                        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 space-y-1">
                          <p className="font-bold flex items-center gap-1.5">
                            <AlertCircle size={14} />
                            <span>Why You Lost Marks:</span>
                          </p>
                          <p>{qe.lostMarksCritique}</p>
                        </div>
                      )}

                      {/* Distractor Analysis if MCQ */}
                      {matchedOriginalQuestion?.distractorAnalysis && (
                        <div className="space-y-2 p-3.5 rounded-xl border" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)" }}>
                          <p className="font-bold text-[11px] uppercase tracking-wider" style={{ color: "var(--m-text-muted)" }}>
                            Professional Distractor Analysis (Why each option is right/wrong):
                          </p>
                          <div className="space-y-1.5">
                            {matchedOriginalQuestion.distractorAnalysis.map((da) => (
                              <div key={da.optionKey} className="flex items-start gap-2">
                                <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${da.isCorrect ? "bg-emerald-500 text-white" : "bg-red-500/20 text-red-500"}`}>
                                  {da.optionKey}
                                </span>
                                <div>
                                  <span className="font-semibold">{da.text}:</span>{" "}
                                  <span style={{ color: "var(--m-text-sub)" }}>{da.whyWrongOrRight}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ideal Model Answer */}
                      <div className="p-3.5 rounded-xl border space-y-1" style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border-light)" }}>
                        <p className="font-bold text-[11px] uppercase tracking-wider text-emerald-500">
                          Ideal CBSE Model Answer (Full Marks):
                        </p>
                        <p className="leading-relaxed" style={{ color: "var(--m-text)" }}>
                          {qe.idealModelAnswer}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════ VIEW 5: HISTORY ════════════════════════════ */}
      {currentView === "history" && (
        <div
          className="rounded-3xl p-6 sm:p-8 space-y-6"
          style={{ backgroundColor: "var(--m-surface)", border: "1px solid var(--m-border-light)" }}
        >
          <div className="border-b pb-4 flex items-center justify-between" style={{ borderColor: "var(--m-border-light)" }}>
            <div>
              <h2 className="text-xl font-bold font-[Roboto_Slab]" style={{ color: "var(--m-text-heading)" }}>
                Examination History & Progress Log
              </h2>
              <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>
                Review past mock papers, retake exams, or inspect previous Vision AI correction reports.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-black/5 dark:bg-white/10" style={{ color: "var(--m-text-muted)" }}>
              {savedExams.length} Exams Saved
            </span>
          </div>

          {savedExams.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="size-16 mx-auto rounded-2xl grid place-items-center" style={{ backgroundColor: "var(--m-surface-alt)", color: "var(--m-text-muted)" }}>
                <BookOpen size={28} />
              </div>
              <h3 className="font-bold text-base" style={{ color: "var(--m-text-heading)" }}>No Mock Exams Taken Yet</h3>
              <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--m-text-sub)" }}>
                Generate your first CBSE examination paper to start testing under real exam hall conditions.
              </p>
              <button
                type="button"
                onClick={() => setCurrentView("generator")}
                className="mt-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow transition hover:scale-105"
                style={{ backgroundColor: "var(--m-primary)", color: "var(--m-primary-text)" }}
              >
                Create First Exam
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {savedExams.map((record) => (
                <div
                  key={record.paper.id}
                  className="p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition hover:border-[var(--m-primary)]"
                  style={{ backgroundColor: "var(--m-surface-alt)", borderColor: "var(--m-border-light)" }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-black/5 dark:bg-white/10" style={{ color: "var(--m-text-muted)" }}>
                        {record.paper.classLevel}
                      </span>
                      <span className="text-xs font-bold text-emerald-500">
                        {record.paper.subject}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold" style={{ color: "var(--m-text-heading)" }}>
                      {record.paper.title}
                    </h4>
                    <p className="text-xs" style={{ color: "var(--m-text-sub)" }}>
                      {record.paper.totalMarks} Marks • {record.paper.durationMinutes} Mins • {new Date(record.paper.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {record.evaluation && (
                      <div className="text-right">
                        <span className="text-sm font-bold font-mono" style={{ color: "var(--m-primary)" }}>
                          {record.evaluation.obtainedMarks}/{record.evaluation.totalMarks} ({record.evaluation.percentage}%)
                        </span>
                        <span className="block text-[10px] font-bold text-emerald-500">
                          Grade {record.evaluation.cbseGradeBand}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setActivePaper(record.paper);
                        if (record.evaluation) {
                          setEvaluationReport(record.evaluation);
                          setCurrentView("scorecard");
                        } else {
                          setCurrentView("exam_hall");
                        }
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold border transition hover:scale-105"
                      style={{ backgroundColor: "var(--m-surface)", borderColor: "var(--m-border)", color: "var(--m-text)" }}
                    >
                      {record.evaluation ? "View Scorecard" : "Take Exam"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

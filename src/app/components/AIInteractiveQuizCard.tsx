import React, { useState, lazy, Suspense } from "react";
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trophy,
  Sparkles,
  BookOpen,
  Lightbulb,
  Layers,
  ListChecks,
  Eye,
} from "lucide-react";
import confetti from "canvas-confetti";

const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

export interface QuizQuestion {
  question: string;
  options: Array<{ label: string; text: string }>;
  correctIndex: number;
  explanation?: string;
}

export interface InteractiveQuizSpec {
  title: string;
  subject?: string;
  difficulty?: "Easy" | "Medium" | "Hard" | string;
  questions: QuizQuestion[];
}

interface AIInteractiveQuizCardProps {
  spec: InteractiveQuizSpec;
  onComplete?: (score: number, total: number) => void;
  onSaveToFlashcards?: (
    subject: string | undefined,
    cards: Array<{ front: string; back: string }>
  ) => void;
  onRequestMoreQuestions?: (prompt: string) => void;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

/** Lightweight inline markdown + KaTeX renderer for quiz text */
const QuizText: React.FC<{ text: string; className?: string; serif?: boolean }> = ({
  text,
  className = "",
  serif = true,
}) => {
  const hasRichSyntax = /[\$`*_\\]/.test(text);
  if (!hasRichSyntax) {
    return (
      <span className={`${serif ? "font-ai-serif" : ""} ${className}`}>
        {text}
      </span>
    );
  }
  return (
    <Suspense fallback={<span className={className}>{text}</span>}>
      <MarkdownRenderer
        content={text}
        compact={!serif}
        serif={serif}
        className={`!space-y-1 [&>p]:!my-0 ${className}`}
      />
    </Suspense>
  );
};

export const AIInteractiveQuizCard: React.FC<AIInteractiveQuizCardProps> = ({
  spec,
  onComplete,
  onSaveToFlashcards,
  onRequestMoreQuestions,
  showToast,
}) => {
  const questions = spec.questions || [];
  const total = questions.length;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [hasAwardedXP, setHasAwardedXP] = useState(false);
  const [savedFlashcards, setSavedFlashcards] = useState(false);

  if (total === 0) return null;

  const currentQ = questions[currentIdx] || questions[0];
  const selectedOpt = answers[currentIdx];
  const isAnswered = selectedOpt !== undefined;
  const isCorrect = isAnswered && selectedOpt === currentQ.correctIndex;

  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.entries(answers).reduce((acc, [qIdx, optIdx]) => {
    const q = questions[Number(qIdx)];
    return acc + (q && q.correctIndex === optIdx ? 1 : 0);
  }, 0);

  const percentage = Math.round((correctCount / total) * 100);
  const progressPct = Math.round((answeredCount / total) * 100);

  const handleSelectOption = (optIdx: number) => {
    if (isAnswered) return;
    const nextAnswers = { ...answers, [currentIdx]: optIdx };
    setAnswers(nextAnswers);
  };

  const handleFinishQuiz = () => {
    setShowSummary(true);
    setReviewMode(false);
    if (!hasAwardedXP) {
      setHasAwardedXP(true);
      onComplete?.(correctCount, total);
      if (percentage >= 80) {
        try {
          confetti({
            particleCount: 55,
            spread: 60,
            origin: { y: 0.65 },
          });
        } catch {
          // Ignore confetti errors in restricted environments
        }
      }
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIdx(0);
    setShowSummary(false);
    setReviewMode(false);
  };

  const handleSaveCards = (onlyMissed: boolean) => {
    if (!onSaveToFlashcards) return;
    const targetQuestions = onlyMissed
      ? questions.filter((q, idx) => answers[idx] !== q.correctIndex)
      : questions;

    if (targetQuestions.length === 0) {
      showToast?.("No missed questions to save — you nailed them all!", "info");
      return;
    }

    const cards = targetQuestions.map((q) => {
      const correctOpt = q.options[q.correctIndex];
      const answerLine = correctOpt ? `${correctOpt.label}) ${correctOpt.text}` : "";
      const back = q.explanation
        ? `**Answer:** ${answerLine}\n\n${q.explanation}`
        : `**Answer:** ${answerLine}`;
      return {
        front: q.question,
        back,
      };
    });

    onSaveToFlashcards(spec.subject, cards);
    setSavedFlashcards(true);
    setTimeout(() => setSavedFlashcards(false), 2500);
  };

  const difficultyColor =
    spec.difficulty?.toLowerCase() === "hard"
      ? "bg-rose-500/15 text-rose-400 border-rose-500/25"
      : spec.difficulty?.toLowerCase() === "easy"
        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
        : "bg-amber-500/15 text-amber-400 border-amber-500/25";

  return (
    <div
      className="w-full my-2.5 rounded-2xl overflow-hidden border shadow-md transition-all"
      style={{
        backgroundColor: "var(--m-surface)",
        borderColor: "var(--m-border)",
      }}
    >
      {/* Top Progress Bar */}
      <div className="h-1 w-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${showSummary ? 100 : Math.max(6, progressPct)}%`,
            backgroundColor: "var(--m-primary)",
          }}
        />
      </div>

      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b"
        style={{
          borderColor: "var(--m-border-light)",
          backgroundColor: "var(--m-surface-alt)",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="size-8 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: "var(--m-surface)",
              borderColor: "var(--m-border)",
              color: "var(--m-primary)",
            }}
          >
            <ListChecks size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className="text-xs sm:text-[13.5px] font-bold truncate"
                style={{ color: "var(--m-text-heading)" }}
              >
                {spec.title || "Interactive Practice Quiz"}
              </h4>
              {spec.subject && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: "var(--m-surface)",
                    borderColor: "var(--m-border-light)",
                    color: "var(--m-text-sub)",
                  }}
                >
                  {spec.subject}
                </span>
              )}
              {spec.difficulty && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${difficultyColor}`}
                >
                  {spec.difficulty}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Telemetry Pill */}
        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
          {!showSummary && (
            <span
              className="px-2.5 py-1 rounded-lg border font-semibold"
              style={{
                backgroundColor: "var(--m-surface)",
                borderColor: "var(--m-border-light)",
                color: "var(--m-text)",
              }}
            >
              Q {currentIdx + 1}/{total}
            </span>
          )}
          <span
            className="px-2.5 py-1 rounded-lg border font-semibold"
            style={{
              backgroundColor: "var(--m-surface)",
              borderColor: "var(--m-border-light)",
              color: answeredCount > 0 ? "#10b981" : "var(--m-text-sub)",
            }}
          >
            {correctCount}/{answeredCount || total}
          </span>
        </div>
      </div>

      {/* ─── Summary View ─── */}
      {showSummary ? (
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Score Circle */}
            <div className="relative size-24 shrink-0 flex items-center justify-center">
              <svg className="size-24 -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  className="opacity-15"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke={percentage >= 80 ? "#10b981" : percentage >= 50 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - percentage / 100)}`}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-xl font-bold font-mono"
                  style={{ color: "var(--m-text-heading)" }}
                >
                  {percentage}%
                </span>
                <span className="text-[10px] opacity-65 font-mono">
                  {correctCount}/{total}
                </span>
              </div>
            </div>

            <div className="text-center sm:text-left space-y-1.5 flex-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
                <Trophy size={14} />
                <span>
                  {percentage === 100
                    ? "Perfect Mastery!"
                    : percentage >= 80
                      ? "Excellent Work!"
                      : percentage >= 50
                        ? "Solid Progress"
                        : "Keep Practicing"}
                </span>
              </div>
              <h3
                className="text-base sm:text-lg font-bold font-ai-serif"
                style={{ color: "var(--m-text-heading)" }}
              >
                You got {correctCount} out of {total} questions right.
              </h3>
              <p className="text-xs opacity-75 leading-relaxed">
                {percentage === 100
                  ? "You aced every single question. Ready to push to harder exam-level problems?"
                  : "Review your explanations below or turn missed questions into flashcards for spaced repetition."}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRetake}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition hover:opacity-85"
              style={{
                borderColor: "var(--m-border)",
                backgroundColor: "var(--m-surface-alt)",
                color: "var(--m-text)",
              }}
            >
              <RotateCcw size={13} />
              <span>Retake Quiz</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSummary(false);
                setReviewMode(true);
                setCurrentIdx(0);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition hover:opacity-85"
              style={{
                borderColor: "var(--m-border)",
                backgroundColor: "var(--m-surface-alt)",
                color: "var(--m-text)",
              }}
            >
              <Eye size={13} />
              <span>Review All</span>
            </button>

            {onSaveToFlashcards && (
              <button
                type="button"
                onClick={() => handleSaveCards(correctCount < total)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition hover:opacity-85"
                style={{
                  borderColor: "var(--m-border)",
                  backgroundColor: "var(--m-surface-alt)",
                  color: savedFlashcards ? "#10b981" : "var(--m-text)",
                }}
              >
                <Layers size={13} />
                <span>
                  {savedFlashcards
                    ? "Saved to Flashcards!"
                    : correctCount < total
                      ? "Save Missed to Flashcards"
                      : "Save to Flashcards"}
                </span>
              </button>
            )}

            {onRequestMoreQuestions && (
              <button
                type="button"
                onClick={() =>
                  onRequestMoreQuestions(
                    `Give me ${total} harder exam-level MCQs on "${spec.title}"${spec.subject ? ` (${spec.subject})` : ""} to challenge me further.`
                  )
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition hover:scale-102 active:scale-98 shadow-xs ml-auto"
                style={{
                  backgroundColor: "var(--m-primary)",
                  color: "var(--m-primary-text, #ffffff)",
                }}
              >
                <Sparkles size={13} />
                <span>Harder Quiz</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ─── Active Question View ─── */
        <div className="p-4 sm:p-5 space-y-4">
          {reviewMode && (
            <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <span className="font-semibold flex items-center gap-1.5">
                <BookOpen size={12} /> Review Mode
              </span>
              <button
                type="button"
                onClick={() => setShowSummary(true)}
                className="underline font-semibold hover:opacity-80"
              >
                Back to Score
              </button>
            </div>
          )}

          {/* Question Stem */}
          <div
            className="text-[15px] sm:text-[16px] font-medium leading-[1.68]"
            style={{ color: "var(--m-text-heading)" }}
          >
            <QuizText text={currentQ.question} serif />
          </div>

          {/* Options List */}
          <div className="space-y-2">
            {currentQ.options.map((opt, optIdx) => {
              const isSelected = selectedOpt === optIdx;
              const isCorrectOption = currentQ.correctIndex === optIdx;

              let borderColor = "var(--m-border)";
              let bgColor = "var(--m-surface-alt)";
              let badgeBg = "var(--m-surface)";
              let badgeColor = "var(--m-text-sub)";

              if (isAnswered) {
                if (isCorrectOption) {
                  borderColor = "rgba(16, 185, 129, 0.55)";
                  bgColor = "rgba(16, 185, 129, 0.11)";
                  badgeBg = "#10b981";
                  badgeColor = "#ffffff";
                } else if (isSelected && !isCorrectOption) {
                  borderColor = "rgba(244, 63, 94, 0.55)";
                  bgColor = "rgba(244, 63, 94, 0.11)";
                  badgeBg = "#f43f5e";
                  badgeColor = "#ffffff";
                }
              }

              return (
                <button
                  key={optIdx}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(optIdx)}
                  className={`w-full text-left flex items-start gap-3 px-3.5 py-2.5 sm:py-3 rounded-xl border transition-all ${
                    !isAnswered
                      ? "hover:border-current hover:translate-x-0.5 cursor-pointer active:scale-[0.995]"
                      : "cursor-default"
                  } ${isAnswered && !isCorrectOption && !isSelected ? "opacity-55" : ""}`}
                  style={{
                    borderColor,
                    backgroundColor: bgColor,
                    color: "var(--m-text)",
                  }}
                >
                  <span
                    className="size-6 rounded-lg text-[11px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 border transition-colors"
                    style={{
                      backgroundColor: badgeBg,
                      color: badgeColor,
                      borderColor: isAnswered && (isCorrectOption || isSelected) ? "transparent" : "var(--m-border-light)",
                    }}
                  >
                    {opt.label}
                  </span>

                  <div className="flex-1 text-[13.5px] sm:text-[14.5px] leading-relaxed min-w-0">
                    <QuizText text={opt.text} serif />
                  </div>

                  {isAnswered && isCorrectOption && (
                    <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  {isAnswered && isSelected && !isCorrectOption && (
                    <XCircle size={17} className="text-rose-500 shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Instant Feedback & Explanation */}
          {isAnswered && (
            <div
              className="rounded-xl p-3.5 border text-xs sm:text-[13.5px] leading-relaxed space-y-1.5"
              style={{
                borderColor: isCorrect ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)",
                backgroundColor: isCorrect ? "rgba(16, 185, 129, 0.06)" : "rgba(244, 63, 94, 0.06)",
              }}
            >
              <div
                className={`flex items-center gap-1.5 text-xs font-bold ${
                  isCorrect ? "text-emerald-500" : "text-rose-400"
                }`}
              >
                <Lightbulb size={13} />
                <span>
                  {isCorrect
                    ? "Correct!"
                    : `Not quite — Correct answer is ${currentQ.options[currentQ.correctIndex]?.label || ""}`}
                </span>
              </div>
              {currentQ.explanation && (
                <div style={{ color: "var(--m-text)" }}>
                  <QuizText text={currentQ.explanation} serif />
                </div>
              )}
            </div>
          )}

          {/* Footer Navigation & Question Stepper Dots */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t"
            style={{ borderColor: "var(--m-border-light)" }}
          >
            {/* Question Number Dots */}
            <div className="flex items-center gap-1 flex-wrap">
              {questions.map((q, idx) => {
                const ans = answers[idx];
                const isActive = idx === currentIdx;
                let dotStyle: React.CSSProperties = {
                  backgroundColor: isActive ? "var(--m-primary)" : "var(--m-surface-alt)",
                  color: isActive ? "var(--m-primary-text, #ffffff)" : "var(--m-text-sub)",
                  borderColor: isActive ? "transparent" : "var(--m-border-light)",
                };
                if (ans !== undefined && !isActive) {
                  const right = ans === q.correctIndex;
                  dotStyle = {
                    backgroundColor: right ? "rgba(16, 185, 129, 0.18)" : "rgba(244, 63, 94, 0.18)",
                    color: right ? "#10b981" : "#f43f5e",
                    borderColor: right ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)",
                  };
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className="size-6 rounded-lg text-[10.5px] font-mono font-bold border transition hover:scale-105"
                    style={dotStyle}
                    title={`Question ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Prev / Next / Finish Buttons */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition hover:opacity-80 disabled:opacity-35"
                style={{
                  borderColor: "var(--m-border)",
                  color: "var(--m-text)",
                }}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>

              {currentIdx < total - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:scale-102 active:scale-98 shadow-xs"
                  style={{
                    backgroundColor: isAnswered ? "var(--m-primary)" : "var(--m-surface-alt)",
                    color: isAnswered ? "var(--m-primary-text, #ffffff)" : "var(--m-text)",
                    border: isAnswered ? "none" : "1px solid var(--m-border)",
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishQuiz}
                  disabled={answeredCount === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition hover:scale-102 active:scale-98 disabled:opacity-40 shadow-xs"
                  style={{
                    backgroundColor: "var(--m-primary)",
                    color: "var(--m-primary-text, #ffffff)",
                  }}
                >
                  <Trophy size={13} />
                  <span>{answeredCount === total ? "See Results" : "Finish Quiz"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInteractiveQuizCard;

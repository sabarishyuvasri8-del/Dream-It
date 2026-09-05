/**
 * types.ts
 * Type definitions for the AI Exam Simulator & Handwritten Answer Grader.
 */

export type CBSEClassLevel = "Class 9" | "Class 10" | "Class 11" | "Class 12";

export type ExamDifficulty = "Foundational" | "CBSE Board Standard" | "High-Scorer Challenger";

export type ExamLengthType = "diagnostic_20" | "mid_term_40" | "full_board_80";

export interface ExamConfig {
  classLevel: CBSEClassLevel;
  subject: string;
  topicOrChapter: string;
  sourceNoteId?: string;
  sourceNoteContent?: string;
  difficulty: ExamDifficulty;
  lengthType: ExamLengthType;
  totalMarks: number;
  durationMinutes: number;
}

export type SectionType = "Section A" | "Section B" | "Section C" | "Section D" | "Section E";

export type QuestionType = 
  | "mcq" 
  | "assertion-reason" 
  | "vsa"           // Very Short Answer (2 marks)
  | "sa"            // Short Answer (3 marks)
  | "la"            // Long Answer (5 marks)
  | "case-based";   // Case Study Integrated (4 marks)

export interface MarkingStep {
  stepDescription: string;
  marks: number;
}

export interface OptionDistractorAnalysis {
  optionKey: "A" | "B" | "C" | "D";
  text: string;
  isCorrect: boolean;
  whyWrongOrRight: string;
}

export interface ExamQuestion {
  id: string;
  number: number;
  section: SectionType;
  type: QuestionType;
  questionText: string;
  marks: number;
  
  // For Section A & objective items:
  options?: { key: "A" | "B" | "C" | "D"; text: string }[];
  correctOption?: "A" | "B" | "C" | "D";
  
  // For Assertion-Reason items:
  assertionText?: string;
  reasonText?: string;

  // For Case-Based items (Section E):
  caseStudyScenario?: string;
  subParts?: {
    partNumber: string;
    questionText: string;
    marks: number;
    answerKey: string;
  }[];

  // Professional-Grade Explanation & CBSE Marking Scheme:
  markingScheme: MarkingStep[];
  detailedExplanation: string;
  distractorAnalysis?: OptionDistractorAnalysis[];
  keyFormulasOrConcepts: string[];
  examinerTip?: string;
}

export interface ExamPaper {
  id: string;
  title: string;
  subject: string;
  classLevel: CBSEClassLevel;
  difficulty: ExamDifficulty;
  totalMarks: number;
  durationMinutes: number;
  createdAt: string;
  generalInstructions: string[];
  sections: {
    section: SectionType;
    title: string;
    instructions: string;
    questions: ExamQuestion[];
  }[];
}

export interface QuestionEvaluation {
  questionNumber: number;
  questionId: string;
  questionText: string;
  maxMarks: number;
  awardedMarks: number;
  studentAnswerText: string;
  stepBreakdown: {
    stepDescription: string;
    maxMarks: number;
    awardedMarks: number;
    feedback: string;
  }[];
  lostMarksCritique?: string;
  idealModelAnswer: string;
  examinerNotes?: string;
}

export interface HandwrittenEvaluationReport {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  cbseGradeBand: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "D" | "E";
  overallSummary: string;
  strengths: string[];
  criticalAreasToImprove: string[];
  questionEvaluations: QuestionEvaluation[];
  annotatedImages: string[];
  evaluatedAt: string;
}

export interface StoredExamRecord {
  paper: ExamPaper;
  evaluation?: HandwrittenEvaluationReport;
  userDigitalAnswers?: Record<string, string>;
  completedAt?: string;
}

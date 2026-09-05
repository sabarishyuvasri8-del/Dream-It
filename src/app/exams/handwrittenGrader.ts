/**
 * handwrittenGrader.ts
 * Agent 3: Chief CBSE Board Evaluator (Multimodal Vision Grader).
 * Ingests student handwritten answer sheets, performs handwriting OCR, applies step-marking schemes,
 * highlights lost marks, and calculates CBSE grade bands.
 */

import { fetchAI, ImageAttachment } from "../../lib/ai-client";
import { ExamPaper, HandwrittenEvaluationReport, QuestionEvaluation } from "./types";

/**
 * Calculates official CBSE 9-point grading scale from percentage
 */
export function calculateCBSEGrade(percentage: number): "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "D" | "E" {
  if (percentage >= 91) return "A1";
  if (percentage >= 81) return "A2";
  if (percentage >= 71) return "B1";
  if (percentage >= 61) return "B2";
  if (percentage >= 51) return "C1";
  if (percentage >= 41) return "C2";
  if (percentage >= 33) return "D";
  return "E";
}

/**
 * Evaluates student answer sheets (handwritten images and/or digital entries)
 * against the official question paper marking schemes.
 */
export async function evaluateAnswerSheet(
  paper: ExamPaper,
  images: ImageAttachment[],
  digitalAnswers?: Record<string, string>
): Promise<{ report?: HandwrittenEvaluationReport; error?: string }> {
  // Collect all questions with their step marking schemes into a reference context
  const questionsContext = paper.sections.flatMap(s => s.questions).map(q => {
    const stepsStr = q.markingScheme.map(ms => `  - [${ms.marks}m]: ${ms.stepDescription}`).join("\n");
    return `QUESTION ${q.number} (Marks: ${q.marks}):
Text: "${q.questionText}"
Correct/Model Answer: "${q.correctOption || q.detailedExplanation}"
Official CBSE Marking Scheme:
${stepsStr}`;
  }).join("\n\n---\n\n");

  const digitalEntriesStr = digitalAnswers && Object.keys(digitalAnswers).length > 0
    ? `\nSTUDENT DIGITAL SUBMISSIONS:\n` + Object.entries(digitalAnswers).map(([k, v]) => `Question ID ${k}: "${v}"`).join("\n")
    : "";

  const prompt = `You are the Chief Head Examiner for the CBSE Board Examinations (Agent 3).
You are evaluating a student's answer sheet for the following exam:
EXAM: "${paper.title}" (${paper.subject} - ${paper.classLevel})
TOTAL MARKS: ${paper.totalMarks}

OFFICIAL QUESTIONS & CBSE STEP-MARKING SCHEMES:
${questionsContext}
${digitalEntriesStr}

EVALUATION PROTOCOL:
1. Examine the attached handwritten answer sheet image(s). Transcribe the student's handwritten responses for each question attempted.
2. For each question, strictly evaluate according to the provided CBSE Step-Marking Scheme.
   - Award step marks for formulas, proper substitutions, correct intermediate steps, and appropriate SI units.
   - If an arithmetic calculation error occurs but the formula and methodology are correct, deduct only 0.5 or 1 mark as per CBSE rules (do NOT award zero for the whole question).
3. If an answer loses marks, provide a clear, constructive, and polite "lostMarksCritique" explaining exactly what step was missing or incorrect (e.g. "Forgot to write unit 'm/s²', costing 0.5 marks", or "Missed the reason statement for Assertion").
4. Provide the "idealModelAnswer" showing the perfect, full-marks response the examiner expected.
5. Calculate the total obtained marks, calculate the percentage, and assign the official CBSE Grade Band (A1 for >=91%, A2 for 81-90%, B1 for 71-80%, B2 for 61-70%, C1 for 51-60%, C2 for 41-50%, D for 33-40%, E for <33%).

OUTPUT FORMAT:
Output ONLY valid JSON matching this exact structure:
{
  "totalMarks": ${paper.totalMarks},
  "obtainedMarks": 0,
  "overallSummary": "Professional summary of student's performance...",
  "strengths": ["Clear formula presentation", "Neat step-by-step working"],
  "criticalAreasToImprove": ["Remember to include SI units", "Show intermediate integration steps"],
  "questionEvaluations": [
    {
      "questionNumber": 1,
      "maxMarks": 1,
      "awardedMarks": 1,
      "studentAnswerText": "Transcribed student response...",
      "stepBreakdown": [
        {
          "stepDescription": "Correct option identification",
          "maxMarks": 1,
          "awardedMarks": 1,
          "feedback": "Correct option chosen."
        }
      ],
      "lostMarksCritique": "",
      "idealModelAnswer": "Option A...",
      "examinerNotes": "Good job."
    }
  ]
}`;

  try {
    const primaryImage = images.length > 0 ? images[0] : undefined;

    const res = await fetchAI({
      model: "gemini-3.1-flash-lite",
      messages: [{ role: "user", content: prompt }],
      image: primaryImage,
      temperature: 0.1,
      max_tokens: 4096,
    });

    if (res.error) {
      return { error: res.error };
    }

    let raw = (res.content || "").trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const parsed = JSON.parse(raw);
    const totalMarks = Number(parsed.totalMarks) || paper.totalMarks || 1;
    const obtainedMarks = Math.min(totalMarks, Math.max(0, Number(parsed.obtainedMarks) || 0));
    const percentage = Math.round((obtainedMarks / totalMarks) * 100);
    const cbseGradeBand = calculateCBSEGrade(percentage);

    // Map question evaluations with IDs from the paper
    const allQuestions = paper.sections.flatMap(s => s.questions);
    const questionEvaluations: QuestionEvaluation[] = (parsed.questionEvaluations || []).map((qe: any, idx: number) => {
      const matchedQ = allQuestions.find(q => q.number === qe.questionNumber) || allQuestions[idx];
      return {
        questionNumber: qe.questionNumber || (matchedQ ? matchedQ.number : idx + 1),
        questionId: matchedQ ? matchedQ.id : `q-${idx + 1}`,
        questionText: matchedQ ? matchedQ.questionText : (qe.questionText || "Question"),
        maxMarks: qe.maxMarks || (matchedQ ? matchedQ.marks : 1),
        awardedMarks: Math.max(0, Number(qe.awardedMarks) || 0),
        studentAnswerText: qe.studentAnswerText || "(No legible handwriting detected for this item)",
        stepBreakdown: Array.isArray(qe.stepBreakdown) ? qe.stepBreakdown : [],
        lostMarksCritique: qe.lostMarksCritique || undefined,
        idealModelAnswer: qe.idealModelAnswer || (matchedQ ? matchedQ.detailedExplanation : "Model Answer"),
        examinerNotes: qe.examinerNotes || undefined,
      };
    });

    const report: HandwrittenEvaluationReport = {
      id: crypto.randomUUID(),
      examId: paper.id,
      examTitle: paper.title,
      subject: paper.subject,
      totalMarks,
      obtainedMarks,
      percentage,
      cbseGradeBand,
      overallSummary: parsed.overallSummary || `Student scored ${obtainedMarks}/${totalMarks} (${percentage}%).`,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ["Attempted questions diligently"],
      criticalAreasToImprove: Array.isArray(parsed.criticalAreasToImprove) ? parsed.criticalAreasToImprove : ["Focus on complete derivations and unit accuracy"],
      questionEvaluations,
      annotatedImages: images.map(img => img.dataUrl || `data:${img.mimeType};base64,${img.base64Data}`),
      evaluatedAt: new Date().toISOString(),
    };

    return { report };
  } catch (err: any) {
    console.error("Handwritten grading error:", err);
    return { error: err?.message || "Failed to evaluate answer sheet. Please ensure photos are clear and retry." };
  }
}

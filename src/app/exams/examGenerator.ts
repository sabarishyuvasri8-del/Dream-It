/**
 * examGenerator.ts
 * Multi-Agent CBSE Question Paper Generation Engine.
 * Combines Agent 1 (Paper Setter / Blueprint Architect) and Agent 2 (Senior Pedagogy & Solution Master).
 */

import { fetchAI } from "../../lib/ai-client";
import { safeParseJSON } from "../../lib/json-repair";
import { ExamConfig, ExamPaper, ExamQuestion, SectionType } from "./types";

/**
 * Builds the comprehensive prompt for Agent 1 and Agent 2 to synthesize
 * an authentic, 100% Multiple Choice Question (MCQ) examination paper
 * with professional-grade distractor analysis and step-by-step logic.
 */
function buildExamPrompt(config: ExamConfig): string {
  const { classLevel, subject, topicOrChapter, sourceNoteContent, difficulty, lengthType, totalMarks, durationMinutes } = config;

  let questionDistribution = "";
  if (lengthType === "diagnostic_20") {
    questionDistribution = `
- Total Marks: 20 Marks | Duration: 30 Minutes
- Structure: Exactly 20 Multiple Choice Questions across 3 sections (1 mark each = 20 Marks total)
  - Section A: Core Conceptual & Definition MCQs (MUST HAVE EXACTLY 10 MCQs, numbered 1 to 10)
  - Section B: Application, Calculations & Code/Problem Solving MCQs (MUST HAVE EXACTLY 7 MCQs, numbered 11 to 17)
  - Section C: Assertion-Reason & Logic MCQs (MUST HAVE EXACTLY 3 MCQs, numbered 18 to 20)
TOTAL MUST EQUAL EXACTLY 20 MCQs (Do NOT omit Section C or truncate early).
`;
  } else if (lengthType === "mid_term_40") {
    questionDistribution = `
- Total Marks: 40 Marks | Duration: 60 Minutes
- Structure: Exactly 30 Multiple Choice Questions (40 Marks total)
  - Section A: Fundamental Concept MCQs (12 MCQs, 1 mark each = 12 Marks)
  - Section B: Application, Calculations & Code Analysis MCQs (12 MCQs, 1.5 marks each = 18 Marks)
  - Section C: Case-Based & Assertion-Reason MCQs (6 MCQs, 1.67 marks each = 10 Marks)
TOTAL MUST EQUAL EXACTLY 30 MCQs.
`;
  } else {
    // 80 Marks Full Board Simulation
    questionDistribution = `
- Total Marks: 80 Marks | Duration: 120-180 Minutes
- Structure: Exactly 50 Multiple Choice Questions (80 Marks total)
  - Section A: Foundational Knowledge MCQs (20 MCQs = 30 Marks)
  - Section B: Advanced Application & Complex Calculations/Code MCQs (20 MCQs = 30 Marks)
  - Section C: Assertion-Reason & Case-Scenario MCQs (10 MCQs = 20 Marks)
TOTAL MUST EQUAL EXACTLY 50 MCQs.
`;
  }

  return `You are acting as two master educational agents collaborating to create a state-of-the-art 100% Multiple Choice Question (MCQ) Examination Paper:
AGENT 1: Chief CBSE Question Paper Setter (Strictly adheres to official CBSE curriculum, NCERT guidelines, Blooms taxonomy, and zero ambiguity).
AGENT 2: Senior Pedagogy & Solution Master (Author of national reference textbooks; delivers professional-grade explanations and distractor analysis).

EXAMINATION SPECIFICATIONS:
- Class Level: ${classLevel}
- Subject: ${subject}
- Chapter / Topic: "${topicOrChapter}"
- Difficulty Target: ${difficulty}
- Total Marks: ${totalMarks}
- Time Allowed: ${durationMinutes} Minutes
${sourceNoteContent ? `\nSOURCE STUDY NOTES CONTEXT:\n\"\"\"\n${sourceNoteContent.slice(0, 8000)}\n\"\"\"\n` : ""}

BLUEPRINT & QUESTION DISTRIBUTION:
${questionDistribution}

STRICT 100% MCQ REQUIREMENTS (MANDATORY):
1. EVERY SINGLE QUESTION WITHOUT EXCEPTION MUST BE A MULTIPLE CHOICE QUESTION (MCQ) WITH EXACTLY 4 OPTIONS: A, B, C, and D.
2. DO NOT GENERATE ANY OPEN-ENDED TEXT QUESTIONS, VSA WITHOUT OPTIONS, SHORT ANSWERS WITHOUT OPTIONS, OR ESSAYS.
3. Every MCQ must designate a "correctOption" ("A", "B", "C", or "D").
4. GENERATE ALL SECTIONS (Section A, Section B, Section C) COMPLETELY. Do not truncate or stop after Section B.
5. For Assertion-Reason questions, use standard official options:
   - A: Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).
   - B: Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).
   - C: Assertion (A) is true but Reason (R) is false.
   - D: Assertion (A) is false but Reason (R) is true.
5. For STEM / Computer Science, convert code tracing, syntax error identification, and output predictions into clean 4-option MCQs.
6. Options must be authentic and plausible; distractors must reflect common conceptual or calculation pitfalls.

EXPLANATIONS & DISTRACTOR ANALYSIS:
- Detailed Explanation: Step-by-step breakdown of why the correct option is right.
- Distractor Analysis: Array of 4 items explaining why Option A, B, C, D are correct or incorrect.
- Key Formulas / Concepts: Array of core formulas tested.
- Examiner Tip: High-yield tip to avoid traps.

CRITICAL JSON RULES:
- Output valid JSON only without commentary.
- Ensure all double quotes inside strings are escaped with \\" and newlines with \\n.

OUTPUT SCHEMA TEMPLATE:
{
  "title": "${subject} MCQ Examination - ${topicOrChapter}",
  "subject": "${subject}",
  "classLevel": "${classLevel}",
  "difficulty": "${difficulty}",
  "totalMarks": ${totalMarks},
  "durationMinutes": ${durationMinutes},
  "generalInstructions": [
    "All questions are compulsory objective-type Multiple Choice Questions (MCQs).",
    "Each question has four options (A, B, C, D) with exactly one correct option.",
    "Select the option you believe is most accurate.",
    "There is no negative marking unless specified."
  ],
  "sections": [
    {
      "section": "Section A",
      "title": "Conceptual & Foundation MCQs",
      "instructions": "Select the correct option (A, B, C, or D) for each question.",
      "questions": [
        {
          "number": 1,
          "type": "mcq",
          "questionText": "Question text...",
          "marks": 1,
          "options": [
            { "key": "A", "text": "Option A" },
            { "key": "B", "text": "Option B" },
            { "key": "C", "text": "Option C" },
            { "key": "D", "text": "Option D" }
          ],
          "correctOption": "A",
          "detailedExplanation": "Textbook-quality explanation...",
          "distractorAnalysis": [
            { "optionKey": "A", "text": "Option A", "isCorrect": true, "whyWrongOrRight": "Correct because..." },
            { "optionKey": "B", "text": "Option B", "isCorrect": false, "whyWrongOrRight": "Incorrect because..." },
            { "optionKey": "C", "text": "Option C", "isCorrect": false, "whyWrongOrRight": "Incorrect because..." },
            { "optionKey": "D", "text": "Option D", "isCorrect": false, "whyWrongOrRight": "Incorrect because..." }
          ],
          "markingScheme": [
            { "stepDescription": "Correct option selection", "marks": 1 }
          ],
          "keyFormulasOrConcepts": ["Key principle"],
          "examinerTip": "Common trap to watch out for..."
        }
      ]
    }
  ]
}`;
}

/**
 * Executes the multi-agent generation pipeline to produce a complete CBSE exam paper.
 */
export async function generateCBSEExamPaper(config: ExamConfig): Promise<{ paper?: ExamPaper; error?: string }> {
  const prompt = buildExamPrompt(config);

  try {
    const aiRes = await fetchAI({
      model: "gemini-3.5-flash-lite",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 8192,
      responseMimeType: "application/json",
      timeoutMs: 55000,
    });

    if (aiRes.error) {
      return { error: aiRes.error };
    }

    const raw = (aiRes.content || "").trim();
    if (!raw) {
      return { error: "AI service returned an empty response. Please try again." };
    }

    // Parse JSON with multi-layered repair engine
    const parsed = safeParseJSON<any>(raw);

    if (!parsed || typeof parsed !== "object") {
      return { error: "Failed to parse question paper blueprint. Please try again." };
    }

    const sectionsArray = Array.isArray(parsed.sections) ? parsed.sections : [];
    if (sectionsArray.length === 0) {
      return { error: "AI generated an incomplete paper blueprint. Please click generate again." };
    }
    
    // Validate and enrich with unique IDs
    const sections = sectionsArray.map((sec: any) => ({
      section: (sec.section || "Section A") as SectionType,
      title: sec.title || sec.section || "Section",
      instructions: sec.instructions || "Answer all questions in this section.",
      questions: (Array.isArray(sec.questions) ? sec.questions : []).map((q: any, qIdx: number) => ({
        id: crypto.randomUUID(),
        number: q.number || qIdx + 1,
        section: (sec.section || "Section A") as SectionType,
        type: q.type || (q.options ? "mcq" : "vsa"),
        questionText: q.questionText || "Question",
        marks: Number(q.marks) || 1,
        options: Array.isArray(q.options) ? q.options : undefined,
        correctOption: q.correctOption || undefined,
        assertionText: q.assertionText || undefined,
        reasonText: q.reasonText || undefined,
        caseStudyScenario: q.caseStudyScenario || undefined,
        subParts: Array.isArray(q.subParts) ? q.subParts : undefined,
        markingScheme: Array.isArray(q.markingScheme) && q.markingScheme.length > 0 
          ? q.markingScheme 
          : [{ stepDescription: "Complete accurate answer", marks: Number(q.marks) || 1 }],
        detailedExplanation: q.detailedExplanation || "Refer to standard textbook principles.",
        distractorAnalysis: Array.isArray(q.distractorAnalysis) ? q.distractorAnalysis : undefined,
        keyFormulasOrConcepts: Array.isArray(q.keyFormulasOrConcepts) ? q.keyFormulasOrConcepts : [],
        examinerTip: q.examinerTip || undefined,
      } as ExamQuestion)),
    }));

    const actualTotalMarks = sections.reduce(
      (sum: number, sec: any) =>
        sum +
        sec.questions.reduce(
          (qSum: number, q: ExamQuestion) => qSum + (Number(q.marks) || 1),
          0
        ),
      0
    );

    const paper: ExamPaper = {
      id: crypto.randomUUID(),
      title: parsed.title || `${config.subject} MCQ Examination - ${config.topicOrChapter}`,
      subject: config.subject,
      classLevel: config.classLevel,
      difficulty: config.difficulty,
      totalMarks: actualTotalMarks > 0 ? actualTotalMarks : (Number(parsed.totalMarks) || config.totalMarks),
      durationMinutes: Number(parsed.durationMinutes) || config.durationMinutes,
      createdAt: new Date().toISOString(),
      generalInstructions: Array.isArray(parsed.generalInstructions) && parsed.generalInstructions.length > 0 
        ? parsed.generalInstructions 
        : [
            "All questions are compulsory objective-type Multiple Choice Questions (MCQs).",
            "Each question has four options (A, B, C, D) with exactly one correct option.",
            "Select the option you believe is most accurate."
          ],
      sections,
    };

    return { paper };
  } catch (err: any) {
    console.error("Failed generating CBSE exam paper:", err);
    return { error: err?.message || "Failed to synthesize exam paper. Please check connection and retry." };
  }
}

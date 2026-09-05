/**
 * examGenerator.ts
 * Multi-Agent CBSE Question Paper Generation Engine.
 * Combines Agent 1 (Paper Setter / Blueprint Architect) and Agent 2 (Senior Pedagogy & Solution Master).
 */

import { fetchAI } from "../../lib/ai-client";
import { ExamConfig, ExamPaper, ExamQuestion, SectionType } from "./types";

/**
 * Builds the comprehensive prompt for Agent 1 and Agent 2 to synthesize
 * an authentic CBSE Board examination paper with professional-grade explanations.
 */
function buildExamPrompt(config: ExamConfig): string {
  const { classLevel, subject, topicOrChapter, sourceNoteContent, difficulty, lengthType, totalMarks, durationMinutes } = config;

  let questionDistribution = "";
  if (lengthType === "diagnostic_20") {
    questionDistribution = `
- Total Marks: 20 Marks | Duration: 30 Minutes
- Section A: 4 Questions (1 mark each: 3 MCQs with 4 options A/B/C/D, 1 Assertion-Reason question) = 4 Marks
- Section B: 2 Questions (2 marks each VSA with step working) = 4 Marks
- Section C: 2 Questions (3 marks each SA) = 6 Marks
- Section D: 1 Question (4 marks Case-Based with 3 subparts or 1 Long Answer) = 6 Marks
Total = 20 Marks
`;
  } else if (lengthType === "mid_term_40") {
    questionDistribution = `
- Total Marks: 40 Marks | Duration: 60 Minutes
- Section A: 8 Questions (1 mark each: 6 MCQs with 4 options A/B/C/D, 2 Assertion-Reason questions) = 8 Marks
- Section B: 4 Questions (2 marks each VSA) = 8 Marks
- Section C: 4 Questions (3 marks each SA) = 12 Marks
- Section D: 1 Question (5 marks Long Answer with derivation or structured steps) = 5 Marks
- Section E: 1 Question (4 marks Case-Based with 3 subparts i, ii, iii) = 7 Marks (or adjusted to total 40)
Total = 40 Marks
`;
  } else {
    // 80 Marks Full Board Simulation
    questionDistribution = `
- Total Marks: 80 Marks | Duration: 180 Minutes (Full CBSE Pattern)
- Section A: 12 Questions (1 mark each: 10 MCQs with 4 options A/B/C/D, 2 Assertion-Reason questions) = 12 Marks
- Section B: 6 Questions (2 marks each VSA) = 12 Marks
- Section C: 7 Questions (3 marks each SA) = 21 Marks
- Section D: 3 Questions (5 marks each Long Answer) = 15 Marks
- Section E: 3 Questions (4 marks each Case-Based) = 12 Marks
(Total tailored to match comprehensive 80 marks board exam)
`;
  }

  return `You are acting as two master educational agents collaborating to create a state-of-the-art CBSE Question Paper:
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

STRICT PROFESSIONAL REQUIREMENTS FOR QUESTIONS & MCQS:
1. Every MCQ in Section A MUST have exactly 4 authentic, plausible options labeled A, B, C, and D. DO NOT create silly or obvious joke options. Distractors must represent common student mathematical or conceptual pitfalls.
2. For Assertion-Reason questions, use standard official CBSE options:
   - A: Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).
   - B: Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).
   - C: Assertion (A) is true but Reason (R) is false.
   - D: Assertion (A) is false but Reason (R) is true.
3. For Section B, C, D questions, provide realistic CBSE word problems, scientific derivations, biological diagrams explanations, or numerical calculations.
4. For Case-Based questions (Section E), provide a realistic scientific or real-world paragraph followed by 3 sub-questions.

STRICT REQUIREMENTS FOR PROFESSIONAL-GRADE EXPLANATIONS (Agent 2):
1. Detailed Explanation: Must NOT be just 1 sentence. Provide a comprehensive, textbook-quality breakdown showing foundational principles, formulas, and step-by-step logic.
2. Distractor Analysis: For Section A MCQs, provide an array "distractorAnalysis" explaining why the correct option is right AND why each of the other 3 options is incorrect (pointing out the misconception!).
3. Marking Scheme: An array of steps with fractional marks allocated (e.g. "Formula & Principle: 1 mark", "Substitution of values: 1 mark", "Calculations and SI Units: 1 mark").
4. Examiner Tip: A short tip on how to secure full marks or avoid common calculation traps.

OUTPUT FORMAT:
Output ONLY valid JSON matching this exact structure without markdown code fences if possible:
{
  "title": "${subject} Examination - ${topicOrChapter}",
  "subject": "${subject}",
  "classLevel": "${classLevel}",
  "difficulty": "${difficulty}",
  "totalMarks": ${totalMarks},
  "durationMinutes": ${durationMinutes},
  "generalInstructions": [
    "This question paper contains multiple sections. All questions are compulsory.",
    "Section A comprises objective type questions of 1 mark each.",
    "Section B comprises Very Short Answer (VSA) type questions carrying 2 marks each.",
    "Section C comprises Short Answer (SA) type questions carrying 3 marks each.",
    "Section D comprises Long Answer (LA) type questions carrying 5 marks each.",
    "Section E comprises Case-Based integrated units of assessment of 4 marks each.",
    "Use of calculators is strictly prohibited."
  ],
  "sections": [
    {
      "section": "Section A",
      "title": "Objective & Multiple Choice Questions",
      "instructions": "Select the single correct option for each question.",
      "questions": [
        {
          "number": 1,
          "type": "mcq",
          "questionText": "Question text here...",
          "marks": 1,
          "options": [
            { "key": "A", "text": "Option A" },
            { "key": "B", "text": "Option B" },
            { "key": "C", "text": "Option C" },
            { "key": "D", "text": "Option D" }
          ],
          "correctOption": "A",
          "detailedExplanation": "Complete textbook-grade explanation...",
          "distractorAnalysis": [
            { "optionKey": "A", "text": "Option A", "isCorrect": true, "whyWrongOrRight": "Correct because..." },
            { "optionKey": "B", "text": "Option B", "isCorrect": false, "whyWrongOrRight": "Incorrect because..." },
            { "optionKey": "C", "text": "Option C", "isCorrect": false, "whyWrongOrRight": "Incorrect because..." },
            { "optionKey": "D", "text": "Option D", "isCorrect": false, "whyWrongOrRight": "Incorrect because..." }
          ],
          "markingScheme": [
            { "stepDescription": "Correct option identification", "marks": 1 }
          ],
          "keyFormulasOrConcepts": ["Key formula or principle"],
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
      model: "gemini-3.1-flash-lite",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4096,
    });

    if (aiRes.error) {
      return { error: aiRes.error };
    }

    let raw = (aiRes.content || "").trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    // Parse JSON
    const parsed = JSON.parse(raw);
    
    // Validate and enrich with unique IDs
    const paper: ExamPaper = {
      id: crypto.randomUUID(),
      title: parsed.title || `${config.subject} Examination`,
      subject: config.subject,
      classLevel: config.classLevel,
      difficulty: config.difficulty,
      totalMarks: Number(parsed.totalMarks) || config.totalMarks,
      durationMinutes: Number(parsed.durationMinutes) || config.durationMinutes,
      createdAt: new Date().toISOString(),
      generalInstructions: Array.isArray(parsed.generalInstructions) ? parsed.generalInstructions : [
        "All questions are compulsory.",
        "Draw neat diagrams wherever necessary.",
        "Write step-by-step solutions with appropriate units."
      ],
      sections: (parsed.sections || []).map((sec: any) => ({
        section: (sec.section || "Section A") as SectionType,
        title: sec.title || sec.section || "Section",
        instructions: sec.instructions || "Answer all questions in this section.",
        questions: (sec.questions || []).map((q: any, qIdx: number) => ({
          id: crypto.randomUUID(),
          number: q.number || qIdx + 1,
          section: (sec.section || "Section A") as SectionType,
          type: q.type || "mcq",
          questionText: q.questionText || "Question",
          marks: Number(q.marks) || 1,
          options: q.options || undefined,
          correctOption: q.correctOption || undefined,
          assertionText: q.assertionText || undefined,
          reasonText: q.reasonText || undefined,
          caseStudyScenario: q.caseStudyScenario || undefined,
          subParts: q.subParts || undefined,
          markingScheme: Array.isArray(q.markingScheme) && q.markingScheme.length > 0 
            ? q.markingScheme 
            : [{ stepDescription: "Complete accurate answer", marks: q.marks || 1 }],
          detailedExplanation: q.detailedExplanation || "No explanation provided.",
          distractorAnalysis: Array.isArray(q.distractorAnalysis) ? q.distractorAnalysis : undefined,
          keyFormulasOrConcepts: Array.isArray(q.keyFormulasOrConcepts) ? q.keyFormulasOrConcepts : [],
          examinerTip: q.examinerTip || undefined,
        } as ExamQuestion)),
      })),
    };

    return { paper };
  } catch (err: any) {
    console.error("Failed generating CBSE exam paper:", err);
    return { error: err?.message || "Failed to synthesize exam paper. Please check connection and retry." };
  }
}

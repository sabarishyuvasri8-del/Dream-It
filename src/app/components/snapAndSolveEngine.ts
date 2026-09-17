/**
 * snapAndSolveEngine.ts
 * Engine for the Multimodal "Snap & Solve" Homework Assistant.
 * Uses Gemini 3.1 Flash Vision via fetchAI to transcribe and solve
 * handwritten and printed math, science, and homework problems with KaTeX formulas.
 */

import { fetchAI, ImageAttachment } from "../../lib/ai-client";

export type SolveMode = "math" | "diagram" | "general";

export interface SolveRequest {
  image: ImageAttachment;
  mode: SolveMode;
  userNote?: string;
  subjectName?: string;
}

export interface SolveResult {
  fullSolution: string;
  error?: string;
  isRateLimited?: boolean;
}

export async function solveHomeworkProblem(request: SolveRequest): Promise<SolveResult> {
  const { image, mode, userNote, subjectName } = request;

  let systemPrompt = "";
  if (mode === "math") {
    systemPrompt = `You are Dream It AI: Chief Mathematics & Physics Master Tutor.
A student has snapped an image of a handwritten or printed math/physics problem.
Your task is to provide an encouraging, textbook-quality, step-by-step tutorial.

FORMATTING REQUIREMENTS:
1. All mathematical symbols, variables, formulas, and expressions MUST be formatted in standard LaTeX:
   - Use $...$ for inline formulas (e.g. $f(x) = x^2 + 3x$).
   - Use $$...$$ for standalone display equations and steps.
2. Structure your response clearly using these Markdown headers:
   - ## 📝 Problem Identified: State the exact problem transcribed from the image.
   - ## 🔍 Given & Objective: List given values, units, and what we need to solve for.
   - ## 📐 Core Formula / Theorem: State the relevant equations.
   - ## ✍️ Step-by-Step Derivation: Numbered, clear mathematical steps with intermediate explanations.
   - ## 🎯 Final Answer: The final result boxed (e.g., $$\\mathbf{x = 4}$$).
   - ## ⚠️ Watch Out: 1 common student trap or misconception to avoid on exams.
3. Be friendly, encouraging, and pedagogically clear.`;
  } else if (mode === "diagram") {
    systemPrompt = `You are Dream It AI: Chief Science & Diagram Analyst.
A student has snapped an image of a scientific diagram, anatomical chart, chemical reaction scheme, or physics circuit.
Your task is to analyze and explain the diagram.

FORMATTING REQUIREMENTS:
1. Structure your response clearly using these Markdown headers:
   - ## 🔬 Diagram Identified: What system, cycle, or structure is pictured.
   - ## 🏷️ Key Labels & Components: Bullet points identifying every visible part and its function.
   - ## ⚙️ How It Works / Mechanism: Clear explanation of the process or workflow shown.
   - ## 💡 High-Yield Exam Takeaway: The most critical concept tested on this topic.
2. Use LaTeX $...$ for any chemical formulas, reaction arrows, or physics units.`;
  } else {
    systemPrompt = `You are Dream It AI: Personal Study Coach & Homework Assistant.
A student has snapped an image of a homework question, textbook passage, or assignment.
Your task is to provide a comprehensive, source-grounded answer.

FORMATTING REQUIREMENTS:
1. Structure your response clearly:
   - ## 📖 Question: Clean transcription of the question.
   - ## 💡 Detailed Solution: Complete, well-reasoned answer.
   - ## 🔑 Key Definitions: Any core terminology the student should memorize.
   - ## 🎯 Study Tip: A quick active-recall tip for remembering this concept.
2. Use markdown formatting with bold terms and bullet points.`;
  }

  let userPrompt = `Please inspect the attached photo and provide a complete solution.`;
  if (subjectName) {
    userPrompt += ` The subject is "${subjectName}".`;
  }
  if (userNote && userNote.trim()) {
    userPrompt += ` Additional student instruction: "${userNote.trim()}".`;
  }

  try {
    const res = await fetchAI({
      model: "gemini-3.1-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      image: {
        name: image.name || "homework_snap.jpg",
        mimeType: image.mimeType || "image/jpeg",
        base64Data: image.base64Data,
        dataUrl: image.dataUrl,
      },
      temperature: 0.2,
      max_tokens: 4096,
      timeoutMs: 45000,
    });

    if (res.error) {
      return {
        fullSolution: "",
        error: res.error,
        isRateLimited: res.isRateLimited,
      };
    }

    return {
      fullSolution: res.content || "",
    };
  } catch (err: any) {
    return {
      fullSolution: "",
      error: err?.message || "Failed to analyze image. Please try again.",
    };
  }
}

/**
 * flashcardAIGenerator.ts
 * AI Engine to synthesize 15–20 active-recall flashcards and executive chapter summaries
 * from textbook PDFs, lecture slides, and study notes.
 */

import { fetchAI } from '../../lib/ai-client';

export interface GeneratedCard {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  conceptCategory?: 'Definition' | 'Formula' | 'Theorem' | 'Comparison' | 'Exam Trap';
}

export interface ChapterSummary {
  title: string;
  overview: string;
  coreKeyTakeaways: string[];
  keyFormulasAndDefinitions: Array<{
    termOrFormula: string;
    description: string;
    siUnitOrContext?: string;
  }>;
  examPitfalls: string[];
}

export interface FlashcardGenerationResult {
  title: string;
  subjectSuggested: string;
  flashcards: GeneratedCard[];
  summary: ChapterSummary;
  totalCards: number;
}

/**
 * Builds the AI prompt for extracting 15–20 active-recall flashcards & chapter summary.
 */
function buildFlashcardPrompt(content: string, hintTitle?: string, subjectName?: string): string {
  // Truncate to reasonable context (up to ~18,000 characters for high density and speed)
  const trimmedContent = content.slice(0, 20000);

  return `You are a Senior Academic Pedagogy Director and Active-Recall Learning Specialist.
Analyze the following textbook chapter / study material and synthesize an elite 15–20 card active-recall flashcard deck and a high-yield Executive Chapter Summary.

SOURCE MATERIAL CONTEXT:
Hint Title: "${hintTitle || 'General Chapter Notes'}"
Target Subject: "${subjectName || 'General Studies'}"

\"\"\"
${trimmedContent}
\"\"\"

STRICT EDUCATIONAL REQUIREMENTS:
1. Generate between 15 and 20 high-yield active-recall flashcard items.
   - "front": An active recall question, formula prompt, or conceptual distinction (e.g. "What is the physical significance of Brewster's Law?", "State Ampere's Circuital Law formula and define variables", "Distinguish between Step-up vs Step-down transformers").
   - "back": Clear, comprehensive, textbook-accurate answer with essential keywords and formulas.
   - "difficulty": Initial rating ("easy" for definitions/facts, "medium" for derivations/standard formulas, "hard" for conceptual subtleties/complex calculations).
   - "conceptCategory": "Definition" | "Formula" | "Theorem" | "Comparison" | "Exam Trap".
2. Generate a structured Executive Chapter Summary:
   - "title": Clean chapter or topic title.
   - "overview": 2-sentence high-level summary of the chapter.
   - "coreKeyTakeaways": 4 to 6 concise bullet points of foundational concepts.
   - "keyFormulasAndDefinitions": Array of essential formulas/principles with variables and SI units.
   - "examPitfalls": 2 to 3 common student misconceptions or calculation traps to watch out for.

OUTPUT FORMAT:
Output ONLY valid JSON matching this exact structure without markdown code fences:
{
  "title": "Chapter or Topic Name",
  "subjectSuggested": "${subjectName || 'Physics'}",
  "summary": {
    "title": "Chapter or Topic Name",
    "overview": "Concise 2-sentence summary...",
    "coreKeyTakeaways": [
      "Key foundational concept 1",
      "Key foundational concept 2"
    ],
    "keyFormulasAndDefinitions": [
      {
        "termOrFormula": "Formula or Law Name",
        "description": "Explanation of formula...",
        "siUnitOrContext": "SI Unit or condition"
      }
    ],
    "examPitfalls": [
      "Common calculation trap or misconception"
    ]
  },
  "flashcards": [
    {
      "front": "Active recall question...",
      "back": "Accurate, high-yield answer...",
      "difficulty": "medium",
      "conceptCategory": "Formula"
    }
  ]
}`;
}

/**
 * Executes AI generation pipeline to produce flashcards and summary from text.
 */
export async function generateFlashcardsAndSummary(
  content: string,
  hintTitle?: string,
  subjectName?: string
): Promise<{ result?: FlashcardGenerationResult; error?: string }> {
  if (!content || content.trim().length < 50) {
    return { error: 'Document does not contain sufficient text to extract flashcards. Please upload a more detailed document.' };
  }

  const prompt = buildFlashcardPrompt(content, hintTitle, subjectName);

  try {
    const aiRes = await fetchAI({
      model: 'gemini-3.1-flash-lite',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 4500,
      timeoutMs: 40000,
    });

    if (aiRes.error) {
      return { error: aiRes.error };
    }

    let raw = (aiRes.content || '').trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    // Exact JSON boundary extraction
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      raw = raw.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(raw);

    if (!parsed.flashcards || !Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) {
      return { error: 'Failed to extract active recall cards from document. Please retry.' };
    }

    const flashcards: GeneratedCard[] = parsed.flashcards.map((c: any) => ({
      id: crypto.randomUUID(),
      front: String(c.front || 'Concept Prompt'),
      back: String(c.back || 'Concept Explanation'),
      difficulty: (['easy', 'medium', 'hard'].includes(c.difficulty) ? c.difficulty : 'medium') as 'easy' | 'medium' | 'hard',
      conceptCategory: c.conceptCategory || 'Definition',
    }));

    const summary: ChapterSummary = {
      title: parsed.summary?.title || parsed.title || hintTitle || 'Chapter Summary',
      overview: parsed.summary?.overview || 'Key chapter concepts and revision notes.',
      coreKeyTakeaways: Array.isArray(parsed.summary?.coreKeyTakeaways) ? parsed.summary.coreKeyTakeaways : [],
      keyFormulasAndDefinitions: Array.isArray(parsed.summary?.keyFormulasAndDefinitions) ? parsed.summary.keyFormulasAndDefinitions : [],
      examPitfalls: Array.isArray(parsed.summary?.examPitfalls) ? parsed.summary.examPitfalls : [],
    };

    const result: FlashcardGenerationResult = {
      title: parsed.title || hintTitle || 'Extracted Study Deck',
      subjectSuggested: parsed.subjectSuggested || subjectName || 'General',
      flashcards,
      summary,
      totalCards: flashcards.length,
    };

    return { result };
  } catch (err: any) {
    console.error('Flashcard AI generation error:', err);
    return { error: err?.message || 'Failed to synthesize flashcards. Please check connection and try again.' };
  }
}

/**
 * flashcardDistiller.ts
 * Intelligent Flashcard Distiller & Human-Readable Formatter for Dream-It.
 *
 * 1. cleanLatexToReadable: Converts messy LaTeX / KaTeX math codes into clean,
 *    human-readable text and Unicode symbols (e.g. \frac{0.693}{k} -> 0.693 / k,
 *    \text{N}_2\text{O}_5 -> N₂O₅, ^{14}\text{C} -> ¹⁴C, \lambda -> λ, t_{1/2} -> t½).
 *
 * 2. distillToFlashcard: Analyzes long, verbose solutions, notes, or chat explanations
 *    (e.g. 50-100 lines) and distills them into a tiny, high-yield active-recall flashcard
 *    with a clear concept title (front) and an 8-10 line punchy summary (back).
 */

import { fetchAI } from "./ai-client";

// Subscript and Superscript lookup maps
const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  "n": "ⁿ", "i": "ⁱ", "o": "°",
};

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  "a": "ₐ", "e": "ₑ", "o": "ₒ", "x": "ₓ",
};

function toUnicodeSuper(str: string): string {
  return str.split("").map((c) => SUPERSCRIPTS[c] || c).join("");
}

function toUnicodeSub(str: string): string {
  if (str === "1/2") return "½";
  if (str === "1/4") return "¼";
  if (str === "3/4") return "¾";
  return str.split("").map((c) => SUBSCRIPTS[c] || c).join("");
}

/**
 * Converts raw LaTeX / KaTeX syntax into natural, human-readable text.
 * No ugly \frac, \text, \lambda, $, or math codes left behind.
 */
export function cleanLatexToReadable(input: string): string {
  if (!input) return "";

  let text = input;

  // 1. Common fractions: \frac{a}{b} or \dfrac{a}{b} -> (a / b)
  text = text.replace(/\\(?:d?frac)\{([^}]+)\}\{([^}]+)\}/g, (_m, num, den) => {
    const cleanNum = cleanLatexToReadable(num).trim();
    const cleanDen = cleanLatexToReadable(den).trim();
    return `${cleanNum} / ${cleanDen}`;
  });

  // 2. Square roots: \sqrt[n]{x} -> ⁿ√(x), \sqrt{x} -> √(x)
  text = text.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, (_m, n, body) => `${toUnicodeSuper(n)}√(${cleanLatexToReadable(body)})`);
  text = text.replace(/\\sqrt\{([^}]+)\}/g, (_m, body) => `√(${cleanLatexToReadable(body)})`);

  // 3. Text formatting inside LaTeX: \text{...}, \mathrm{...}, \mathbf{...}, etc.
  text = text.replace(/\\(?:text|mathrm|mathbf|mathit|textbf|textrm)\{([^}]+)\}/g, "$1");

  // 4. Superscripts: ^{xyz} or ^x
  text = text.replace(/\^\{([^}]+)\}/g, (_m, exp) => toUnicodeSuper(exp));
  text = text.replace(/\^([0-9a-zA-Z+-])/g, (_m, exp) => toUnicodeSuper(exp));

  // 5. Subscripts: _{xyz} or _x
  text = text.replace(/_\{([^}]+)\}/g, (_m, sub) => toUnicodeSub(sub));
  text = text.replace(/_([0-9a-zA-Z+-])/g, (_m, sub) => toUnicodeSub(sub));

  // 6. Greek letters
  const GREEK: Record<string, string> = {
    "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\Gamma": "Γ",
    "\\delta": "δ", "\\Delta": "Δ", "\\epsilon": "ε", "\\varepsilon": "ε",
    "\\zeta": "ζ", "\\eta": "η", "\\theta": "θ", "\\Theta": "Θ",
    "\\iota": "ι", "\\kappa": "κ", "\\lambda": "λ", "\\Lambda": "Λ",
    "\\mu": "μ", "\\nu": "ν", "\\xi": "ξ", "\\Xi": "Ξ",
    "\\pi": "π", "\\Pi": "Π", "\\rho": "ρ", "\\sigma": "σ", "\\Sigma": "Σ",
    "\\tau": "τ", "\\upsilon": "υ", "\\phi": "φ", "\\Phi": "Φ",
    "\\chi": "χ", "\\psi": "ψ", "\\Psi": "Ψ", "\\omega": "ω", "\\Omega": "Ω",
  };
  for (const [tex, sym] of Object.entries(GREEK)) {
    text = text.replaceAll(tex, sym);
  }

  // 7. Math symbols and operators
  const SYMBOLS: Record<string, string> = {
    "\\pm": "±", "\\mp": "∓", "\\times": "×", "\\cdot": "·",
    "\\div": "÷", "\\ast": "*", "\\star": "★", "\\circ": "°",
    "\\approx": "≈", "\\sim": "∼", "\\cong": "≅", "\\equiv": "≡",
    "\\neq": "≠", "\\ne": "≠", "\\le": "≤", "\\leq": "≤",
    "\\ge": "≥", "\\geq": "≥", "\\ll": "≪", "\\gg": "≫",
    "\\infty": "∞", "\\propto": "∝", "\\partial": "∂", "\\nabla": "∇",
    "\\to": "→", "\\rightarrow": "→", "\\leftarrow": "←",
    "\\Rightarrow": "⇒", "\\Leftarrow": "⇐", "\\Leftrightarrow": "⇔",
    "\\forall": "∀", "\\exists": "∃", "\\in": "∈", "\\notin": "∉",
    "\\subset": "⊂", "\\subseteq": "⊆", "\\cup": "∪", "\\cap": "∩",
    "\\angle": "∠", "\\perp": "⊥", "\\parallel": "∥",
    "\\int": "∫", "\\sum": "∑", "\\prod": "∏",
    "\\%": "%", "\\_": "_", "\\{": "{", "\\}": "}",
    "\\&": "&", "\\#": "#", "\\$": "$",
  };
  for (const [tex, sym] of Object.entries(SYMBOLS)) {
    text = text.replaceAll(tex, sym);
  }

  // 8. Remove dollar signs used for math inline/block ($...$ or $$...$$)
  text = text.replace(/\$\$([^$]+)\$\$/g, "$1");
  text = text.replace(/\$([^$]+)\$/g, "$1");
  text = text.replaceAll("$", "");

  // 9. Remove leftover backslashes before common functions
  text = text.replace(/\\(sin|cos|tan|cot|sec|csc|log|ln|exp|lim|max|min|deg)\b/g, "$1");
  text = text.replace(/\\([a-zA-Z]+)/g, "$1");

  // 10. Clean up raw markdown headers inside card text
  text = text.replace(/^#+\s*(?:🔬|🔑|📌|💡|✅|⚡)?\s*/gm, "");
  text = text.replace(/\*\*(.*?)\*\*/g, "$1"); // Normalize bold if overly nested

  return text.trim();
}

/**
 * Fallback algorithmic distiller that runs instantly (0ms) without network.
 * Condenses long notes or solutions into a clean 6 to 10 line bullet flashcard.
 */
export function algorithmicDistill(rawFront: string, rawBack: string, subjectName?: string): { front: string; back: string } {
  const cleanFront = cleanLatexToReadable(rawFront).trim();
  const cleanBack = cleanLatexToReadable(rawBack).trim();

  // 1. Determine a smart, descriptive Front title
  let front = cleanFront;
  const isVague =
    !cleanFront ||
    /^(explain me that|solve this|help|question|problem|notes?|summary|what is this|untitled)/i.test(cleanFront) ||
    cleanFront.length < 5;

  if (isVague) {
    // Attempt to extract title from first line of rawBack
    const firstLine = cleanBack.split("\n").find((l) => l.trim().length > 5)?.trim() || "";
    const titleMatch = firstLine.match(/^(?:Topic|Concept|Diagram Identified|Problem|Chapter|Title)[:\s]*(.+)/i);
    if (titleMatch && titleMatch[1]) {
      front = titleMatch[1].slice(0, 70).trim();
    } else if (firstLine && firstLine.length < 75) {
      front = firstLine.replace(/^[-*•#\d.]+\s*/, "").trim();
    } else {
      front = `${subjectName ? subjectName + ": " : ""}Core Study Concept`;
    }
  }

  // 2. Break back content into logical, informative bullet points
  const rawLines = cleanBack
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 8 && !l.startsWith("http"));

  let selectedBullets: string[] = [];

  // Prefer lines that contain formulas, definitions, key numbers, or conclusions
  const priorityLines = rawLines.filter((l) =>
    /(?:formula|law|equation|calculate|value|half-life|result|constant|initial|final|step|therefore|=|≈|→)/i.test(l)
  );

  if (priorityLines.length >= 6) {
    selectedBullets = priorityLines.slice(0, 9);
  } else {
    selectedBullets = rawLines.slice(0, 9);
  }

  // If still fewer than 5 lines, split sentences
  if (selectedBullets.length < 5) {
    const sentences = cleanBack
      .replace(/([.!?])\s+/g, "$1\n")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 15);
    selectedBullets = sentences.slice(0, 8);
  }

  // Ensure 6 to 10 lines
  const finalBullets = selectedBullets.slice(0, 10).map((b) => {
    let clean = b.replace(/^[•\-*]\s*/, "");
    if (clean.length > 130) {
      clean = clean.slice(0, 127) + "...";
    }
    return `• ${clean}`;
  });

  const back = finalBullets.length > 0 ? finalBullets.join("\n") : `• ${cleanBack.slice(0, 300)}`;

  return {
    front: front.slice(0, 90),
    back,
  };
}

/**
 * Distills long text (from Snap & Solve, Notes, AI Chat, or manual paste)
 * into a concise, human-readable 8-10 line Flashcard using AI Orchestration,
 * with zero-latency algorithmic fallback.
 */
export async function distillToFlashcard(params: {
  front?: string;
  back: string;
  subjectName?: string;
}): Promise<{ front: string; back: string }> {
  const { front = "", back = "", subjectName = "" } = params;
  const rawBack = (back || "").trim();
  const rawFront = (front || "").trim();

  // If already tiny (< 180 chars and <= 4 lines) and front is not vague, just clean LaTeX
  const isVagueFront =
    !rawFront ||
    /^(explain me that|solve this|help|question|problem|notes?|summary|untitled)/i.test(rawFront);

  if (!isVagueFront && rawBack.length < 180 && rawBack.split("\n").length <= 4) {
    return {
      front: cleanLatexToReadable(rawFront),
      back: cleanLatexToReadable(rawBack),
    };
  }

  // Prepare fallback immediately
  const fallback = algorithmicDistill(rawFront, rawBack, subjectName);

  // Call Centralized AI Orchestrator to synthesize a high-yield 8-10 line flashcard
  try {
    const prompt = `You are an expert tutor creating a single, high-yield, tiny active-recall flashcard.
The student provided the following study material, problem solution, or notes:
---
TITLE / HINT: "${rawFront.slice(0, 150)}"
SUBJECT: "${subjectName || "General Study"}"
CONTENT:
${rawBack.slice(0, 3500)}
---

TASK:
1. "front": Formulate a crisp, precise Question or Concept Title (6 to 12 words).
   - If the student's hint is vague (e.g. "explain me that", "solve this"), extract the actual topic (e.g. "Chemical Kinetics: Radioactive Carbon Dating & Half-life").
2. "back": Condense the ENTIRE explanation into a TINY, PUNCHY flashcard back.
   - EXACTLY 6 to 10 bullet lines (each starting with "• ").
   - Highlight the core principle, formula, key values, and final takeaway.
   - CRITICAL REQUIREMENT: Output 100% human-readable plain text with clean Unicode symbols (e.g. N₂O₅, t½ = 0.693/k, λ, ¹⁴C, →, ±, ≈).
   - DO NOT USE ANY LATEX SYNTAX (no \\frac, no \\text, no \\lambda, no $ or $$).

Return ONLY valid JSON matching this schema:
{
  "front": "Topic or Recall Question",
  "back": "• Bullet 1\\n• Bullet 2\\n• Bullet 3\\n• Bullet 4\\n• Bullet 5\\n• Bullet 6\\n• Bullet 7\\n• Bullet 8"
}`;

    const aiRes = await fetchAI({
      task: "flashcards",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
      responseMimeType: "application/json",
      timeoutMs: 6500,
    });

    if (aiRes.content) {
      let parsed: any = null;
      try {
        parsed = JSON.parse(aiRes.content);
      } catch {
        // Match JSON block if wrapped
        const jsonMatch = aiRes.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {}
        }
      }

      if (parsed && parsed.front && parsed.back) {
        const cleanFront = cleanLatexToReadable(parsed.front).trim();
        const cleanBack = cleanLatexToReadable(parsed.back).trim();

        // Ensure bullet format
        const lines = cleanBack
          .split("\n")
          .map((l: string) => l.trim())
          .filter(Boolean)
          .map((l: string) => (l.startsWith("•") || l.startsWith("-") ? `• ${l.replace(/^[-•*]\s*/, "")}` : `• ${l}`));

        return {
          front: cleanFront,
          back: lines.slice(0, 10).join("\n"),
        };
      }
    }
  } catch (err: any) {
    console.warn("[flashcardDistiller] AI distillation error, using algorithmic fallback:", err?.message);
  }

  return fallback;
}

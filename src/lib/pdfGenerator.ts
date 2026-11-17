/**
 * pdfGenerator.ts
 * Publication-grade client-side A4 PDF compiler for Dream It AI Sandbox.
 *
 * Compiles structured Markdown (headings, rich inline formatting, lists, tables,
 * blockquotes, code blocks, and LaTeX math) into a real, selectable-text binary
 * A4 PDF Blob entirely inside the browser sandbox using jsPDF.
 */

import { cleanLatexToReadable } from "./flashcardDistiller";

export type PdfStyleTheme = "academic" | "minimal" | "executive";

export interface PdfDocumentSpec {
  title: string;
  subtitle?: string;
  subject?: string;
  filename?: string;
  content: string;
  author?: string;
  createdAt?: string;
  theme?: PdfStyleTheme;
}

export interface CompiledPdfResult {
  blob: Blob;
  blobUrl: string;
  pageCount: number;
  sizeBytes: number;
  filename: string;
}

interface ThemePalette {
  headerBg: [number, number, number] | null;
  headerText: [number, number, number];
  headerSub: [number, number, number];
  accent: [number, number, number];
  heading: [number, number, number];
  body: [number, number, number];
  muted: [number, number, number];
  tableHeaderBg: [number, number, number];
  tableHeaderText: [number, number, number];
  tableStripeBg: [number, number, number];
  border: [number, number, number];
  codeBg: [number, number, number];
  quoteBg: [number, number, number];
  bodyFont: "times" | "helvetica";
}

const PALETTES: Record<PdfStyleTheme, ThemePalette> = {
  academic: {
    headerBg: null,
    headerText: [17, 24, 39],
    headerSub: [75, 85, 99],
    accent: [30, 58, 138], // Deep scholarly navy
    heading: [17, 24, 39],
    body: [31, 41, 55],
    muted: [107, 114, 128],
    tableHeaderBg: [30, 41, 59],
    tableHeaderText: [255, 255, 255],
    tableStripeBg: [248, 250, 252],
    border: [209, 213, 219],
    codeBg: [243, 244, 246],
    quoteBg: [248, 250, 252],
    bodyFont: "times",
  },
  minimal: {
    headerBg: null,
    headerText: [15, 23, 42],
    headerSub: [100, 116, 139],
    accent: [15, 23, 42], // Crisp monochrome ink
    heading: [15, 23, 42],
    body: [51, 65, 85],
    muted: [148, 163, 184],
    tableHeaderBg: [15, 23, 42],
    tableHeaderText: [255, 255, 255],
    tableStripeBg: [248, 250, 252],
    border: [226, 232, 240],
    codeBg: [241, 245, 249],
    quoteBg: [248, 250, 252],
    bodyFont: "helvetica",
  },
  executive: {
    headerBg: [15, 23, 42], // Deep slate executive banner
    headerText: [255, 255, 255],
    headerSub: [203, 213, 225],
    accent: [79, 70, 229], // Indigo accent
    heading: [15, 23, 42],
    body: [30, 41, 59],
    muted: [100, 116, 139],
    tableHeaderBg: [30, 27, 75],
    tableHeaderText: [255, 255, 255],
    tableStripeBg: [245, 243, 255],
    border: [203, 213, 225],
    codeBg: [241, 245, 249],
    quoteBg: [238, 242, 255],
    bodyFont: "times",
  },
};

/**
 * Converts LaTeX, Unicode math symbols, smart punctuation, and emojis into
 * crisp WinAnsi-safe text so standard PDF Type 1 fonts never render garbled glyphs.
 */
export function toPdfSafeText(raw: string): string {
  if (!raw) return "";

  // First convert LaTeX expressions inside $...$ or $$...$$ to readable notation
  let text = raw
    .replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner) => cleanLatexToReadable(inner))
    .replace(/\$([^$\n]+?)\$/g, (_m, inner) => cleanLatexToReadable(inner));

  if (/\\[a-zA-Z]+/.test(text)) {
    text = cleanLatexToReadable(text);
  }

  // Replace common Unicode math / Greek / arrows / typography outside Latin-1
  const UNICODE_MAP: Record<string, string> = {
    "\u2018": "'",
    "\u2019": "'",
    "\u201C": '"',
    "\u201D": '"',
    "\u2013": "-",
    "\u2014": "--",
    "\u2026": "...",
    "\u2022": "-",
    "\u2192": "->",
    "\u2190": "<-",
    "\u2194": "<->",
    "\u21D2": "=>",
    "\u21D4": "<=>",
    "\u21CC": "<=>",
    "\u2264": "<=",
    "\u2265": ">=",
    "\u2260": "!=",
    "\u2248": "~=",
    "\u2261": "===",
    "\u221E": "infinity",
    "\u221A": "sqrt",
    "\u222B": "integral ",
    "\u2211": "sum ",
    "\u220F": "prod ",
    "\u2202": "d",
    "\u2207": "nabla",
    "\u221D": " proportional to ",
    "\u2208": " in ",
    "\u2209": " not in ",
    "\u2282": " subset ",
    "\u2286": " subseteq ",
    "\u222A": " U ",
    "\u2229": " intersect ",
    "\u2200": "for all ",
    "\u2203": "exists ",
    "\u2234": "therefore ",
    "\u2235": "because ",
    "\u2220": "angle ",
    "\u22A5": "perp ",
    "\u2225": "||",
    "\u2212": "-",
    "\u03B1": "alpha",
    "\u03B2": "beta",
    "\u03B3": "gamma",
    "\u0393": "Gamma",
    "\u03B4": "delta",
    "\u0394": "Delta",
    "\u03B5": "epsilon",
    "\u03B6": "zeta",
    "\u03B7": "eta",
    "\u03B8": "theta",
    "\u0398": "Theta",
    "\u03BB": "lambda",
    "\u039B": "Lambda",
    "\u03BC": "mu",
    "\u03BD": "nu",
    "\u03BE": "xi",
    "\u03C0": "pi",
    "\u03A0": "Pi",
    "\u03C1": "rho",
    "\u03C3": "sigma",
    "\u03A3": "Sigma",
    "\u03C4": "tau",
    "\u03C6": "phi",
    "\u03A6": "Phi",
    "\u03C7": "chi",
    "\u03C8": "psi",
    "\u03A8": "Psi",
    "\u03C9": "omega",
    "\u03A9": "Omega",
    // Superscripts not in Latin-1
    "\u2070": "^0",
    "\u2074": "^4",
    "\u2075": "^5",
    "\u2076": "^6",
    "\u2077": "^7",
    "\u2078": "^8",
    "\u2079": "^9",
    "\u207A": "^+",
    "\u207B": "^-",
    "\u207F": "^n",
    "\u2071": "^i",
    // Subscripts
    "\u2080": "0",
    "\u2081": "1",
    "\u2082": "2",
    "\u2083": "3",
    "\u2084": "4",
    "\u2085": "5",
    "\u2086": "6",
    "\u2087": "7",
    "\u2088": "8",
    "\u2089": "9",
    "\u208A": "+",
    "\u208B": "-",
    // Checkboxes & stars
    "\u2713": "[x]",
    "\u2714": "[x]",
    "\u2717": "[ ]",
    "\u2718": "[ ]",
    "\u2610": "[ ]",
    "\u2611": "[x]",
    "\u2605": "*",
    "\u2606": "*",
  };

  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (UNICODE_MAP[ch] !== undefined) {
      out += UNICODE_MAP[ch];
    } else {
      const code = ch.charCodeAt(0);
      // Keep standard printable ASCII + WinAnsi Latin-1 characters (like °, ±, ², ³, ·, ×, ÷, ½, ¼, ¾)
      if (code === 9 || code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
        out += ch;
      } else if (code >= 0xd800 && code <= 0xdfff) {
        // Skip UTF-16 surrogate pairs (emojis) cleanly
        continue;
      } else {
        // Fallback space for unsupported glyphs
        out += " ";
      }
    }
  }

  return out.replace(/[ \t]{2,}/g, " ");
}

/** Sanitize filename into a clean .pdf slug */
export function buildPdfFilename(title: string, customFilename?: string): string {
  const base = (customFilename || title || "dreamit-document")
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "dreamit-document"}.pdf`;
}

interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/** Parse inline Markdown (**bold**, *italic*, `code`, [link](url)) into styled runs */
function parseInlineRuns(line: string): InlineRun[] {
  // Flatten markdown links [label](url) -> label
  const normalized = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  const runs: InlineRun[] = [];
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    if (match.index > lastIdx) {
      runs.push({ text: toPdfSafeText(normalized.slice(lastIdx, match.index)) });
    }
    const token = match[0];
    if (token.startsWith("***") && token.endsWith("***")) {
      runs.push({ text: toPdfSafeText(token.slice(3, -3)), bold: true, italic: true });
    } else if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      runs.push({ text: toPdfSafeText(token.slice(2, -2)), bold: true });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      runs.push({ text: toPdfSafeText(token.slice(1, -1)), code: true });
    } else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      runs.push({ text: toPdfSafeText(token.slice(1, -1)), italic: true });
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < normalized.length) {
    runs.push({ text: toPdfSafeText(normalized.slice(lastIdx)) });
  }

  return runs.filter((r) => r.text.length > 0);
}

/** Format byte size into readable string */
export function formatPdfBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Compiles a Markdown document specification into a real A4 binary PDF Blob.
 */
export async function compileMarkdownToPdf(spec: PdfDocumentSpec): Promise<CompiledPdfResult> {
  const { jsPDF } = await import("jspdf");
  const theme = PALETTES[spec.theme || "academic"] || PALETTES.academic;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 20;
  const marginTop = 20;
  const marginBottom = 20;
  const contentWidth = pageWidth - marginX * 2;
  const maxY = pageHeight - marginBottom;

  const safeTitle = toPdfSafeText(spec.title || "Study Document").trim();
  const safeSubtitle = spec.subtitle ? toPdfSafeText(spec.subtitle).trim() : "";
  const safeSubject = spec.subject ? toPdfSafeText(spec.subject).trim() : "";
  const dateLabel = spec.createdAt || new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc.setProperties({
    title: safeTitle,
    subject: safeSubject || "Dream It Study Document",
    author: spec.author || "Dream It AI",
    creator: "Dream It PDF Sandbox",
  });

  let y = marginTop;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > maxY) {
      doc.addPage();
      y = marginTop;
    }
  };

  // ─── 1. Cover Header Section ───
  if (theme.headerBg) {
    // Executive banner header
    doc.setFont(theme.bodyFont, "bold");
    doc.setFontSize(20);
    const titleLines = doc.splitTextToSize(safeTitle, contentWidth - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const subLines = safeSubtitle ? doc.splitTextToSize(safeSubtitle, contentWidth - 10) : [];

    const bannerHeight = 18 + titleLines.length * 8 + (subLines.length > 0 ? subLines.length * 5 + 3 : 0) + 8;

    doc.setFillColor(...theme.headerBg);
    doc.rect(0, 0, pageWidth, bannerHeight, "F");

    // Top accent strip
    doc.setFillColor(...theme.accent);
    doc.rect(0, 0, pageWidth, 2.5, "F");

    let hy = 12;
    // Subject + Date metadata line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...theme.headerSub);
    const metaLine = [safeSubject ? safeSubject.toUpperCase() : "DREAM IT STUDIO", dateLabel.toUpperCase()].join("  |  ");
    doc.text(metaLine, marginX, hy);
    hy += 8;

    // Title
    doc.setFont(theme.bodyFont, "bold");
    doc.setFontSize(20);
    doc.setTextColor(...theme.headerText);
    for (const tl of titleLines) {
      doc.text(tl, marginX, hy);
      hy += 8;
    }

    // Subtitle
    if (subLines.length > 0) {
      hy += 1;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...theme.headerSub);
      for (const sl of subLines) {
        doc.text(sl, marginX, hy);
        hy += 5;
      }
    }

    y = bannerHeight + 10;
  } else {
    // Clean Academic / Minimal Editorial Header
    // Accent bar on top-left
    doc.setFillColor(...theme.accent);
    doc.rect(marginX, y - 5, 16, 1.4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...theme.accent);
    const metaTop = [safeSubject ? safeSubject.toUpperCase() : "DREAM IT AI", dateLabel].join("  •  ");
    doc.text(toPdfSafeText(metaTop), marginX, y + 1);
    y += 8;

    doc.setFont(theme.bodyFont, "bold");
    doc.setFontSize(21);
    doc.setTextColor(...theme.headerText);
    const titleLines = doc.splitTextToSize(safeTitle, contentWidth);
    for (const tl of titleLines) {
      doc.text(tl, marginX, y);
      y += 8.2;
    }

    if (safeSubtitle) {
      doc.setFont(theme.bodyFont, "italic");
      doc.setFontSize(11);
      doc.setTextColor(...theme.headerSub);
      const subLines = doc.splitTextToSize(safeSubtitle, contentWidth);
      for (const sl of subLines) {
        doc.text(sl, marginX, y);
        y += 5.2;
      }
    }

    y += 2;
    doc.setDrawColor(...theme.border);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;
  }

  // ─── Helper: Render Rich Wrapped Inline Runs ───
  const renderRichRuns = (
    runs: InlineRun[],
    startX: number,
    maxWidth: number,
    fontSize: number,
    lineHeight: number,
    baseColor: [number, number, number] = theme.body
  ) => {
    // Tokenize runs into words preserving style
    interface StyledWord {
      text: string;
      bold?: boolean;
      italic?: boolean;
      code?: boolean;
      width: number;
    }

    const words: StyledWord[] = [];
    for (const run of runs) {
      const parts = run.text.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (run.code) {
          doc.setFont("courier", "normal");
          doc.setFontSize(Math.max(8.5, fontSize - 1));
        } else {
          const style = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
          doc.setFont(theme.bodyFont, style);
          doc.setFontSize(fontSize);
        }
        const w = doc.getTextWidth(part) + (run.code ? 1.4 : 0);
        words.push({
          text: part,
          bold: run.bold,
          italic: run.italic,
          code: run.code,
          width: w,
        });
      }
    }

    // Group words into visual lines
    const lines: StyledWord[][] = [];
    let currentLine: StyledWord[] = [];
    let currentWidth = 0;

    for (const word of words) {
      const isSpace = /^\s+$/.test(word.text);
      if (currentLine.length === 0 && isSpace) continue;

      if (currentWidth + word.width > maxWidth && currentLine.length > 0 && !isSpace) {
        lines.push(currentLine);
        currentLine = [word];
        currentWidth = word.width;
      } else {
        currentLine.push(word);
        currentWidth += word.width;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    for (const lineWords of lines) {
      ensureSpace(lineHeight + 1);
      let cx = startX;
      for (const w of lineWords) {
        if (w.code) {
          doc.setFont("courier", "normal");
          doc.setFontSize(Math.max(8.5, fontSize - 1));
          const textW = doc.getTextWidth(w.text);
          doc.setFillColor(...theme.codeBg);
          doc.roundedRect(cx, y - fontSize * 0.32, textW + 1.4, fontSize * 0.44, 0.8, 0.8, "F");
          doc.setTextColor(...theme.accent);
          doc.text(w.text, cx + 0.7, y);
          cx += textW + 1.4;
        } else {
          const style = w.bold && w.italic ? "bolditalic" : w.bold ? "bold" : w.italic ? "italic" : "normal";
          doc.setFont(theme.bodyFont, style);
          doc.setFontSize(fontSize);
          doc.setTextColor(...baseColor);
          doc.text(w.text, cx, y);
          cx += w.width;
        }
      }
      y += lineHeight;
    }
  };

  // ─── 2. Parse & Layout Markdown Blocks ───
  const rawLines = (spec.content || "").replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      y += 2.6;
      i++;
      continue;
    }

    // Fenced code block ```
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith("```")) {
        codeLines.push(toPdfSafeText(rawLines[i]));
        i++;
      }
      i++; // consume closing ```

      doc.setFont("courier", "normal");
      doc.setFontSize(8.5);
      const wrappedCode: string[] = [];
      for (const cl of codeLines) {
        if (!cl.trim()) {
          wrappedCode.push("");
        } else {
          const split = doc.splitTextToSize(cl, contentWidth - 8);
          wrappedCode.push(...split);
        }
      }

      const codeLineH = 4.2;
      const paddingY = 4;
      const headerH = lang ? 5 : 0;

      // Render code block with multi-page splitting if very long
      let lineCursor = 0;
      while (lineCursor < wrappedCode.length) {
        const availableH = maxY - y - paddingY * 2 - (lineCursor === 0 ? headerH : 0);
        const maxLinesFit = Math.max(1, Math.floor(availableH / codeLineH));

        if (availableH < codeLineH * 2) {
          doc.addPage();
          y = marginTop;
          continue;
        }

        const slice = wrappedCode.slice(lineCursor, lineCursor + maxLinesFit);
        const boxH = slice.length * codeLineH + paddingY * 2 + (lineCursor === 0 ? headerH : 0);

        doc.setFillColor(...theme.codeBg);
        doc.setDrawColor(...theme.border);
        doc.setLineWidth(0.25);
        doc.roundedRect(marginX, y, contentWidth, boxH, 1.8, 1.8, "FD");

        let cy = y + paddingY + 2.5;
        if (lineCursor === 0 && lang) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(...theme.muted);
          doc.text(lang.toUpperCase(), marginX + 4, cy - 1);
          cy += headerH;
        }

        doc.setFont("courier", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        for (const sl of slice) {
          doc.text(sl, marginX + 4, cy);
          cy += codeLineH;
        }

        y += boxH + 3.5;
        lineCursor += slice.length;
      }
      continue;
    }

    // Horizontal rule --- or ***
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      ensureSpace(6);
      y += 2;
      doc.setDrawColor(...theme.border);
      doc.setLineWidth(0.35);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4;
      i++;
      continue;
    }

    // Headings (# to ####)
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = toPdfSafeText(headingMatch[2].replace(/\*\*|__/g, "").trim());
      const sizes = [0, 15.5, 13, 11.5, 10.5];
      const fontSize = sizes[level] || 11;
      const lineH = level === 1 ? 6.8 : level === 2 ? 6.0 : 5.4;

      // Prevent orphan heading at bottom of page
      ensureSpace(lineH + 14);
      y += level === 1 ? 5 : level === 2 ? 4 : 3;

      doc.setFont(theme.bodyFont, "bold");
      doc.setFontSize(fontSize);
      doc.setTextColor(...(level <= 2 ? theme.heading : theme.accent));

      const wrapped = doc.splitTextToSize(headingText, contentWidth);
      for (const wl of wrapped) {
        doc.text(wl, marginX, y);
        y += lineH;
      }

      if (level === 1) {
        doc.setDrawColor(...theme.border);
        doc.setLineWidth(0.3);
        doc.line(marginX, y - 2, pageWidth - marginX, y - 2);
        y += 2;
      } else {
        y += 1;
      }

      i++;
      continue;
    }

    // GFM Table detection (| col | col | followed by | --- | --- |)
    if (
      trimmed.startsWith("|") &&
      i + 1 < rawLines.length &&
      /^\|?[\s:-]+\|[\s|:-]+$/.test(rawLines[i + 1].trim())
    ) {
      const parseRow = (rowStr: string): string[] =>
        rowStr
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => toPdfSafeText(c.replace(/\*\*|__/g, "").replace(/`([^`]+)`/g, "$1").trim()));

      const headers = parseRow(trimmed);
      i += 2; // Skip header & separator
      const rows: string[][] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith("|")) {
        rows.push(parseRow(rawLines[i]));
        i++;
      }

      const colCount = Math.max(1, headers.length);
      const colWidth = contentWidth / colCount;
      const cellPadX = 2.5;
      const cellPadY = 2.5;
      const tableLineH = 4.5;

      const drawTableRow = (cells: string[], isHeader: boolean, rowIdx: number) => {
        doc.setFont("helvetica", isHeader ? "bold" : "normal");
        doc.setFontSize(isHeader ? 8.5 : 8.8);

        const wrappedCells = Array.from({ length: colCount }, (_, ci) =>
          doc.splitTextToSize(cells[ci] || "", Math.max(10, colWidth - cellPadX * 2))
        );
        const maxLines = Math.max(1, ...wrappedCells.map((wc) => wc.length));
        const rowH = maxLines * tableLineH + cellPadY * 2;

        if (y + rowH > maxY) {
          doc.addPage();
          y = marginTop;
          if (!isHeader) {
            // Re-render table header on new page
            drawTableRow(headers, true, -1);
          }
        }

        if (isHeader) {
          doc.setFillColor(...theme.tableHeaderBg);
          doc.rect(marginX, y, contentWidth, rowH, "F");
        } else if (rowIdx % 2 === 1) {
          doc.setFillColor(...theme.tableStripeBg);
          doc.rect(marginX, y, contentWidth, rowH, "F");
        }

        doc.setDrawColor(...theme.border);
        doc.setLineWidth(0.2);
        doc.rect(marginX, y, contentWidth, rowH, "S");

        doc.setFont("helvetica", isHeader ? "bold" : "normal");
        doc.setFontSize(isHeader ? 8.5 : 8.8);
        doc.setTextColor(...(isHeader ? theme.tableHeaderText : theme.body));

        for (let ci = 0; ci < colCount; ci++) {
          const cx = marginX + ci * colWidth;
          if (ci > 0) {
            doc.line(cx, y, cx, y + rowH);
          }
          const linesInCell = wrappedCells[ci];
          let cy = y + cellPadY + 3.2;
          for (const cl of linesInCell) {
            doc.text(cl, cx + cellPadX, cy);
            cy += tableLineH;
          }
        }

        y += rowH;
      };

      y += 2;
      drawTableRow(headers, true, -1);
      rows.forEach((r, idx) => drawTableRow(r, false, idx));
      y += 4.5;
      continue;
    }

    // Blockquote (> ...)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith(">")) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const quoteText = quoteLines.join(" ").trim();
      const runs = parseInlineRuns(quoteText);

      // Estimate height cleanly
      doc.setFont(theme.bodyFont, "italic");
      doc.setFontSize(10);
      const estLines = doc.splitTextToSize(toPdfSafeText(quoteText), contentWidth - 10);
      const boxH = Math.max(8, estLines.length * 5.2 + 5);
      ensureSpace(boxH + 3);

      doc.setFillColor(...theme.quoteBg);
      doc.rect(marginX, y - 1, contentWidth, boxH, "F");
      doc.setFillColor(...theme.accent);
      doc.rect(marginX, y - 1, 1.4, boxH, "F");

      const startY = y;
      y += 3.5;
      renderRichRuns(
        runs.map((r) => ({ ...r, italic: !r.code })),
        marginX + 5.5,
        contentWidth - 8,
        10,
        5.2,
        theme.muted
      );
      y = Math.max(y + 2, startY + boxH + 2.5);
      continue;
    }

    // Bullet List (- , * , + ) or Task List (- [ ] / - [x])
    const bulletMatch = /^(\s*)([-*+])\s+(.*)$/.exec(line);
    if (bulletMatch) {
      const indentSpaces = bulletMatch[1].length;
      const indentMm = Math.min(18, Math.floor(indentSpaces / 2) * 5);
      let itemText = bulletMatch[3];
      let marker = "-";

      if (itemText.startsWith("[x] ") || itemText.startsWith("[X] ")) {
        marker = "[x]";
        itemText = itemText.slice(4);
      } else if (itemText.startsWith("[ ] ")) {
        marker = "[ ]";
        itemText = itemText.slice(4);
      }

      const runs = parseInlineRuns(itemText);
      ensureSpace(6);

      const bulletX = marginX + 2 + indentMm;
      const textX = bulletX + (marker.length > 1 ? 6.5 : 4.2);

      if (marker === "-") {
        doc.setFillColor(...theme.accent);
        doc.circle(bulletX + 0.8, y - 1.1, 0.75, "F");
      } else {
        doc.setFont("courier", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...theme.accent);
        doc.text(marker, bulletX, y);
      }

      renderRichRuns(runs, textX, contentWidth - (textX - marginX), 10.5, 5.4, theme.body);
      y += 0.8;
      i++;
      continue;
    }

    // Numbered List (1. , 2. )
    const orderedMatch = /^(\s*)(\d+\.)\s+(.*)$/.exec(line);
    if (orderedMatch) {
      const indentSpaces = orderedMatch[1].length;
      const indentMm = Math.min(18, Math.floor(indentSpaces / 2) * 5);
      const numLabel = orderedMatch[2];
      const itemText = orderedMatch[3];
      const runs = parseInlineRuns(itemText);

      ensureSpace(6);
      const numX = marginX + 1.5 + indentMm;
      const textX = numX + Math.max(6, numLabel.length * 2.2 + 2);

      doc.setFont(theme.bodyFont, "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...theme.accent);
      doc.text(numLabel, numX, y);

      renderRichRuns(runs, textX, contentWidth - (textX - marginX), 10.5, 5.4, theme.body);
      y += 0.8;
      i++;
      continue;
    }

    // Standard Paragraph (collect contiguous lines until blank line or block starter)
    const paraLines: string[] = [trimmed];
    i++;
    while (
      i < rawLines.length &&
      rawLines[i].trim() &&
      !/^(#{1,4}\s|```|>|[-*+]\s|\d+\.\s|\||(-{3,}|\*{3,}|_{3,})$)/.test(rawLines[i].trim())
    ) {
      paraLines.push(rawLines[i].trim());
      i++;
    }

    const runs = parseInlineRuns(paraLines.join(" "));
    renderRichRuns(runs, marginX, contentWidth, 10.8, 5.6, theme.body);
    y += 1.6;
  }

  // ─── 3. Page Footers & Page Numbers ───
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 10;

    doc.setDrawColor(...theme.border);
    doc.setLineWidth(0.25);
    doc.line(marginX, footerY - 4, pageWidth - marginX, footerY - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...theme.muted);
    const leftFooter = `Dream It Studio  |  ${safeTitle.slice(0, 55)}`;
    doc.text(leftFooter, marginX, footerY);

    const rightFooter = `Page ${p} of ${pageCount}`;
    const rightW = doc.getTextWidth(rightFooter);
    doc.text(rightFooter, pageWidth - marginX - rightW, footerY);
  }

  // Output real binary PDF Blob
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  const filename = buildPdfFilename(spec.title, spec.filename);

  return {
    blob,
    blobUrl,
    pageCount,
    sizeBytes: blob.size,
    filename,
  };
}

/** Triggers an immediate direct browser file download of a compiled PDF */
export function downloadCompiledPdf(result: CompiledPdfResult): void {
  const link = document.createElement("a");
  link.href = result.blobUrl;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Opens a dedicated A4 print/PDF window using rendered DOM HTML (preserving full KaTeX math
 * and Source Serif 4 typography for heavy mathematical documents).
 */
export function openPrintRenderedElement(element: HTMLElement | null, title: string): void {
  if (!element) return;
  const printWin = window.open("", "_blank", "width=900,height=1000");
  if (!printWin) return;

  // Gather KaTeX and font stylesheets from current document
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((el) => `<link rel="stylesheet" href="${el.getAttribute("href")}" />`)
    .join("\n");

  printWin.document.open();
  printWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title.replace(/</g, "&lt;")}</title>
  ${styleLinks}
  <style>
    @page { size: A4; margin: 18mm 18mm 18mm 18mm; }
    body {
      background: #ffffff;
      color: #111827;
      font-family: "Source Serif 4", Georgia, Cambria, serif;
      font-size: 11.5pt;
      line-height: 1.72;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3, h4 { color: #111827 !important; page-break-after: avoid; }
    pre, blockquote, table { page-break-inside: avoid; }
    pre { background: #1e293b !important; color: #f8fafc !important; padding: 12px; border-radius: 8px; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6 !important; font-weight: 700; }
  </style>
</head>
<body>
  ${element.innerHTML}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`);
  printWin.document.close();
}

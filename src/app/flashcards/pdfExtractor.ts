/**
 * pdfExtractor.ts
 * High-performance client-side text extractor for PDFs, notes, and documents using pdfjs-dist.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Initialize PDF.js worker in browser context
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfWorker || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

/**
 * Extracts plain text from a PDF file or ArrayBuffer up to maxPages.
 */
export async function extractTextFromPDF(
  input: File | ArrayBuffer,
  maxPages: number = 30
): Promise<{ text: string; pageCount: number; title?: string }> {
  try {
    const arrayBuffer = input instanceof File ? await input.arrayBuffer() : input;
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const pagesToExtract = Math.min(totalPages, maxPages);

    let fullText = '';

    for (let pageNum = 1; pageNum <= pagesToExtract; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageStrings = textContent.items
        .map((item: any) => (item.str ? item.str : ''))
        .join(' ');

      fullText += `\n--- [Page ${pageNum}] ---\n` + pageStrings + '\n';
    }

    // Try extracting PDF metadata title if available
    let title: string | undefined;
    try {
      const meta = await pdfDoc.getMetadata();
      title = (meta?.info as any)?.Title || undefined;
    } catch {
      // Ignore metadata error
    }

    return {
      text: fullText.trim(),
      pageCount: totalPages,
      title,
    };
  } catch (err: any) {
    console.error('PDF text extraction error:', err);
    throw new Error(err?.message || 'Failed to read PDF document. The file may be password-protected or corrupted.');
  }
}

/**
 * Generic file reader handling PDF, TXT, MD, and CSV files.
 */
export async function extractTextFromFile(
  file: File
): Promise<{ text: string; pageCount?: number; title: string }> {
  const fileName = file.name;
  const isPDF = file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  if (isPDF) {
    const res = await extractTextFromPDF(file);
    return {
      text: res.text,
      pageCount: res.pageCount,
      title: res.title || fileName.replace(/\.pdf$/i, ''),
    };
  }

  // Text-based documents (markdown, text, csv)
  const rawText = await file.text();
  return {
    text: rawText.trim(),
    pageCount: 1,
    title: fileName.replace(/\.[^/.]+$/, ''),
  };
}

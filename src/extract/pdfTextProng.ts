import { readFile } from "node:fs/promises";
// The "legacy" build runs in plain Node (no DOM, no worker) and resolves glyph
// codes to Unicode via each font's ToUnicode CMap — essential for the sample PDF,
// whose CID/Type0 fonts are unreadable by naive byte extraction.
import {
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "../types.js";

export interface Extraction {
  items: TextItem[];
  pagesTotal: number;
  pagesRead: number;
}

/** Raised when the PDF cannot be read at all (missing, encrypted, unparsable). */
export class UnreadablePdfError extends Error {}

/**
 * Extract positioned text from every page of a PDF via its text layer.
 * Per-page failures are contained: a bad page is skipped, not fatal.
 */
export async function extractText(path: string): Promise<Extraction> {
  let data: Uint8Array;
  try {
    data = new Uint8Array(await readFile(path));
  } catch {
    throw new UnreadablePdfError(`Cannot read file: ${path}`);
  }

  let doc: PDFDocumentProxy;
  try {
    doc = await getDocument({
      data,
      isEvalSupported: false, // do not eval font programs from untrusted input
      useSystemFonts: false,
    }).promise;
  } catch (err) {
    // pdf.js does not export its exception classes, so match by name.
    if ((err as Error)?.name === "PasswordException") {
      throw new UnreadablePdfError("PDF is encrypted / password-protected.");
    }
    throw new UnreadablePdfError(
      `Not a readable PDF: ${(err as Error).message}`,
    );
  }

  const items: TextItem[] = [];
  const pagesTotal = doc.numPages;
  let pagesRead = 0;

  for (let p = 1; p <= pagesTotal; p++) {
    try {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      for (const raw of content.items) {
        // Text items expose `str` and a transform matrix [a,b,c,d,e,f]
        // where (e,f) is the run's position. Markup items lack `str`.
        if (!("str" in raw) || typeof raw.str !== "string") continue;
        const t = raw.transform as number[];
        items.push({
          str: raw.str,
          x: t[4],
          y: t[5],
          width: (raw as { width?: number }).width ?? 0,
          page: p,
        });
      }
      pagesRead++;
      page.cleanup();
    } catch {
      // Corrupt/truncated page: skip and keep going (best-effort).
    }
  }

  await doc.destroy();

  if (pagesRead === 0) {
    throw new UnreadablePdfError("No pages could be read from the PDF.");
  }
  return { items, pagesTotal, pagesRead };
}

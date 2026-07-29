import { aggregate, type Aggregate } from "./core/aggregate.js";
import { assignScales } from "./core/assignScale.js";
import { reconstructLines } from "./core/lines.js";
import { extractNumbers } from "./core/numberToken.js";
import { detectCurrency, detectScaleCues } from "./core/scaleCues.js";
import { extractText } from "./extract/pdfTextProng.js";
import type { CurrencyMark, NumberToken, Output, ScaleCue, TextItem } from "./types.js";

/** Pure core: positioned text items → largest raw & adjusted values. */
export function analyzeItems(items: TextItem[]): Aggregate {
  const lines = reconstructLines(items);
  const cues: ScaleCue[] = [];
  const currency: CurrencyMark[] = [];
  const tokens: NumberToken[] = [];

  for (const line of lines) {
    cues.push(...detectScaleCues(line));
    currency.push(...detectCurrency(line));
    tokens.push(...extractNumbers(line));
  }

  return aggregate(assignScales(tokens, cues, currency));
}

/** End-to-end: PDF path → full Output (lean text-layer prong). */
export async function analyzeFile(path: string): Promise<Output> {
  const { items, pagesTotal, pagesRead } = await extractText(path);
  const { raw, adjusted } = analyzeItems(items);
  return { file: path, pagesTotal, pagesRead, raw, adjusted };
}

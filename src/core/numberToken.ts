import type { Line, Multiplier, NumberToken } from "../types.js";

/** Letter-notation suffixes → multiplier. `MM` must be tried before `M`. */
const LETTER_SUFFIX: Record<string, Multiplier> = {
  K: 1_000,
  M: 1_000_000,
  MM: 1_000_000,
  MN: 1_000_000,
  B: 1_000_000_000,
  BN: 1_000_000_000,
  T: 1_000_000_000_000,
  TN: 1_000_000_000_000,
};

/** Spelled scale words → multiplier (used for both "3.15 million" and written-out). */
const SCALE_WORD: Record<string, Multiplier> = {
  hundred: 100,
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000,
  trillion: 1_000_000_000_000,
};

/** Small number words for written-out parsing. */
const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

// One regex for digit-based numbers, with named + indexed groups (`d` flag).
// Matches: optional currency, the numeral, optional %, optional letter suffix,
// optional spelled scale word.
// The letter suffix must be directly attached to the numeral (no space) and not
// be followed by another alphanumeric — this keeps part numbers like "F-35 T7A"
// or words like "3 Types" from being read as "35 trillion" / "3 trillion".
const DIGIT_RE =
  /(?<cur>[$€£¥]|USD|US\$|EUR|GBP|JPY)?\s?(?<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)(?:(?<suf>MM|MN|BN|TN|K|M|B|T)(?![A-Za-z0-9]))?(?<pct>%)?(?:\s(?<word>hundred|thousand|million|billion|trillion)s?\b)?/gid;

/** Extract every numeric literal on a line (digit-based and written-out). */
export function extractNumbers(line: Line): NumberToken[] {
  const numericLine = isNumericDominant(line.text);
  return [
    ...digitNumbers(line, numericLine),
    ...writtenNumbers(line, numericLine),
  ];
}

/**
 * A line is "numeric-dominant" when numbers make up at least a quarter of its
 * whitespace tokens — true for table rows (label + numeric columns), false for
 * prose sentences. Used to stop a table caption ("in millions") from bleeding
 * onto narrative numbers like "approximately 21,000 users".
 */
function isNumericDominant(text: string): boolean {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const numeric = tokens.filter((t) => /\d/.test(t)).length;
  return numeric / tokens.length >= 0.25;
}

function digitNumbers(line: Line, numericLine: boolean): NumberToken[] {
  const out: NumberToken[] = [];
  for (const m of line.text.matchAll(DIGIT_RE)) {
    const g = m.groups!;
    const numSpan = (m as unknown as { indices: { groups: Record<string, [number, number]> } })
      .indices.groups.num;
    const [numStart, numEnd] = numSpan;

    // Skip tokens that are part of a longer dotted string (e.g. version "1.2.3").
    const before = line.text[numStart - 1] ?? "";
    const after = line.text[numEnd] ?? "";
    if (/[\d.]/.test(before)) continue;
    if (after === "." && /\d/.test(line.text[numEnd + 1] ?? "")) continue;

    const rawValue = Number.parseFloat(g.num.replace(/,/g, ""));
    if (!Number.isFinite(rawValue)) continue;

    let inlineMultiplier: Multiplier | null = null;
    let letterSuffix = false;
    if (g.suf) {
      inlineMultiplier = LETTER_SUFFIX[g.suf.toUpperCase()] ?? null;
      letterSuffix = inlineMultiplier !== null;
    } else if (g.word) {
      inlineMultiplier = SCALE_WORD[g.word.toLowerCase()] ?? null;
    }

    out.push({
      rawValue,
      inlineMultiplier,
      currencyAttached: Boolean(g.cur),
      letterSuffix,
      numericLine,
      isPercent: Boolean(g.pct),
      page: line.page,
      x: line.xAt(numStart),
      y: line.y,
      snippet: snippet(line.text, numStart, m[0].length),
    });
  }
  return out;
}

// Match a run of number-words that includes at least one scale word,
// e.g. "three million", "twelve thousand", "one hundred twenty three thousand".
const WORD_NUMBER_TOKEN = "(?:hundred|thousand|million|billion|trillion|" +
  Object.keys(SMALL).join("|") + "|and|[-\\s])";
const WRITTEN_RE = new RegExp(
  `\\b((?:${Object.keys(SMALL).join("|")})${WORD_NUMBER_TOKEN}*` +
    `(?:hundred|thousand|million|billion|trillion))\\b`,
  "gi",
);

function writtenNumbers(line: Line, numericLine: boolean): NumberToken[] {
  const out: NumberToken[] = [];
  for (const m of line.text.matchAll(WRITTEN_RE)) {
    const phrase = m[0].toLowerCase();
    const parsed = parseWritten(phrase);
    if (!parsed) continue;
    const { value, scale } = parsed;
    out.push({
      rawValue: value / scale, // bare quantity; the scale drives `adjusted`
      inlineMultiplier: scale as Multiplier,
      currencyAttached: false,
      letterSuffix: false, // spelled words are unambiguous; no currency gate
      numericLine,
      isPercent: false,
      page: line.page,
      x: line.xAt(m.index ?? 0),
      y: line.y,
      snippet: snippet(line.text, m.index ?? 0, m[0].length),
    });
  }
  return out;
}

/** Convert a spelled number phrase to its value and its largest scale word. */
function parseWritten(phrase: string): { value: number; scale: number } | null {
  const words = phrase.split(/[-\s]+/).filter((w) => w && w !== "and");
  let result = 0;
  let current = 0;
  let maxScale = 1;

  for (const w of words) {
    if (w in SMALL) {
      current += SMALL[w];
    } else if (w === "hundred") {
      current = (current || 1) * 100;
    } else if (w in SCALE_WORD) {
      const scale = SCALE_WORD[w];
      current = (current || 1) * scale;
      result += current;
      current = 0;
      if (scale > maxScale) maxScale = scale;
    } else {
      return null;
    }
  }
  const value = result + current;
  if (value === 0) return null;
  return { value, scale: maxScale };
}

function snippet(text: string, start: number, length: number): string {
  const from = Math.max(0, start - 25);
  const to = Math.min(text.length, start + length + 15);
  return text.slice(from, to).replace(/\s+/g, " ").trim();
}

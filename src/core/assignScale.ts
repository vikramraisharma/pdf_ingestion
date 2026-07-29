import type {
  CurrencyMark,
  Multiplier,
  NumberToken,
  ScaleCue,
} from "../types.js";

const LINE_TOLERANCE = 4; // |Δy| within a line
const COLUMN_TOLERANCE = 40; // |Δx| to count as the same table column

/** A number with its resolved scale applied. */
export interface ScaledToken {
  rawValue: number;
  adjustedValue: number;
  multiplier: Multiplier;
  unit: string | null;
  isPercent: boolean;
  page: number;
  snippet: string;
}

/** Human-readable unit name for an inline multiplier. */
const UNIT_NAME: Record<number, string> = {
  100: "hundreds",
  1_000: "thousands",
  1_000_000: "millions",
  1_000_000_000: "billions",
  1_000_000_000_000: "trillions",
};

export function assignScales(
  tokens: NumberToken[],
  cues: ScaleCue[],
  currency: CurrencyMark[],
): ScaledToken[] {
  return tokens.map((t) => resolve(t, cues, currency));
}

function resolve(
  t: NumberToken,
  cues: ScaleCue[],
  currency: CurrencyMark[],
): ScaledToken {
  let multiplier: Multiplier = 1;
  let unit: string | null = null;

  if (t.inlineMultiplier !== null) {
    // A number carrying its own scale ignores caption cues (no stacking)...
    if (t.letterSuffix) {
      // ...but letter notation only counts with currency context.
      const gated = t.currencyAttached || hasCurrencyContext(t, currency);
      if (gated) {
        multiplier = t.inlineMultiplier;
        unit = UNIT_NAME[t.inlineMultiplier] ?? null;
      }
      // else: drop the ambiguous suffix, treat as the bare numeral (×1)
    } else {
      // spelled word / written-out number — unambiguous, ungated
      multiplier = t.inlineMultiplier;
      unit = UNIT_NAME[t.inlineMultiplier] ?? null;
    }
  } else if (t.numericLine) {
    // Bare number in a table row: apply the nearest governing caption cue.
    // Prose numbers (numericLine === false) are left unscaled so a table's
    // "in millions" caption cannot bleed onto narrative text.
    const cue = governingCue(t, cues);
    if (cue) {
      multiplier = cue.multiplier;
      unit = cue.unit;
    }
  }

  return {
    rawValue: t.rawValue,
    adjustedValue: t.rawValue * multiplier,
    multiplier,
    unit,
    isPercent: t.isPercent,
    page: t.page,
    snippet: t.snippet,
  };
}

/** Currency context = the number's page carries any currency signal. */
function hasCurrencyContext(t: NumberToken, currency: CurrencyMark[]): boolean {
  return currency.some((c) => c.page === t.page);
}

/**
 * Pick the caption cue governing a bare number, by precedence:
 *   1. same line   2. same column, above   3. nearest, above on the page.
 */
function governingCue(t: NumberToken, cues: ScaleCue[]): ScaleCue | null {
  const onPage = cues.filter((c) => c.page === t.page);

  const sameLine = onPage
    .filter((c) => Math.abs(c.y - t.y) <= LINE_TOLERANCE)
    .sort((a, b) => Math.abs(a.x - t.x) - Math.abs(b.x - t.x));
  if (sameLine.length) return sameLine[0];

  const above = onPage
    .filter((c) => c.y > t.y)
    .sort((a, b) => a.y - t.y - (b.y - t.y)); // nearest above first

  const inColumn = above.filter((c) => Math.abs(c.x - t.x) <= COLUMN_TOLERANCE);
  if (inColumn.length) return inColumn[0];

  return above[0] ?? null;
}

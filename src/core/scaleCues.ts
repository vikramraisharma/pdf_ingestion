import type { CurrencyMark, Line, Multiplier, ScaleCue } from "../types.js";

const UNIT_MULTIPLIER: Record<string, Multiplier> = {
  hundreds: 100,
  thousands: 1_000,
  millions: 1_000_000,
  billions: 1_000_000_000,
  trillions: 1_000_000_000_000,
};

// Natural-language guidance that scales nearby numbers, e.g.
// "(in millions)", "$ in thousands", "amounts in millions", "dollars in thousands".
const CUE_RE =
  /(?:\$\s*)?(?:amounts?\s+|dollars?\s+)?in\s+(hundreds|thousands|millions|billions|trillions)\b|\b(hundreds|thousands|millions|billions|trillions)\s+of\s+dollars\b/gi;

// Any currency signal — a symbol/code or a spelled keyword. Used only to gate
// ambiguous letter notation (e.g. "14M") to a dollar context.
const CURRENCY_RE =
  /[$€£¥]|\b(?:USD|US\$|EUR|GBP|JPY|dollars?|euros?|pounds?|yen)\b/gi;

export function detectScaleCues(line: Line): ScaleCue[] {
  const cues: ScaleCue[] = [];
  for (const m of line.text.matchAll(CUE_RE)) {
    const unit = (m[1] ?? m[2]).toLowerCase();
    cues.push({
      unit,
      multiplier: UNIT_MULTIPLIER[unit],
      page: line.page,
      x: line.xAt(m.index ?? 0),
      y: line.y,
    });
  }
  return cues;
}

export function detectCurrency(line: Line): CurrencyMark[] {
  const marks: CurrencyMark[] = [];
  for (const m of line.text.matchAll(CURRENCY_RE)) {
    marks.push({ page: line.page, x: line.xAt(m.index ?? 0), y: line.y });
  }
  return marks;
}

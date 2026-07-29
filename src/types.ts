/** Scale multipliers we recognize, in absolute terms. */
export type Multiplier = 1 | 100 | 1_000 | 1_000_000 | 1_000_000_000 | 1_000_000_000_000;

/** A positioned run of text extracted from a single PDF page. */
export interface TextItem {
  str: string;
  x: number; // page coordinate of the run's left edge (origin bottom-left)
  y: number; // page coordinate of the run's baseline
  width: number;
  page: number; // 1-indexed
}

/** A reconstructed line of text with per-character x lookup for positioning. */
export interface Line {
  page: number;
  y: number;
  text: string;
  /** Map a character offset within `text` back to an x coordinate. */
  xAt: (offset: number) => number;
}

/** A single numeric literal found in the text. */
export interface NumberToken {
  rawValue: number; // bare numeral as printed, no scale applied
  /** Multiplier intrinsic to the token (letter/word suffix), else null. */
  inlineMultiplier: Multiplier | null;
  /** For letter suffixes only: whether a currency symbol/code was attached. */
  currencyAttached: boolean;
  /** True for letter-notation tokens whose scale still needs a currency-context check. */
  letterSuffix: boolean;
  /** True when the number sits in a numeric-dominant (table) line, not prose. */
  numericLine: boolean;
  isPercent: boolean; // excluded from the max comparison when true
  page: number;
  x: number;
  y: number;
  snippet: string;
}

/** A natural-language scale cue ("in millions") governing nearby numbers. */
export interface ScaleCue {
  unit: string;
  multiplier: Multiplier;
  page: number;
  x: number;
  y: number;
}

/** A currency symbol/keyword occurrence, used to gate letter notation. */
export interface CurrencyMark {
  page: number;
  x: number;
  y: number;
}

/** One reported value (raw or adjusted) with provenance. */
export interface ValueResult {
  value: number;
  page: number;
  snippet: string;
  unit: string | null;
  multiplier: Multiplier;
  approximate: boolean; // value exceeds Number.MAX_SAFE_INTEGER
}

/** Full program output. */
export interface Output {
  file: string;
  pagesRead: number;
  pagesTotal: number;
  raw: ValueResult | null;
  adjusted: ValueResult | null;
}

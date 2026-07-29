import type { ValueResult } from "../types.js";
import type { ScaledToken } from "./assignScale.js";

export interface Aggregate {
  raw: ValueResult | null;
  adjusted: ValueResult | null;
}

/**
 * Reduce scaled tokens to the largest raw and largest adjusted value. The two
 * maxima are tracked independently — a mid-size number in a "millions" table can
 * win on adjusted while a big printed figure wins on raw. Percentages are excluded.
 */
export function aggregate(tokens: ScaledToken[]): Aggregate {
  let raw: ScaledToken | null = null;
  let adjusted: ScaledToken | null = null;

  for (const t of tokens) {
    if (t.isPercent) continue;
    if (raw === null || t.rawValue > raw.rawValue) raw = t;
    if (adjusted === null || t.adjustedValue > adjusted.adjustedValue) adjusted = t;
  }

  return {
    raw: raw && toRawResult(raw),
    adjusted: adjusted && toAdjustedResult(adjusted),
  };
}

function toRawResult(t: ScaledToken): ValueResult {
  return {
    value: t.rawValue,
    page: t.page,
    snippet: t.snippet,
    unit: null,
    multiplier: 1,
    approximate: t.rawValue > Number.MAX_SAFE_INTEGER,
  };
}

function toAdjustedResult(t: ScaledToken): ValueResult {
  return {
    value: t.adjustedValue,
    page: t.page,
    snippet: t.snippet,
    unit: t.unit,
    multiplier: t.multiplier,
    approximate: t.adjustedValue > Number.MAX_SAFE_INTEGER,
  };
}

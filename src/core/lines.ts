import type { Line, TextItem } from "../types.js";

const Y_TOLERANCE = 3; // page units; items within this share a line

/**
 * Group positioned text items into visual lines.
 *
 * pdf.js emits one item per styled run; a table cell like "28,239.2" arrives as
 * a single item, so joining items with a space never splits a real number. We
 * cluster by y (baseline), order left-to-right, and keep each run's x so a match
 * offset can be traced back to a page coordinate for scale/currency scoping.
 */
export function reconstructLines(items: TextItem[]): Line[] {
  const byPage = new Map<number, TextItem[]>();
  for (const it of items) {
    const bucket = byPage.get(it.page);
    if (bucket) bucket.push(it);
    else byPage.set(it.page, [it]);
  }

  const lines: Line[] = [];
  for (const [page, pageItems] of byPage) {
    const sorted = [...pageItems].sort((a, b) => b.y - a.y || a.x - b.x);
    let group: TextItem[] = [];
    let refY = Number.POSITIVE_INFINITY;

    const flush = () => {
      if (group.length) lines.push(buildLine(page, group));
      group = [];
    };

    for (const it of sorted) {
      if (group.length && Math.abs(it.y - refY) > Y_TOLERANCE) flush();
      if (!group.length) refY = it.y;
      group.push(it);
    }
    flush();
  }
  return lines;
}

function buildLine(page: number, items: TextItem[]): Line {
  const ordered = [...items].sort((a, b) => a.x - b.x);
  const spans: { start: number; end: number; x: number }[] = [];
  let text = "";

  for (const it of ordered) {
    if (text.length && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
    const start = text.length;
    text += it.str;
    spans.push({ start, end: text.length, x: it.x });
  }

  const y = ordered[0]?.y ?? 0;
  const xAt = (offset: number): number => {
    for (const s of spans) if (offset >= s.start && offset < s.end) return s.x;
    return spans[spans.length - 1]?.x ?? 0;
  };

  return { page, y, text, xAt };
}

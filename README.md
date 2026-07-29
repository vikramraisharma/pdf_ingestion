# Largest Number in a PDF

Given a PDF, this tool finds the greatest numerical value in it — reported two ways:

- **Raw** — the largest number exactly as printed.
- **Adjusted** — the largest number after applying the document's own natural-language
  scale guidance (e.g. a table captioned _"in millions"_ turns `3.15` into `3,150,000`).

The unit is not important — dollars, years, pounds, headcounts all count. It is a
self-contained CLI: no network or external API calls at runtime.

## Requirements

- Node.js 22+ (uses ES modules)

## Install & run

```bash
npm install

# Run directly on a PDF (no build step needed):
npm start -- "path/to/file.pdf"

# …or build once and run the compiled CLI:
npm run build
node dist/cli.js "path/to/file.pdf"
```

Example:

```bash
npm start -- "memory-bank/FY25_Air_Force_Working_Capital_Fund.pdf"
```

The tool prints a human-readable summary (largest raw + largest adjusted, each with the
page and surrounding text) followed by the same result as JSON.

## How it works

The lean, no-OCR path reads a PDF's **text layer** — no image processing required.

1. **Extract** — [pdf.js](https://github.com/mozilla/pdf.js) reads each page's positioned
   text. It resolves embedded fonts through their _ToUnicode_ maps, which matters here:
   the sample uses CID/Type0 fonts, so naive byte-scraping returns garbage while pdf.js
   returns real text.
2. **Reconstruct lines** — text runs are grouped into visual lines by position, so a
   figure like `28,239.2` (a single run) is never split.
3. **Find numbers** — each line is scanned for numeric literals (see formats below).
4. **Apply scale** — natural-language cues (`(in millions)`, `$ in thousands`, …) and
   inline suffixes scale a number. A table caption only scales numbers on **table rows**
   (numeric-dominant lines), so it never bleeds onto prose like "approximately 21,000
   users."
5. **Aggregate** — the largest **raw** value and the largest **adjusted** value are
   tracked independently (they are often different numbers).

### Deriving the largest raw number

The **raw** result is simply the largest numeric literal found in the text, with **no
scale applied**. Each candidate is normalized (currency symbol dropped, grouping commas
removed) and compared by magnitude; the maximum wins. Because these budget documents
print their figures already scaled (values like `20,253.8` sit under an "in millions"
caption), the largest _fully written-out_ literal is usually a threshold dollar amount or
a grand total rather than a table cell.

### Number formats

**Recognized** (US notation assumed — comma = thousands, period = decimal):

| Format | Example | Read as |
|--------|---------|---------|
| Integer / grouped | `1234`, `1,234,567` | 1234, 1234567 |
| Decimal | `3.15`, `.75` | 3.15, 0.75 |
| Currency-prefixed | `$1,234.56`, `€90` | value, symbol dropped |
| Percent | `12%` | recognized, **excluded** from the max |
| Inline scale word | `3.15 million` | raw `3.15`, adjusted `3,150,000` |
| Written-out | `three million` | raw `3`, adjusted `3,000,000` |
| Letter notation (currency-gated) | `$14M`, `€2.5K`, `12MM` | raw `14`, adjusted `14,000,000` |

**Not recognized (by design):** negatives / accounting parentheses (read as positive
magnitude — a negative is never the maximum), scientific notation (`1.5e6`), fractions,
European formatting (`1.234,56`), space-grouped thousands (`1 234 567`), dates, and
identifier-like numbers. Bare 4-digit years (`2025`) are read as ordinary numbers.

> **Letter notation** (`14M`) is only treated as a magnitude when a currency symbol or
> keyword is in context, since a bare `14M` is otherwise ambiguous (million vs. metres).

## Result for the sample document

`FY25_Air_Force_Working_Capital_Fund.pdf` (114 pages, ~0.9s):

- **Largest raw number:** `6,000,000` — from _"…$250,000 and $6,000,000…"_ (page 93).
- **Largest adjusted number:** `35,110,000,000` — the value `35,110` on page 13, scaled
  by its table caption _"(Dollars in Millions)"_.

## Assumptions & known limitations

- Reads the text layer only; scanned/image-only PDFs are out of scope for this path (an
  OCR fallback is designed but not built here).
- Scale-scoping is heuristic. A caption is matched to nearby table rows by position and
  is assumed to govern them; deeply nested or irregular tables may be mis-scoped.
- Assumes US number formatting; European decimal/grouping is not converted.
- Values whose adjusted magnitude exceeds JavaScript's safe integer range (~9.0e15) are
  reported as approximate (flagged in the output).
- Encrypted PDFs, and PDFs with no readable pages, exit with a clear error; a PDF with no
  numbers reports "no numeric values found."

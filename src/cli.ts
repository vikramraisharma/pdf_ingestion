#!/usr/bin/env node
import { analyzeFile } from "./analyze.js";
import { UnreadablePdfError } from "./extract/pdfTextProng.js";
import type { Output, ValueResult } from "./types.js";

async function main(): Promise<number> {
  const path = process.argv[2];
  if (!path || path === "-h" || path === "--help") {
    console.error("Usage: find-largest-number <path-to-pdf>");
    return path ? 0 : 2;
  }

  let result: Output;
  try {
    result = await analyzeFile(path);
  } catch (err) {
    if (err instanceof UnreadablePdfError) {
      console.error(`Error: ${err.message}`);
      return 1;
    }
    throw err;
  }

  printHuman(result);
  console.log("\n" + JSON.stringify(result, null, 2));
  return 0;
}

function printHuman(r: Output): void {
  console.log(`File: ${r.file}  (pages read ${r.pagesRead}/${r.pagesTotal})`);
  if (!r.raw || !r.adjusted) {
    console.log("No numeric values found.");
    return;
  }
  console.log(`Largest raw number:      ${describe(r.raw)}`);
  console.log(`Largest adjusted number: ${describe(r.adjusted)}`);
}

function describe(v: ValueResult): string {
  const value = format(v.value) + (v.approximate ? " (approx.)" : "");
  const scale =
    v.multiplier > 1 ? `  [${v.unit} ×${v.multiplier.toLocaleString("en-US")}]` : "";
  return `${value}${scale}\n    page ${v.page}: "${v.snippet}"`;
}

function format(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

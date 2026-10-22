#!/usr/bin/env node
// Computes WCAG 2.x contrast ratios for every colour pair used in both themes.
// Exits non-zero if any required pair fails. Run: npm run check:contrast
import { themes, pairs, REQUIRED_RATIO } from "../src/design/tokens.mjs";

function channel(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Bad hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const pad = (s, n) => String(s).padEnd(n);
let failures = 0;

for (const [name, palette] of Object.entries(themes)) {
  console.log(`\n${name.toUpperCase()} THEME`);
  console.log(`${pad("foreground", 15)}${pad("background", 13)}${pad("fg", 9)}${pad("bg", 9)}${pad("ratio", 8)}${pad("needs", 12)}result`);
  console.log("-".repeat(80));
  for (const { fg, bg, level, note } of pairs) {
    const ratio = contrastRatio(palette[fg], palette[bg]);
    const need = REQUIRED_RATIO[level];
    const decorative = level === "decorative";
    const pass = decorative || ratio >= need;
    if (!pass) failures++;
    const result = decorative ? "n/a (decorative)" : pass ? "PASS" : "FAIL";
    const needs = decorative ? "-" : `${need}:1 ${level}`;
    console.log(
      `${pad(fg, 15)}${pad(bg, 13)}${pad(palette[fg], 9)}${pad(palette[bg], 9)}${pad(ratio.toFixed(2), 8)}${pad(needs, 12)}${result}${note ? `  (${note})` : ""}`,
    );
  }
}

console.log(failures === 0 ? "\nAll required pairs pass WCAG AA." : `\n${failures} required pair(s) FAIL.`);
process.exit(failures === 0 ? 0 : 1);

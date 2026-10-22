#!/usr/bin/env node
// Full-page screenshots of /design at exact viewport widths, in both themes.
// Also reports console errors and horizontal overflow for each capture.
//
// Usage (dev server running):
//   node scripts/screenshots.mjs [path=/design] [outDir=docs/screenshots/phase0]
// Env: SCREENSHOT_BASE_URL (default http://localhost:3000), REDUCED_MOTION=1
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture, launch, loadAndMeasure, setViewport } from "./lib/cdp.mjs";

const route = process.argv[2] ?? "/design";
const outDir = process.argv[3] ?? "docs/screenshots/phase0";
const base = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const reduced = process.env.REDUCED_MOTION === "1";

mkdirSync(outDir, { recursive: true });
const cdp = await launch();
const report = [];
for (const theme of ["couple", "vendor"]) {
  for (const width of [390, 768, 1366]) {
    const before = cdp.errors.length;
    await setViewport(cdp, width, { reduced });
    const m = await loadAndMeasure(cdp, `${base}${route}?theme=${theme}`);
    const name = `design-${theme}-${width}${reduced ? "-reduced" : ""}.png`;
    writeFileSync(join(outDir, name), await capture(cdp, width, m.h));
    report.push({ file: name, overflowX: m.sw > m.cw ? `YES (${m.sw}px > ${m.cw}px)` : "no", consoleErrors: cdp.errors.length - before });
  }
}
console.table(report);
if (cdp.errors.length) console.log("Console errors:\n" + [...new Set(cdp.errors)].join("\n"));
await cdp.close();

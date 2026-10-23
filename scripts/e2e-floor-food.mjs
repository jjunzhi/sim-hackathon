#!/usr/bin/env node
// Food pictures and the floor plan, on fresh emulators with the demonstration
// venues loaded: every menu shows a drawn picture of how it's served, and the
// render step draws a floor plan from the plan's guests, room and chosen
// items. Saves screenshots.
//
// Usage: npm run emulators (fresh), npm run sample-venues -- load --emulator, npm run dev, then
//   node scripts/e2e-floor-food.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const outDir = process.argv[2] ?? "docs/screenshots/floor-food";
const base = "http://localhost:3000";
mkdirSync(outDir, { recursive: true });

const cdp = await launch({ port: 9398 });
const u = ui(cdp);
const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });

async function shot(name, widths = [1366, 390], scrollTo = null) {
  for (const width of widths) {
    await setViewport(cdp, width);
    await sleep(1400);
    if (scrollTo) await cdp.evaluate(`document.querySelector(${JSON.stringify(scrollTo)})?.scrollIntoView({ block: "start" })`);
    await sleep(600);
    const m = JSON.parse(await cdp.evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})"));
    writeFileSync(join(outDir, `${name}-${width}.png`), await capture(cdp, width, Math.max(m.h, 900)));
    if (m.sw > m.cw) results.push({ check: `${name}-${width}: no sideways scroll`, expected: m.cw, actual: m.sw, result: "FAIL" });
  }
  await setViewport(cdp, 1366);
  await sleep(300);
}

await setViewport(cdp, 1366);

// 1. Food pictures in the Style step.
await u.goto(`${base}/studio/grand-orchard?step=style`);
await u.waitForText("Chinese banquet menu", 30_000);
await cdp.evaluate("document.querySelectorAll('img').forEach((i) => (i.loading = 'eager'))");
await sleep(3000);
const food = JSON.parse(
  await cdp.evaluate(`JSON.stringify([...document.querySelectorAll('label')].filter(l => /menu|buffet|dinner|grill|thali|kuih|canap/i.test(l.textContent) && l.querySelector('img') === null).map(l => { let el = l; while (el && !el.querySelector('img')) el = el.parentElement; const img = el?.querySelector('img'); return { name: l.textContent.trim().slice(0, 40), ok: !!img && img.complete && img.naturalWidth > 0 }; }))`),
);

check("food: menus listed", food.length >= 3, true);
check("food: every menu has a picture", food.every((f) => f.ok), true);
await cdp.evaluate("[...document.querySelectorAll('label')].find(l => l.textContent.includes('Chinese banquet menu'))?.scrollIntoView({ block: 'center' })");
await sleep(800);
await shot("food-pictures", [1366, 390]);

// 2. Choose a stage piece and a buffet; the floor plan follows.
const pick = (txt) => cdp.evaluate(`(() => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim().startsWith(${JSON.stringify(txt)})); const box = l && document.getElementById(l.htmlFor); (box ?? l)?.click(); return !!l; })()`);
check("pick: pelamin", await pick("Pelamin dais"), true);
check("pick: buffet", await pick("International buffet"), true);
await sleep(800);
await cdp.evaluate("[...document.querySelectorAll('button')].find(b => /^Next: /.test(b.textContent.trim()))?.click()");
await u.waitForText("Floor plan", 20_000);
const fp = JSON.parse(
  await cdp.evaluate(`JSON.stringify((() => { const svg = [...document.querySelectorAll('svg[role=img]')].find(s => s.querySelector('title')?.textContent === 'Floor plan'); const t = svg?.textContent ?? ''; return { found: !!svg, tables: svg ? svg.querySelectorAll('g > circle[fill="#ffffff"]').length : 0, pelamin: t.includes('Pelamin dais'), buffet: t.includes('Buffet'), dance: t.includes('Dance floor'), summary: document.body.innerText.match(/\\d+ tables of \\d+ for \\d+ guests/)?.[0] ?? '' }; })())`),
);
check("floor plan: shown in the render step", fp.found, true);
check("floor plan: 53 tables for 525 guests", fp.tables, 53);
check("floor plan: summary line", fp.summary, "53 tables of 10 for 525 guests");
check("floor plan: chosen pelamin on the stage", fp.pelamin, true);
check("floor plan: buffet line drawn", fp.buffet, true);
check("floor plan: dance floor", fp.dance, true);
check("floor plan: says it's not to scale", (await u.text()).includes("A suggested layout, not to scale."), true);
check("floor plan: download button", await cdp.evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Download floor plan')"), true);
await shot("floor-plan", [1366, 390], "svg[role=img]");

console.table(results);
const errors = [...new Set(cdp.errors)];
if (errors.length) console.log("Console errors:\n" + errors.join("\n"));
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || errors.length ? 1 : 0);

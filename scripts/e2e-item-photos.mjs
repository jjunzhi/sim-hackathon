#!/usr/bin/env node
// Item photos and the save-first itinerary card, on emulators with the
// demonstration venues loaded: every menu and decor item in the Studio shows
// its approved photo, and an unsaved plan's Share step points to the itinerary.
//
// Usage: npm run emulators (fresh), npm run sample-venues -- load --emulator, npm run dev, then
//   node scripts/e2e-item-photos.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const outDir = process.argv[2] ?? "docs/screenshots/item-photos";
const base = process.env.E2E_BASE ?? "http://localhost:3000";
mkdirSync(outDir, { recursive: true });
const cdp = await launch({ port: 9399 });
const u = ui(cdp);
const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });

async function shot(name, widths = [1366, 390]) {
  for (const width of widths) {
    await setViewport(cdp, width);
    await sleep(2500);
    const m = JSON.parse(await cdp.evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})"));
    writeFileSync(join(outDir, `${name}-${width}.png`), await capture(cdp, width, Math.min(Math.max(m.h, 900), 4000)));
    if (m.sw > m.cw) results.push({ check: `${name}-${width}: no sideways scroll`, expected: m.cw, actual: m.sw, result: "FAIL" });
  }
  await setViewport(cdp, 1366);
}

// Item photos load in the Style step, at two venues (one with its own menus, one with decorators too).
for (const venue of ["chinatown-dining", "garden-pavilion"]) {
  await setViewport(cdp, 1366);
  await u.goto(`${base}/studio/${venue}?step=style`);
  await u.waitForText("The venue's own decor", 20_000);
  // Bring every picture into view so lazy images load, then check each one.
  for (let y = 0; y < 12000; y += 700) {
    await cdp.evaluate(`scrollTo(0, ${y})`);
    await sleep(250);
  }
  await u.waitFor("[...document.querySelectorAll('main fieldset li img')].every(i => i.complete && i.naturalWidth > 0)", { timeout: 30_000, what: "item images loaded" });
  const stats = JSON.parse(await cdp.evaluate("JSON.stringify((() => { const imgs = [...document.querySelectorAll('main fieldset li img')]; return { total: imgs.length, loaded: imgs.filter(i => i.naturalWidth > 0).length, photos: imgs.filter(i => i.naturalWidth / i.naturalHeight === 4 / 3 && !i.currentSrc.includes('.svg')).length, wide: imgs.filter(i => i.getBoundingClientRect().width >= 250).length }; })())"));
  check(`${venue}: every item picture loads`, stats.loaded === stats.total && stats.total > 0, true);
  check(`${venue}: items show photos, not drawings`, stats.photos, stats.total);
  check(`${venue}: photos shown large (at least 250px wide)`, stats.wide, stats.total);
  await cdp.evaluate("scrollTo(0, 0)");
  await shot(`style-${venue}`);
}

// Unsaved plan: the Share step explains the itinerary and offers to save.
await u.goto(`${base}/studio/chinatown-dining?step=share`);
await u.waitForText("Guest itinerary", 20_000);
check("share (unsaved): itinerary card", await cdp.evaluate("document.body.innerText.includes('Save your plan to create a guest itinerary')"), true);
check("share (unsaved): save button in the card", await cdp.evaluate("!!document.querySelector('section[aria-labelledby=itinerary-save-h] button')"), true);
await shot("share-unsaved");

console.table(results);
const errors = [...new Set(cdp.errors)];
if (errors.length) console.log("Console errors:\n" + errors.join("\n"));
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || errors.length ? 1 : 0);

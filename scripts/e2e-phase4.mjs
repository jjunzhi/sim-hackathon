#!/usr/bin/env node
// Phase 4 walkthrough on fresh emulators with SAMPLE seed data:
// landing -> catalog filters -> venue -> Studio (capacity, tiers, items from
// the venue and a decorator) -> estimate checked by hand -> sign up mid-way
// (plan survives) -> render + save -> refresh persists -> My plans -> Guests
// -> print view checked as A4 with a white background. Saves screenshots.
//
// Usage: npm run emulators (fresh), npm run seed, npm run dev, then
//   node scripts/e2e-phase4.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const outDir = process.argv[2] ?? "docs/screenshots/phase4";
const base = "http://localhost:3000";
const { couple } = JSON.parse(readFileSync("scripts/emulator-test-accounts.json", "utf8"));
mkdirSync(outDir, { recursive: true });

const cdp = await launch({ port: 9339 });
const u = ui(cdp);
const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });
const has = async (t) => (await u.text()).includes(t);

async function shot(name, widths = [1366, 390]) {
  for (const width of widths) {
    await cdp.evaluate("[...document.querySelectorAll('button[aria-label=Dismiss]')].forEach(b => b.click())");
    await setViewport(cdp, width);
    await sleep(1600);
    const m = JSON.parse(await cdp.evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})"));
    writeFileSync(join(outDir, `${name}-${width}.png`), await capture(cdp, width, m.h));
    if (m.sw > m.cw) results.push({ check: `${name}-${width}: no sideways scroll`, expected: m.cw, actual: m.sw, result: "FAIL" });
  }
  await setViewport(cdp, 1366);
  await sleep(300);
}

// Final value of an estimate row inside one vendor's estimate.
const amount = (section, labelStart) =>
  cdp.evaluate(`(() => {
    const s = document.querySelector(${JSON.stringify(`section[aria-label="${section}"]`)});
    const dt = s && [...s.querySelectorAll('dt')].find(d => d.textContent.trim().startsWith(${JSON.stringify(labelStart)}));
    return dt?.closest('div')?.querySelector('dd .sr-only')?.textContent ?? null;
  })()`);
const sectionTotal = (section) => cdp.evaluate(`document.querySelector(${JSON.stringify(`section[aria-label="${section}"]`)})?.querySelector('[aria-live]')?.textContent ?? null`);
const combined = () => cdp.evaluate(`[...document.querySelectorAll('section[aria-label="Total across vendors"] .sr-only')].map(e => e.textContent)`);

await setViewport(cdp, 1366);

// 1. Landing and catalog (no account).
await u.goto(`${base}/`);
check("landing: headline", await has("See your venue decorated, with honest prices."), true);
await shot("landing");
await u.clickLink("Find a venue");
await u.waitForText("3 venues", 20_000);
check("catalog: 3 SAMPLE venues", await has("3 venues"), true);
await shot("catalog");
await u.fill("Number of guests", "150");
await sleep(400);
check("filter 150 guests: a room must fit", await has("2 venues"), true);
await u.clickLabel("Lift access");
await u.clickLabel("Heritage");
await sleep(400);
check("filter: empty state", await has("No venues match all of these"), true);
await u.clickButton("Clear");
await sleep(300);
check("filter: cleared", await has("3 venues"), true);
// Mobile: filters in a bottom sheet.
await setViewport(cdp, 390);
await sleep(600);
await u.clickButton("Filters");
await u.waitForText("Show 3 venues");
await shot("catalog-filters-sheet", [390]);
await cdp.evaluate("document.querySelector('[role=dialog] button[aria-label=Close]').click()");
await u.waitFor("!document.querySelector('[role=dialog]')");
await setViewport(cdp, 1366);

// 2. Venue page.
await u.goto(`${base}/venues/sample-garden-pavilion`);
await u.waitForText("Rooms", 15_000);
check("venue: both rooms listed", (await has("SAMPLE Glasshouse Ballroom")) && (await has("SAMPLE Orchid Terrace")), true);
check("venue: decorator who works here", await has("SAMPLE Petal & Lantern Studio"), true);
await shot("venue");

// 3. Studio, signed out.
await u.clickLink("Plan here");
await u.waitForText("Plan your day", 20_000);
check("studio: default 165 guests = 17 tables", await has("165 guests = 17 tables of 10"), true);
await u.setSlider("Guests", 325);
await sleep(500);
check("studio: over-capacity warning", await has("Over this room's maximum of 250 guests"), true);
await u.setSlider("Guests", 185);
await sleep(500);
check("studio: within capacity", await has("Within capacity"), true);
check("studio: 185 guests = 19 tables", await has("185 guests = 19 tables of 10"), true);
await shot("studio-venue");

await u.clickButton("Next: Style");
await u.waitForText("The venue's own decor", 15_000);
await u.clickLabel("SAMPLE Floral arch");
await u.clickLabel("SAMPLE Table centrepiece");
await u.clickLabel("SAMPLE Chair sash");
await u.clickLabel("SAMPLE Lantern set");
await shot("studio-style");

// A signed-out plan lives only in this page, so move on with the stepper (no reloads).
await u.clickButton("Next: Render");
await u.waitForText("Create a free account");
await u.clickButton("Next: Estimate");
await u.waitFor("document.querySelector('section[aria-label=\"Total across vendors\"]')", { timeout: 15_000 });
await sleep(1500);
const VENUE = "SAMPLE Garden Pavilion Co (venue)";
const DECO = "SAMPLE Petal & Lantern Studio";
check("estimate: venue Peak rental", await amount(VENUE, "Room rental"), "$12,000.00");
check("estimate: venue minimum spend shortfall", await amount(VENUE, "Minimum spend shortfall"), "$29,481.00");
check("estimate: venue total (example B)", await sectionTotal(VENUE), "Estimated total $53,955.60");
check("estimate: decorator 19 tables x $45", await amount(DECO, "SAMPLE Lantern set"), "$855.00");
check("estimate: decorator has no GST line", await amount(DECO, "GST"), null);
check("estimate: decorator total", await sectionTotal(DECO), "Estimated total $855.00");
const comb = await combined();
check("estimate: combined total", comb[0], "$54,810.60");
check("estimate: combined per guest", comb[1], "$296.27");
await shot("studio-estimate");

// 4. Save mid-way: sign up, and the plan survives.
await u.clickButton("Save your plan");
await u.waitForText("Create your account", 15_000);
check("sign-up: couple preselected", await cdp.evaluate("document.querySelector('input[name=role][value=couple]')?.checked"), true);
await u.clickLabel("I agree to how my information is used");
await u.fill("Email", couple.email);
await u.fill("Password", couple.password);
await u.clickButton("Create account");
await u.waitFor("location.search.includes('plan=')", { timeout: 30_000, what: "plan saved after sign-up" });
await u.waitForText("Saved", 15_000);
const planUrl = await cdp.evaluate("location.href");
const planId = new URL(planUrl).searchParams.get("plan");
check("after sign-up: plan saved", !!planId, true);
await sleep(1500);
check("after sign-up: same combined total", (await combined())[0], "$54,810.60");

// 5. Render and save it.
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=render`);
await u.clickButton("Show it decorated");
await u.waitFor("[...document.querySelectorAll('img')].some(i => i.alt.startsWith('AI illustration') && i.complete && i.naturalWidth > 0)", { timeout: 30_000 });
await u.clickButton("Save this render");
await u.waitForText("Saved renders (1 of 6)", 10_000);
await sleep(1500); // autosave
await shot("studio-render");

// 6. Refresh: everything is still there.
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=estimate`);
await u.waitFor("document.querySelector('section[aria-label=\"Total across vendors\"]')", { timeout: 20_000 });
await sleep(1500);
check("refresh: combined total persists", (await combined())[0], "$54,810.60");
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=render`);
await u.waitForText("Saved renders (1 of 6)", 15_000);
check("refresh: saved render persists", true, true);

// 7. My plans.
await u.goto(`${base}/plans`);
await u.waitForText("$54,810.60", 20_000);
check("my plans: total shown", await has("$54,810.60"), true);
await shot("plans");

// 8. Guests.
await u.goto(`${base}/guests`);
await u.waitForText("No guests yet", 15_000);
const parties = [
  ["SAMPLE Family one", "Must invite", "30", "2"],
  ["SAMPLE Family two", "Extended family", "30", "0"],
  ["SAMPLE Friends", "Close friends", "25", "5"],
  ["SAMPLE Colleagues", "Casual", "20", "0"],
];
for (const [label, tier, seats, plus] of parties) {
  await u.clickButton(label === "SAMPLE Family one" ? "Add your first party" : "Add a party");
  await u.fill("Party", label);
  await u.select("Tier", tier);
  await u.fill("Seats", seats);
  await u.fill("Plus-ones", plus);
  await u.clickButton("Add party");
  await u.waitForText(label);
}
await sleep(1500);
check("guests: 112 seats of 250", await cdp.evaluate("document.querySelector('[role=meter][aria-label=\"Seats used\"]')?.getAttribute('aria-valuenow')"), "112");
check("guests: 138 seats left", await has("138 seats left in SAMPLE Glasshouse Ballroom"), true);
check("guests: cost per guest from the plan", await has("About $296.27 per guest"), true);
// Icon-only button: find it by its accessible name.
await cdp.evaluate(`document.querySelector('button[aria-label="Move Close friends earlier"]').click()`);
await sleep(800);
check("guests: trim order changed", await cdp.evaluate("[...document.querySelectorAll('ol li span')].map(s => s.textContent).filter(t => /^\\d\\./.test(t)).join(' | ')"), "1. Close friends | 2. Casual | 3. Extended family");
await shot("guests");

// 9. Print: A4, white background, no navigation.
await u.goto(`${base}/plans/${planId}/print`);
// The heading is styled uppercase, which innerText reports; match the underlying text.
await u.waitFor(`document.body.textContent.includes("Estimate · not a final quote")`, { timeout: 20_000, what: "print heading" });
check("print: combined total", await has("$54,810.60"), true);
await cdp.send("Emulation.setEmulatedMedia", { media: "print" });
await sleep(500);
const printState = JSON.parse(
  await cdp.evaluate(`JSON.stringify({
    bg: getComputedStyle(document.body).backgroundColor,
    button: getComputedStyle(document.querySelector('.no-print')).display,
    nav: [...document.querySelectorAll('nav')].every(n => getComputedStyle(n).display === 'none'),
  })`),
);
check("print: white background", printState.bg, "rgb(255, 255, 255)");
check("print: no buttons or navigation", printState.button === "none" && printState.nav, true);
await setViewport(cdp, 794);
await sleep(800);
const ph = JSON.parse(await cdp.evaluate("JSON.stringify({h:document.documentElement.scrollHeight})")).h;
writeFileSync(join(outDir, "print-a4-preview.png"), await capture(cdp, 794, ph));
const pdf = await cdp.send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true });
const bytes = Buffer.from(pdf.data, "base64");
writeFileSync(join(outDir, "estimate.pdf"), bytes);
const text = bytes.toString("latin1");
const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
// A4 = 210 x 297 mm = 595.28 x 841.89 pt.
check("pdf: A4 width (595 pt)", box ? Math.round(Number(box[1])) : null, 595);
check("pdf: A4 height (842 pt)", box ? Math.round(Number(box[2])) : null, 842);
check("pdf: fits on 1-2 pages", pages >= 1 && pages <= 2, true);
await cdp.send("Emulation.setEmulatedMedia", { media: "" });

console.table(results);
if (cdp.errors.length) console.log("Console errors:\n" + [...new Set(cdp.errors)].join("\n"));
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || cdp.errors.length ? 1 : 0);

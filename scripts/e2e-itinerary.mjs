#!/usr/bin/env node
// Guest itinerary walkthrough (Share step) on fresh emulators with the
// demonstration venues loaded, in DEMO mode: Aria drafts the day, the couple
// edits it, tries another version, approves it, and the itinerary becomes a
// designed image in three styles with a heading; it stays approved after a
// reload, and "Edit itinerary" goes back to the list. Saves screenshots and
// the generated images.
//
// Usage: npm run emulators (fresh), npm run sample-venues -- load --emulator, npm run dev, then
//   node scripts/e2e-itinerary.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const outDir = process.argv[2] ?? "docs/screenshots/itinerary";
const base = process.env.E2E_BASE ?? "http://localhost:3000";
const venue = process.env.E2E_VENUE ?? "garden-pavilion";
const couple = { email: `itinerary.couple.${Date.now()}@example.test`, password: "Emulator-Only-1t1n" };
mkdirSync(outDir, { recursive: true });

const cdp = await launch({ port: 9398 });
const u = ui(cdp);
const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });
const panel = "document.querySelector('section[aria-labelledby=itinerary-h]')";
const panelText = () => cdp.evaluate(`${panel}?.innerText ?? ''`);
const rowCount = () => cdp.evaluate(`${panel}.querySelectorAll('ol li input[type=time]').length`);
const panelButton = async (text) => {
  await u.waitFor(`[...${panel}.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled)`, { timeout: 30_000, what: `button "${text}"` });
  await cdp.evaluate(`[...${panel}.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
  await sleep(300);
};
const setInput = (selectorExpr, value) =>
  cdp.evaluate(`(() => { const el = ${selectorExpr}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true })); el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); })()`);
const imageUrl = () => cdp.evaluate(`${panel}?.querySelector('img')?.src ?? ''`);
const saveImage = async (name) => writeFileSync(join(outDir, `${name}.png`), Buffer.from((await imageUrl()).split(",")[1], "base64"));

async function shot(name, widths = [1366, 390]) {
  for (const width of widths) {
    await setViewport(cdp, width);
    await sleep(1600);
    const m = JSON.parse(await cdp.evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})"));
    writeFileSync(join(outDir, `${name}-${width}.png`), await capture(cdp, width, Math.max(m.h, 900)));
    if (m.sw > m.cw) results.push({ check: `${name}-${width}: no sideways scroll`, expected: m.cw, actual: m.sw, result: "FAIL" });
  }
  await setViewport(cdp, 1366);
  await sleep(300);
}

await setViewport(cdp, 1366);

// 1. A couple with a saved plan and a wedding date.
await u.goto(`${base}/studio/${venue}`);
await u.waitForText("Plan your day", 20_000);
await u.clickButton("Save your plan");
await u.waitForText("Create your account", 15_000);
await u.clickLabel("I agree to how my information is used");
await u.fill("Email", couple.email);
await u.fill("Password", couple.password);
await u.clickButton("Create account");
await u.waitFor("location.search.includes('plan=')", { timeout: 30_000, what: "plan saved" });
const planId = new URL(await cdp.evaluate("location.href")).searchParams.get("plan");
await u.fill("Wedding date (optional)", "2027-05-22");
await sleep(2500);

// 2. Share step: Aria drafts the itinerary.
await u.goto(`${base}/studio/${venue}?plan=${planId}&step=share`);
await u.waitFor(panel, { timeout: 20_000, what: "itinerary panel" });
check("panel: in the Share step", (await panelText()).includes("Guest itinerary"), true);
await panelButton("Create our itinerary");
await u.waitFor(`${panel}.querySelectorAll('ol li').length > 0`, { timeout: 30_000, what: "draft" });
check("draft: 6 DEMO lines", await rowCount(), 6);
check("draft: marked DRAFT, nothing final", (await panelText()).includes("Nothing is final until you approve it."), true);
check("draft: no image before approval", await cdp.evaluate(`!${panel}.querySelector('img')`), true);

// Edit, then try another version (the edit is replaced), then edit again.
await setInput(`${panel}.querySelectorAll('ol li')[0].querySelectorAll('input')[1]`, "Couple and family get ready");
await panelButton("Try another version");
await u.waitFor(`${panel}.querySelectorAll('ol li')[0].querySelectorAll('input')[1].value.startsWith('DEMO')`, { timeout: 30_000, what: "new version" });
check("again: a fresh draft replaces the edits", true, true);
await setInput(`${panel}.querySelectorAll('ol li')[0].querySelectorAll('input')[1]`, "Couple and family get ready");
await panelButton("Add a line");
await setInput(`[...${panel}.querySelectorAll('ol li')].at(-1).querySelectorAll('input')[1]`, "Send-off");
await panelButton("Use this itinerary");
await u.waitFor(`${panel}.innerText.includes('Each line needs a time')`, { what: "half-filled line refused" });
check("approve: a line without a time is refused", true, true);
await setInput(`[...${panel}.querySelectorAll('ol li')].at(-1).querySelectorAll('input')[0]`, "17:00");
await shot("itinerary-draft");
await panelButton("Use this itinerary");

// 3. Approved: the designed image.
await u.waitFor(`${panel}.querySelector('img')?.naturalWidth === 1080`, { timeout: 20_000, what: "itinerary image" });
check("image: 1080 x 1620", await cdp.evaluate(`(() => { const i = ${panel}.querySelector('img'); return i.naturalWidth + 'x' + i.naturalHeight; })()`), "1080x1620");
check("image: default heading in the alt text", await cdp.evaluate(`${panel}.querySelector('img').alt`), "Wedding itinerary image: Our Wedding Day");
check("image: downloadable PNG", await cdp.evaluate(`(() => { const a = ${panel}.querySelector('a[download]'); return a.download === 'wedding-itinerary.png' && a.href.startsWith('data:image/png'); })()`), true);
check("image: lines readable by screen readers", await cdp.evaluate(`${panel}.querySelector('ol.sr-only').innerText.includes('17:00 Send-off')`), true);
await saveImage("itinerary-classic");

// Heading and styles.
const before = await imageUrl();
await setInput(`${panel}.querySelector('input:not([type=radio])')`, "Mei & Arjun's Wedding");
await u.waitFor(`${panel}.querySelector('img').alt.includes("Mei & Arjun")`, { timeout: 10_000, what: "heading on the image" });
check("heading: shown on the image", (await imageUrl()) !== before, true);
for (const style of ["Botanical", "Festive"]) {
  const prev = await imageUrl();
  await cdp.evaluate(`[...${panel}.querySelectorAll('label')].find(l => l.textContent.trim() === ${JSON.stringify(style)}).click()`);
  await u.waitFor(`${panel}.querySelector('img').src !== ${JSON.stringify(prev)}`, { timeout: 10_000, what: `${style} style` });
  await saveImage(`itinerary-${style.toLowerCase()}`);
}
check("styles: festive chosen", await cdp.evaluate(`[...${panel}.querySelectorAll('input[type=radio]')].find(r => r.checked)?.parentElement.textContent.trim()`), "Festive");
await shot("itinerary-image");
await sleep(2500); // autosave

// 4. It stays approved after a reload; the same lines are Aria's timeline.
await u.goto(`${base}/studio/${venue}?plan=${planId}&step=share`);
await u.waitFor(`${panel}?.querySelector('img')?.naturalWidth === 1080`, { timeout: 20_000, what: "approved after reload" });
check("reload: still approved, heading kept", await cdp.evaluate(`${panel}.querySelector('img').alt`), "Wedding itinerary image: Mei & Arjun's Wedding");
check("reload: style kept", await cdp.evaluate(`[...${panel}.querySelectorAll('input[type=radio]')].find(r => r.checked)?.parentElement.textContent.trim()`), "Festive");
await u.goto(`${base}/plans/${planId}/print`);
await u.waitForText("Day-of timeline", 20_000);
check("print page: the approved lines", await cdp.evaluate("document.body.innerText.includes('Couple and family get ready') && document.body.innerText.includes('Send-off')"), true);

// 5. Edit goes back to the list.
await u.goto(`${base}/studio/${venue}?plan=${planId}&step=share`);
await u.waitFor(`${panel}?.querySelector('img')`, { timeout: 20_000, what: "image" });
await panelButton("Edit itinerary");
await u.waitFor(`${panel}.querySelectorAll('ol li input[type=time]').length === 7`, { what: "editor with 7 lines" });
check("edit: back to the 7 approved lines", await rowCount(), 7);

console.table(results);
const errors = [...new Set(cdp.errors)];
if (errors.length) console.log("Console errors:\n" + errors.join("\n"));
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || errors.length ? 1 : 0);

#!/usr/bin/env node
// Aria (Rose Garden) walkthrough on fresh emulators with the SAMPLE venues
// loaded, in DEMO mode: the brief and budget, Aria's alerts (over budget,
// date unavailable, over capacity), labelled options with Apply / Adjust /
// Find alternatives / Not now, a venue shortlist, handing off to the
// confirmation request, the day-of timeline, the decision log, the print page,
// the Rose Garden page, and Aria in Tamil. Saves screenshots.
//
// Usage: npm run emulators (fresh), npm run sample-venues -- load --emulator, npm run dev, then
//   node scripts/e2e-aria.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const outDir = process.argv[2] ?? "docs/screenshots/aria";
const base = "http://localhost:3000";
const couple = { email: `aria.couple.${Date.now()}@example.test`, password: "Emulator-Only-a1r1a" };
mkdirSync(outDir, { recursive: true });

const cdp = await launch({ port: 9396 });
const u = ui(cdp);
const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });
const js = (v) => JSON.stringify(v);
const has = async (t) => (await u.text()).includes(t);
const dialogText = () => cdp.evaluate("document.querySelector('[role=dialog]')?.innerText ?? ''");
const waitDialog = (text, what = text, timeout = 30_000) => u.waitFor(`document.querySelector('[role=dialog]')?.innerText.includes(${js(text)})`, { timeout, what });
const dialogButton = async (text) => {
  await u.waitFor(`[...document.querySelectorAll('[role=dialog] button')].some(b => b.textContent.trim() === ${js(text)} && !b.disabled)`, { what: `dialog button "${text}"` });
  await cdp.evaluate(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === ${js(text)} && !b.disabled).click()`);
  await sleep(300);
};
// Suggestion cards are the bordered boxes in the chat; act on the newest card whose text matches.
const cardButton = async (cardText, button) => {
  await cdp.evaluate(`(() => {
    const cards = [...document.querySelectorAll('[role=dialog] [role=log] .border-accent')].filter(c => c.innerText.includes(${js(cardText)}));
    const b = cards.at(-1)?.querySelectorAll('button');
    const hit = b && [...b].find(x => x.textContent.trim() === ${js(button)});
    if (!hit) throw new Error('No ' + ${js(button)} + ' in card ' + ${js(cardText)});
    hit.click();
  })()`);
  await sleep(300);
};
const send = async (text) => {
  const before = await cdp.evaluate("document.querySelectorAll('[role=dialog] [role=log] > div').length");
  await u.fill("Your message", text);
  await dialogButton("Send");
  await u.waitFor(`document.querySelectorAll('[role=dialog] [role=log] > div').length >= ${before + 2}`, { timeout: 30_000, what: `reply to "${text}"` });
  await sleep(400);
};
const closeDialog = async () => {
  await cdp.evaluate("document.querySelector('[role=dialog] button[aria-label=Close]')?.click()");
  await u.waitFor("!document.querySelector('[role=dialog]')", { what: "dialog closed" });
};

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

// 1. Rose Garden page: only what the software does; free during the pilot.
await u.goto(`${base}/rose-garden`);
await u.waitForText("Rose Garden", 20_000);
check("rose garden: free during the pilot", await has("Free during the pilot"), true);
check("rose garden: 12 included features", await cdp.evaluate("document.querySelectorAll('#rose-included ~ ul li').length"), 12);
check("rose garden: says no payments from couples", await has("We don't take payments or deposits from couples."), true);
check("rose garden: no invented prices or claims", await cdp.evaluate("!/5,500|340\\+|4\\.9|insurance|senior planner/i.test(document.body.innerText)"), true);
await shot("rose-garden");
await u.goto(base);
await u.waitForText("Rose Garden plan", 15_000);
check("landing: links to Rose Garden", await cdp.evaluate("!!document.querySelector('a[href=\"/rose-garden\"]')"), true);

// 2. Sign up from the Studio and save a plan.
await u.goto(`${base}/studio/sample-garden-pavilion`);
await u.waitForText("Plan your day", 20_000);
await u.clickButton("Save your plan");
await u.waitForText("Create your account", 15_000);
await u.clickLabel("I agree to how my information is used");
await u.fill("Email", couple.email);
await u.fill("Password", couple.password);
await u.clickButton("Create account");
await u.waitFor("location.search.includes('plan=')", { timeout: 30_000, what: "plan saved" });
await u.waitForText("Saved", 15_000);
const planId = new URL(await cdp.evaluate("location.href")).searchParams.get("plan");

// A date the SAMPLE venue has blocked.
await u.fill("Wedding date (optional)", "2027-05-15");
await sleep(2500);

// 3. Aria opens with tabs, the Rose Garden link, and her intro.
await u.clickButton("Plan with Aria");
await waitDialog("Hi, I'm Aria", "Aria intro");
const d0 = await dialogText();
check("aria: tabs shown", ["Chat", "Brief", "Timeline", "Decisions"].every((t) => d0.includes(t)), true);
check("aria: Rose Garden link", await cdp.evaluate("!!document.querySelector('[role=dialog] a[href=\"/rose-garden\"]')"), true);
check("aria: tab semantics", await cdp.evaluate("document.querySelectorAll('[role=dialog] [role=tab]').length === 4 && !!document.querySelector('[role=dialog] [role=tabpanel]')"), true);

// 4. Brief: budget, traditions, food, access, notes.
await dialogButton("Brief");
await waitDialog("Tell Aria what matters.");
await u.fill("Total budget (SGD, optional)", "20,000x");
await dialogButton("Save brief");
await waitDialog("Enter a whole number of dollars", "budget error");
check("brief: a bad budget is refused", true, true);
await u.fill("Total budget (SGD, optional)", "20,000");
await u.fill("Style, in your words", "Relaxed garden, warm colours");
await u.clickLabel("Malay");
await u.clickLabel("Halal");
await u.clickLabel("Step-free access needed");
await u.fill("Anything else Aria should know", "Grandparents need seats near the front.");
await shot("aria-brief");
await dialogButton("Save brief");
await u.waitForText("Brief saved.", 10_000);
await closeDialog();
await sleep(2500); // autosave

// 5. Aria noticed: over budget and the date is unavailable, shown in the Studio.
await u.waitForText("Aria noticed", 15_000);
check("studio alert: over budget", await cdp.evaluate("/The estimate is \\$[\\d,]+\\.\\d{2} over your budget\\./.test(document.body.innerText)"), true);
check("studio alert: date unavailable", await has("SAMPLE Garden Pavilion marked your wedding date as unavailable."), true);
await shot("studio-alerts");

// 6. Ask about the budget: labelled options, each with four choices.
await u.clickButton("Plan with Aria");
await waitDialog("Aria noticed");
await cdp.evaluate("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Ask Aria for options').click()");
await waitDialog("Option B", "options");
const d1 = await dialogText();
check("options: DEMO labelled", d1.includes("DEMO: the AI isn't switched on yet"), true);
check("options: Option A is Off-Peak", d1.includes("Pricing: Off-Peak"), true);
check("options: Option B fewer guests", /Guests: 165 to 148/.test(d1), true);
check("options: four choices per card", await cdp.evaluate("[...document.querySelectorAll('[role=dialog] [role=log] .border-accent')].every(c => ['Apply','Adjust','Find alternatives','Not now'].every(t => [...c.querySelectorAll('button')].some(b => b.textContent.trim() === t)))"), true);
check("options: estimate effect shown", /Estimate: \$[\d,]+\.\d{2} to \$[\d,]+\.\d{2}/.test(d1), true);
await shot("aria-options");
await cardButton("Option A", "Apply");
await waitDialog("Applied to your plan.");
check("apply: Option A applied", true, true);

// Adjust Option B: change 148 to 150, then apply.
await cardButton("Option B", "Adjust");
await waitDialog("Untick anything you don't want");
await cdp.evaluate(`(() => {
  const card = [...document.querySelectorAll('[role=dialog] [role=log] .border-accent')].filter(c => c.innerText.includes('Option B')).at(-1);
  const el = card.querySelector('input[type=number]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '150');
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await sleep(300);
check("adjust: a number field for the guests", await cdp.evaluate("!!document.querySelector('[role=dialog] [role=log] input[type=number]')"), true);
await shot("aria-adjust", [1366]);
await cardButton("Option B", "Apply selected");
await waitDialog("Applied with your changes.");

// 7. Shortlist of other listed venues.
await send("Show me other venues");
await waitDialog("Venues that could fit");
check("shortlist: SAMPLE venues only", await cdp.evaluate("[...document.querySelectorAll('[role=dialog] a[href^=\"/studio/\"]')].length > 0 && [...document.querySelectorAll('[role=dialog] a[href^=\"/studio/\"]')].every(a => a.textContent.includes('SAMPLE'))"), true);
check("shortlist: keeps this plan", (await dialogText()).includes("this plan stays as it is"), true);

// 8. Find alternatives and Not now.
await send("Add the floral arch");
await cardButton("Add: SAMPLE Floral arch", "Find alternatives");
await waitDialog("Asked Aria for a different option.");
await waitDialog("Please suggest a different option instead of this", "alternatives message sent");
await sleep(2500);
await send("Modern Botanical theme please");
await cardButton("Theme: Modern Botanical", "Not now");
await waitDialog("Not applied.");

// 9. A confirmation request is the couple's to send.
await send("Can the vendors confirm prices?");
await waitDialog("Ask vendors to confirm prices");
check("request: Aria never contacts vendors", (await dialogText()).includes("Aria never contacts vendors."), true);
await dialogButton("Open the request");
await u.waitFor("!document.querySelector('[role=dialog]') && location.search.includes('step=estimate')", { what: "estimate step" });
check("request: opens the Estimate step", true, true);

// 10. A DEMO timeline, applied, then edited and saved.
await u.clickButton("Plan with Aria");
await waitDialog("Hi, I'm Aria");
await send("A timeline please");
await cardButton("Day-of timeline", "Apply");
await waitDialog("Applied to your plan.");
await dialogButton("Timeline");
await waitDialog("A draft for you to edit.");
check("timeline: 6 DEMO lines", await cdp.evaluate("document.querySelectorAll('[role=dialog] ol li input[type=time]').length"), 6);
await cdp.evaluate(`(() => {
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const rows = document.querySelectorAll('[role=dialog] ol li');
  set(rows[0].querySelectorAll('input')[1], 'Couple and family get ready');
})()`);
await dialogButton("Add a line");
await cdp.evaluate(`(() => {
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const rows = document.querySelectorAll('[role=dialog] ol li');
  const last = rows[rows.length - 1].querySelectorAll('input');
  set(last[1], 'Send-off');
})()`);
await dialogButton("Save timeline");
await waitDialog("Each line needs a time and a short description.", "half-filled line refused");
check("timeline: a line without a time is refused", true, true);
await cdp.evaluate(`(() => {
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const rows = document.querySelectorAll('[role=dialog] ol li');
  set(rows[rows.length - 1].querySelectorAll('input')[0], '17:00');
})()`);
await dialogButton("Save timeline");
await u.waitForText("Timeline saved.", 10_000);
await shot("aria-timeline");

// 11. Decision log: every choice recorded.
await dialogButton("Decisions");
await waitDialog("Decision log");
await u.waitFor("document.querySelectorAll('[role=dialog] ol li').length >= 5", { timeout: 15_000, what: "decisions listed" });
const d2 = await dialogText();
for (const a of ["Applied", "Applied with changes", "Asked for alternatives", "Not applied"]) check(`decisions: "${a}" logged`, d2.includes(a), true);
check("decisions: estimate change recorded", /Estimate: \$[\d,]+\.\d{2} to \$[\d,]+\.\d{2}/.test(d2), true);
await shot("aria-decisions");
await closeDialog();
await sleep(2500); // autosave

// 12. Saved: after reload the plan has Aria's applied changes; the print page has the timeline and budget.
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}`);
await u.waitForText("150 guests", 20_000);
check("saved: 150 guests (adjusted)", true, true);
check("saved: Off-Peak pricing", await has("Off-Peak"), true);
await u.goto(`${base}/plans/${planId}/print`);
await u.waitForText("Day-of timeline (DRAFT)", 20_000);
check("print: edited timeline line", await has("Couple and family get ready"), true);
check("print: added line, in time order", await cdp.evaluate("(() => { const t = document.body.innerText; return t.includes('17:00') && t.indexOf('16:00') < t.indexOf('17:00'); })()"), true);
check("print: budget", await has("Budget: $20,000.00"), true);
await shot("print-timeline", [1366]);

// 13. Over capacity: more guests than the room holds.
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&assistant=1`);
await waitDialog("Hi, I'm Aria");
await dialogButton("Brief");
await u.fill("Guests", "300");
await dialogButton("Save brief");
await u.waitForText("Brief saved.", 10_000);
await closeDialog();
await u.waitForText("50 guests more than this room's maximum.", 10_000);
check("studio alert: over capacity", true, true);
await sleep(2500); // autosave

// 14. Aria in Tamil.
await cdp.evaluate("localStorage.setItem('wv-locale', 'ta')");
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&assistant=1`);
await u.waitFor("document.documentElement.lang === 'ta-SG' && document.querySelector('[role=dialog]')", { timeout: 20_000, what: "Tamil Aria" });
await sleep(1500);
check("tamil: tabs translated", (await dialogText()).includes("உரையாடல்"), true);
check("tamil: every tab visible", await cdp.evaluate("[...document.querySelectorAll('[role=dialog] [role=tab]')].every(t => { const r = t.getBoundingClientRect(); return r.right <= window.innerWidth && r.width > 0; })"), true);
await shot("aria-ta", [390]);
await cdp.evaluate("localStorage.setItem('wv-locale', 'en')");

console.table(results);
const errors = [...new Set(cdp.errors)];
if (errors.length) console.log("Console errors:\n" + errors.join("\n"));
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || errors.length ? 1 : 0);

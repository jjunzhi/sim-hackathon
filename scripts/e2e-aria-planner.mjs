#!/usr/bin/env node
// Floating Aria walkthrough on fresh emulators with the demonstration venues loaded,
// in DEMO mode: the bottom-right button on the landing page, planning as a
// guest (real listed venues, decorators, a plan to start), carrying the plan
// into the Studio and saving it at sign-up, Aria's plan tools in the panel,
// where Aria is hidden, the bolder role choice, no DRAFT notes, and the role
// question asked only once. Saves screenshots.
//
// Usage: npm run emulators (fresh), npm run sample-venues -- load --emulator, npm run dev, then
//   node scripts/e2e-aria-planner.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const outDir = process.argv[2] ?? "docs/screenshots/aria-planner";
const base = "http://localhost:3000";
const couple = { email: `planner.couple.${Date.now()}@example.test`, password: "Emulator-Only-p1an" };
mkdirSync(outDir, { recursive: true });

const cdp = await launch({ port: 9397 });
const u = ui(cdp);
const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });
const js = (v) => JSON.stringify(v);
const panelText = () => cdp.evaluate("document.querySelector('[role=dialog]')?.innerText ?? ''");
const waitPanel = (text, timeout = 30_000) => u.waitFor(`document.querySelector('[role=dialog]')?.innerText.includes(${js(text)})`, { timeout, what: `panel: ${text}` });
const launcher = "document.querySelector('button[aria-label=\"Chat with Aria\"]')";
const panelButton = async (text) => {
  await u.waitFor(`[...document.querySelectorAll('[role=dialog] button')].some(b => b.textContent.trim() === ${js(text)} && !b.disabled)`, { what: `panel button "${text}"` });
  await cdp.evaluate(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === ${js(text)} && !b.disabled).click()`);
  await sleep(300);
};
const send = async (text) => {
  const before = await cdp.evaluate("document.querySelectorAll('[role=dialog] [role=log] > div').length");
  await u.fill("Your message", text);
  await cdp.evaluate("document.querySelector('[role=dialog] button[aria-label=Send]').click()");
  await u.waitFor(`document.querySelectorAll('[role=dialog] [role=log] > div').length >= ${before + 2}`, { timeout: 30_000, what: `reply to "${text}"` });
  await sleep(400);
};

async function shot(name, widths = [1366, 390]) {
  for (const width of widths) {
    await setViewport(cdp, width);
    await sleep(1600);
    const m = JSON.parse(await cdp.evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})"));
    writeFileSync(join(outDir, `${name}-${width}.png`), await capture(cdp, width, 900));
    if (m.sw > m.cw) results.push({ check: `${name}-${width}: no sideways scroll`, expected: m.cw, actual: m.sw, result: "FAIL" });
  }
  await setViewport(cdp, 1366);
  await sleep(300);
}

await setViewport(cdp, 1366);

// 1. The floating button, bottom-right, on the landing page; real room photos in the hero.
await u.goto(base);
await u.waitFor("document.querySelector('figure img')?.complete", { timeout: 20_000, what: "hero photo" });
check("hero: real room photo", await cdp.evaluate("decodeURIComponent(document.querySelector('figure img').currentSrc).includes('/venues/') && document.querySelector('figure img').naturalWidth > 0"), true);
check("landing: no SAMPLE wording", await cdp.evaluate("!document.body.innerText.includes('SAMPLE')"), true);
await u.waitFor(launcher, { timeout: 20_000, what: "Aria button" });
const pos = JSON.parse(await cdp.evaluate(`JSON.stringify((() => { const r = ${launcher}.getBoundingClientRect(); return { right: innerWidth - r.right, bottom: innerHeight - r.bottom, w: r.width }; })())`));
check("button: bottom-right corner", pos.right < 40 && pos.bottom < 40, true);
check("button: at least 44px", pos.w >= 44, true);
await shot("landing-button");

// 2. Open: a friendly greeting and quick ideas; no account needed.
await cdp.evaluate(`${launcher}.click()`);
await waitPanel("Congratulations on your wedding");
check("panel: quick ideas offered", (await panelText()).includes("A garden wedding for 150 guests"), true);
check("panel: focus in the message box", await cdp.evaluate("document.activeElement?.tagName === 'TEXTAREA'"), true);
await shot("panel-greeting");

// 3. Plan as a guest: real listed venues, decorators and a plan to start.
await panelButton("A garden wedding for 150 guests");
await waitPanel("Venues you might love");
const p1 = await panelText();
check("guest: DEMO labelled", p1.includes("DEMO: the AI isn't switched on yet"), true);
check("guest: listed venues, no SAMPLE wording", await cdp.evaluate("[...document.querySelectorAll('[role=dialog] a[href^=\"/venues/\"]')].length > 0 && !document.querySelector('[role=dialog]').innerText.includes('SAMPLE')"), true);
check("guest: a plan to start", p1.includes("Ready to start?") && p1.includes("150 guests"), true);
check("guest: guest note with sign-up link", p1.includes("You're chatting as a guest.") && (await cdp.evaluate("!!document.querySelector('[role=dialog] a[href^=\"/sign-up\"]')")), true);
check("guest: messages left (guest allowance)", p1.includes("9 messages left today"), true);
await shot("panel-guest-plan");

// Details add up across messages.
await send("Halal food please, budget $60,000");
const p2 = await panelText();
check("follow-up: halal needs carried into the plan", /Your needs: .*Halal/.test(p2), true);
check("follow-up: budget carried", p2.includes("Budget: $60,000.00"), true);
const venueName = await cdp.evaluate("[...document.querySelectorAll('[role=dialog] section.border-accent')].at(-1)?.innerText.match(/Venue: (.+)/)?.[1] ?? ''");

// 4. Start planning: the Studio opens with Aria's plan; the panel switches to the plan tools.
await cdp.evaluate("[...document.querySelectorAll('[role=dialog] section.border-accent')].at(-1).querySelector('button').click()");
await u.waitFor("location.pathname.startsWith('/studio/') && location.search.includes('resume=1')", { timeout: 20_000, what: "studio" });
// Wait for the Studio itself: "150 guests" also appears in Aria's panel.
await u.waitFor("document.querySelector('main')?.innerText.includes('Plan your day') && document.querySelector('main').innerText.includes('150 guests')", { timeout: 20_000, what: "studio with 150 guests" });
check("studio: Aria's plan opened (150 guests)", true, true);
{
  const main = await u.text();
  const ok = !!venueName.trim() && main.includes(venueName.trim());
  results.push({ check: "studio: venue from the suggestion", expected: true, actual: ok ? true : `${JSON.stringify(venueName)} @ ${await cdp.evaluate("location.pathname")}`, result: ok ? "PASS" : "FAIL" });
}
await waitPanel("Save your plan to use Aria.", 15_000);
check("panel: plan tools ask to save first", true, true);

// Save: sign up, and the plan from Aria is saved.
await cdp.evaluate("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Save your plan').click()");
await u.waitForText("Create your account", 15_000);
check("sign-up: Aria hidden on sign-up", await cdp.evaluate(`!${launcher}`), true);
check("sign-up: no DRAFT note on consent", await cdp.evaluate("!document.body.innerText.includes('DRAFT wording')"), true);
await u.clickLabel("We're planning a wedding");
check("role: chosen option has a bold ring", await cdp.evaluate("(() => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.includes(\"We're planning a wedding\")); return getComputedStyle(l).boxShadow !== 'none' && l.className.includes('ring-2'); })()"), true);
await shot("sign-up-role", [1366, 390]);
await u.clickLabel("I agree to how my information is used");
await u.fill("Email", couple.email);
await u.fill("Password", couple.password);
await u.clickButton("Create account");
await u.waitFor("location.search.includes('plan=')", { timeout: 30_000, what: "plan saved" });
await u.waitForText("Saved", 15_000);
await u.waitFor("document.querySelector('main')?.innerText.includes('150 guests')", { timeout: 15_000, what: "saved plan" });
check("saved: Aria's plan kept 150 guests", true, true);
await u.clickButton("Plan with Aria");
await waitPanel("Decisions", 15_000);
check("panel: plan tools with tabs", await cdp.evaluate("document.querySelectorAll('[role=dialog] [role=tab]').length"), 4);
await shot("panel-plan-tools");
await cdp.evaluate("document.querySelector('[role=dialog] button[aria-label=Close]').click()");
await u.waitFor("!document.querySelector('[role=dialog]')", { what: "panel closed" });
check("panel: focus back on the button", await cdp.evaluate("document.activeElement?.getAttribute('aria-label') === 'Chat with Aria'"), true);

// 5. The role question is asked only once: sign out, sign in, straight in.
await u.goto(`${base}/venues`);
await u.waitForText("venues", 20_000);
await u.clickButton("Sign out");
await u.waitFor("location.pathname === '/' || document.body.innerText.includes('Sign in')", { timeout: 15_000, what: "signed out" });
await u.goto(`${base}/sign-in`);
await u.waitForText("Welcome back", 15_000);
await u.fill("Email", couple.email);
await u.fill("Password", couple.password);
await cdp.evaluate("[...document.querySelectorAll('form button[type=submit]')].at(-1).click()");
await u.waitFor("!location.pathname.startsWith('/sign-in')", { timeout: 20_000, what: "signed in" });
await sleep(1500);
check("second sign-in: no role question", await cdp.evaluate("!location.pathname.startsWith('/welcome') && !document.body.innerText.includes('One last step')"), true);

// 6. No DRAFT notice on the privacy page; Aria hidden on vendor pages.
await u.goto(`${base}/privacy`);
await u.waitForText("Privacy notice", 15_000);
check("privacy: no DRAFT notice", await cdp.evaluate("!/DRAFT|before launch|Under review/.test(document.body.innerText)"), true);
await u.goto(`${base}/vendor`);
await sleep(2500);
check("vendor area: Aria hidden", await cdp.evaluate(`!${launcher}`), true);

console.table(results);
const errors = [...new Set(cdp.errors)];
if (errors.length) console.log("Console errors:\n" + errors.join("\n"));
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || errors.length ? 1 : 0);

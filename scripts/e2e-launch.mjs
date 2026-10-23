#!/usr/bin/env node
// Launch walkthrough on fresh emulators with the SAMPLE venues loaded
// (npm run sample-venues -- load --emulator): the catalog and its SAMPLE note,
// the planning assistant (DEMO mode) from signed-out to Apply, the assistant in
// Tamil, and the launch pages (privacy, 404, robots, sitemap, share image,
// security headers). Saves screenshots.
//
// Usage: npm run emulators (fresh), npm run sample-venues -- load --emulator, npm run dev, then
//   node scripts/e2e-launch.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const outDir = process.argv[2] ?? "docs/screenshots/launch";
const base = "http://localhost:3000";
const couple = { email: `launch.couple.${Date.now()}@example.test`, password: "Emulator-Only-l4c1" };
mkdirSync(outDir, { recursive: true });

const cdp = await launch({ port: 9395 });
const u = ui(cdp);
const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });
const has = async (t) => (await u.text()).includes(t);
const dialogText = () => cdp.evaluate("document.querySelector('[role=dialog]')?.innerText ?? ''");

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

// 1. Catalog: nine SAMPLE venues, with the SAMPLE note.
await u.goto(`${base}/venues`);
await u.waitForText("9 venues", 20_000);
check("catalog: 9 SAMPLE venues", true, true);
check("catalog: SAMPLE note shown", await has("These are SAMPLE listings for demonstration."), true);
check("catalog: every venue name says SAMPLE", await cdp.evaluate("[...document.querySelectorAll('h3, h2')].filter(h => h.closest('a[href^=\"/venues/\"]')).every(h => h.textContent.includes('SAMPLE'))"), true);
await shot("catalog");
await u.clickLabel("Halal");
await sleep(400);
check("filter: halal menus = 4 SAMPLE venues", await has("4 venues"), true);
await u.goto(`${base}/venues/sample-grand-orchard`);
await u.waitForText("SAMPLE Grand Ballroom", 20_000);
await shot("venue-grand-orchard");

// 2. Assistant, signed out: asks to save first.
await u.goto(`${base}/studio/sample-garden-pavilion`);
await u.waitForText("Plan your day", 20_000);
await u.clickButton("Plan with Aria");
await u.waitFor("document.querySelector('[role=dialog]')");
check("assistant signed out: save first", (await dialogText()).includes("Save your plan to use Aria."), true);
await shot("assistant-signed-out", [1366]);
await cdp.evaluate("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Save your plan').click()");
await u.waitForText("Create your account", 15_000);
await u.clickLabel("I agree to how my information is used");
check("sign-up: privacy notice linked", await cdp.evaluate("!!document.querySelector('a[href=\"/privacy\"]')"), true);
await u.fill("Email", couple.email);
await u.fill("Password", couple.password);
await u.clickButton("Create account");
await u.waitFor("location.search.includes('plan=')", { timeout: 30_000, what: "plan saved" });
await u.waitForText("Saved", 15_000);
const planId = new URL(await cdp.evaluate("location.href")).searchParams.get("plan");

// 3. Ask, see a checked suggestion with its cost, apply it.
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&assistant=1`);
await u.waitFor("document.querySelector('[role=dialog]')", { timeout: 20_000, what: "assistant opens from ?assistant=1" });
check("assistant: intro shown", (await dialogText()).includes("Tell me about your wedding"), true);
await u.fill("Your message", "We'd like 150 guests, the Modern Botanical theme, and add the floral arch");
await cdp.evaluate("document.querySelector('[role=dialog] button[aria-label=Send]').click()");
await u.waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Suggested changes')", { timeout: 30_000, what: "suggestion" });
const d = await dialogText();
check("assistant: DEMO labelled", d.includes("DEMO: the AI isn't switched on yet"), true);
check("assistant: guests change listed", /Guests: \d+ to 150/.test(d), true);
check("assistant: theme change listed", d.includes("Theme: Modern Botanical"), true);
check("assistant: item from the real catalog", d.includes("Add: SAMPLE Floral arch"), true);
// Either form is right: a minimum spend can absorb an added item, leaving the total unchanged.
check("assistant: estimate effect shown", /Estimate: \$[\d,]+\.\d{2} to \$[\d,]+\.\d{2}|Estimate stays at \$[\d,]+\.\d{2}/.test(d), true);
check("assistant: messages left today", d.includes("29 messages left today"), true);
await shot("assistant-suggestion");
await cdp.evaluate("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Apply').click()");
await u.waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Applied to your plan.')", { timeout: 10_000, what: "applied" });
await cdp.evaluate("document.querySelector('[role=dialog] button[aria-label]')?.click()");
await sleep(2500); // autosave
check("applied: plan shows 150 guests", await cdp.evaluate("document.body.innerText.includes('150 guests')"), true);
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=style`);
await u.waitForText("The venue's own decor", 20_000);
check("applied and saved: arch chosen after reload", await cdp.evaluate("(() => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim().startsWith('SAMPLE Floral arch')); const b = l && document.getElementById(l.htmlFor); return b?.getAttribute('aria-checked') ?? b?.getAttribute('data-state'); })()"), "true");

// 4. The assistant in Tamil.
await cdp.evaluate("localStorage.setItem('wv-locale', 'ta')");
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&assistant=1`);
await u.waitFor("document.documentElement.lang === 'ta-SG' && document.querySelector('[role=dialog]')", { timeout: 20_000, what: "Tamil assistant" });
await sleep(1500);
check("assistant in Tamil: tabs translated", (await dialogText()).includes("உரையாடல்"), true);
await shot("assistant-ta", [390]);
await cdp.evaluate("localStorage.setItem('wv-locale', 'en')");

// 5. Launch pages.
await u.goto(`${base}/privacy`);
await u.waitForText("Privacy notice", 15_000);
check("privacy: no DRAFT notice (reviewed)", await cdp.evaluate("!/DRAFT|before launch/.test(document.body.innerText)"), true);
await shot("privacy");
await u.goto(`${base}/no-such-page-here`);
await u.waitForText("We couldn't find that page", 15_000);
check("404: branded page", true, true);
await shot("not-found", [390]);
const robots = await (await fetch(`${base}/robots.txt`)).text();
check("robots: family links disallowed", robots.includes("Disallow: /s/"), true);
const sitemap = await fetch(`${base}/sitemap.xml`);
check("sitemap: served", sitemap.status, 200);
const og = await fetch(`${base}/opengraph-image`);
check("share image: PNG", og.headers.get("content-type"), "image/png");
const head = await fetch(`${base}/venues`);
check("headers: nosniff", head.headers.get("x-content-type-options"), "nosniff");
check("headers: frame deny", head.headers.get("x-frame-options"), "DENY");
check("headers: no x-powered-by", head.headers.get("x-powered-by"), null);

console.table(results);
const errors = [...new Set(cdp.errors)];
if (errors.length) console.log("Console errors:\n" + errors.join("\n"));
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || errors.length ? 1 : 0);

#!/usr/bin/env node
// Phase 5 walkthrough on fresh emulators with SAMPLE seed data:
// couple plans and saves 2 renders -> family link -> a family member votes in
// a separate browser with no account -> a second vote by the same identity is
// refused by the rules -> the couple sees results -> the couple asks the venue
// to confirm -> the venue vendor sees the real selections and confirms -> the
// couple sees "Vendor Confirmed · Valid until" -> the vendor raises a price:
// the confirmed part stays, the live estimate moves -> turning the link off ->
// deleting the couple's account. Saves screenshots.
//
// Usage: npm run emulators (fresh), npm run seed, npm run dev, then
//   node scripts/e2e-phase5.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const PROJECT_ID = "demo-weddingvista";
const outDir = process.argv[2] ?? "docs/screenshots/phase5";
const base = "http://localhost:3000";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const { couple } = JSON.parse(readFileSync("scripts/emulator-test-accounts.json", "utf8"));
mkdirSync(outDir, { recursive: true });

// The seeded venue owner has no sign-in. Give it one, on the emulator only.
const VENUE_OWNER = "sample-venue-1";
const venueLogin = { email: "sample-venue-1.walkthrough@example.test", password: "Emulator-Only-v5p1" };
await fetch(`${AUTH}/projects/${PROJECT_ID}/accounts`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
  body: JSON.stringify({ localId: VENUE_OWNER, ...venueLogin }),
});
const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { host: "127.0.0.1", port: 8080 } });
await env.withSecurityRulesDisabled((ctx) =>
  setDoc(doc(ctx.firestore(), `users/${VENUE_OWNER}`), { role: "vendor", consent: { version: "draft", acceptedAt: Timestamp.now() }, createdAt: Timestamp.now() }),
);
await env.cleanup();

const cdp = await launch({ port: 9341 });
const u = ui(cdp);
const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });
const has = async (t, c = u) => (await c.text()).includes(t);

async function shot(name, widths = [1366, 390], c = cdp) {
  for (const width of widths) {
    await c.evaluate("[...document.querySelectorAll('button[aria-label=Dismiss]')].forEach(b => b.click())");
    await setViewport(c, width);
    await sleep(1600);
    const m = JSON.parse(await c.evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})"));
    writeFileSync(join(outDir, `${name}-${width}.png`), await capture(c, width, m.h));
    if (m.sw > m.cw) results.push({ check: `${name}-${width}: no sideways scroll`, expected: m.cw, actual: m.sw, result: "FAIL" });
  }
  await setViewport(c, 1366);
  await sleep(300);
}

const sectionTotal = (section) => cdp.evaluate(`document.querySelector(${JSON.stringify(`section[aria-label="${section}"]`)})?.querySelector('[aria-live]')?.textContent ?? null`);
const sectionText = (section) => cdp.evaluate(`document.querySelector(${JSON.stringify(`section[aria-label="${section}"]`)})?.innerText ?? ''`);
const combined = () => cdp.evaluate(`[...document.querySelectorAll('section[aria-label="Total across vendors"] .sr-only')].map(e => e.textContent)`);
const VENUE = "SAMPLE Garden Pavilion Co (venue)";
const DECO = "SAMPLE Petal & Lantern Studio";

await setViewport(cdp, 1366);

// 1. A couple builds the Phase 4 plan, signs up, and saves two renders.
await u.goto(`${base}/studio/sample-garden-pavilion`);
await u.waitForText("Plan your day", 20_000);
await u.setSlider("Guests", 185);
await u.clickButton("Next: Style");
await u.waitForText("The venue's own decor", 15_000);
for (const item of ["SAMPLE Floral arch", "SAMPLE Table centrepiece", "SAMPLE Chair sash", "SAMPLE Lantern set"]) await u.clickLabel(item);
await u.clickButton("Next: Render");
await u.clickButton("Next: Estimate");
await u.waitFor("document.querySelector('section[aria-label=\"Total across vendors\"]')", { timeout: 15_000 });
await u.clickButton("Save your plan");
await u.waitForText("Create your account", 15_000);
await u.clickLabel("I agree to how my information is used");
await u.fill("Email", couple.email);
await u.fill("Password", couple.password);
await u.clickButton("Create account");
await u.waitFor("location.search.includes('plan=')", { timeout: 30_000, what: "plan saved after sign-up" });
await u.waitForText("Saved", 15_000);
const planId = new URL(await cdp.evaluate("location.href")).searchParams.get("plan");
await sleep(1500);
check("plan: combined total before any confirmation", (await combined())[0], "$54,810.60");

async function renderAndSave(count) {
  await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=render`);
  await u.clickButton("Show it decorated");
  await u.waitFor("[...document.querySelectorAll('img')].some(i => i.alt.startsWith('AI illustration') && i.complete && i.naturalWidth > 0)", { timeout: 30_000 });
  await u.clickButton("Save this render");
  await u.waitForText(`Saved renders (${count} of 6)`, 10_000);
  await sleep(1500); // autosave
}
await renderAndSave(1);
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=style`);
await u.waitForText("The venue's own decor", 15_000);
await u.select("Theme", "Modern Botanical");
await sleep(1500);
await renderAndSave(2);

// 2. Family link from two saved renders.
await u.goto(`${base}/plans`);
await u.clickButton("Create a family link");
await u.waitForText("Choose 2 or 3 renders", 10_000);
await u.waitFor("document.querySelectorAll('fieldset input[type=checkbox]').length === 2", { timeout: 15_000, what: "two saved renders to choose" });
check("link: live plan estimate offered", await has("$54,810.60 estimate"), true);
await cdp.evaluate("[...document.querySelectorAll('fieldset input[type=checkbox]')].forEach(i => i.click())");
await sleep(300);
await shot("family-link-create");
await u.clickButton("Create link");
await u.waitFor("[...document.querySelectorAll('input')].some(i => i.labels?.[0]?.textContent.trim() === 'Link' && i.value.includes('/s/'))", { timeout: 15_000, what: "link created" });
const link = await cdp.evaluate("[...document.querySelectorAll('input')].find(i => i.labels?.[0]?.textContent.trim() === 'Link').value");
const shareId = link.split("/s/")[1];
check("link: 22-character unguessable id", shareId.length, 22);

// 3. A family member votes in a separate browser, without an account.
const fam = await launch({ port: 9342 });
const f = ui(fam);
await setViewport(fam, 1366);
await f.goto(link);
await f.waitForText("Tap your favourite.", 20_000);
check("family: two options", await fam.evaluate("document.querySelectorAll('input[name=option]').length"), 2);
check("family: Estimate badge and AI note shown", (await has("Estimate", f)) && (await has("AI illustration. Final decor may differ.", f)), true);
check("family: no account prompt", await has("Create your account", f), false);
await shot("family-vote", [1366, 390], fam);
await fam.evaluate("document.querySelectorAll('input[name=option]')[1].click()");
await f.fill("Your name or relationship (optional)", "SAMPLE Auntie Mei");
await f.fill("A note for the couple (optional)", "SAMPLE note: the garden one feels like you.");
await f.clickButton("Vote for Option B");
await f.waitForText("Thank you! You chose Option B.", 15_000);
await shot("family-thanks", [1366, 390], fam);
check("family: no results shown to voters", await has("% of", f), false);
await f.goto(link);
await f.waitForText("Thank you! You chose Option B.", 15_000);
check("family: after reload, vote is final (choices locked)", await fam.evaluate("document.querySelector('form fieldset').disabled"), true);

// 4. The same identity can't vote twice: the rules refuse a second write.
const anon = await (await fetch(`${AUTH}/accounts:signUp?key=fake-api-key`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) })).json();
const writeVote = (optionIndex) =>
  fetch(`${FS}:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon.idToken}` },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `projects/${PROJECT_ID}/databases/(default)/documents/shares/${shareId}/votes/${anon.localId}`,
            fields: { optionIndex: { integerValue: String(optionIndex) }, name: { stringValue: "" }, note: { stringValue: "" } },
          },
          updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
        },
      ],
    }),
  }).then((r) => r.status);
check("second voter (REST): first vote accepted", await writeVote(0), 200);
check("second voter (REST): changing the vote refused", await writeVote(1), 403);

// 5. The couple sees the results.
await u.goto(`${base}/plans`);
await u.waitForText("SAMPLE Auntie Mei", 20_000);
check("results: 2 votes counted", await has("2 votes"), true);
check("results: voter's note shown", await has("SAMPLE note: the garden one feels like you."), true);
await shot("family-results");

// 6. The couple asks the venue to confirm its part.
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=estimate`);
await u.waitFor("document.querySelector('section[aria-label=\"Total across vendors\"]')", { timeout: 20_000 });
await sleep(1200);
await cdp.evaluate(`(() => {
  const s = document.querySelector('section[aria-label=${JSON.stringify(VENUE)}]');
  [...s.parentElement.querySelectorAll('button')].find(b => b.textContent.trim() === 'Request a confirmed estimate').click();
})()`);
await u.waitFor("document.querySelector('[role=dialog]')");
await u.clickButton("Send request");
check("request: consent required", await cdp.evaluate("document.querySelector('[role=dialog]').innerText.includes('Please agree to share these details.')"), true);
await u.fill("Name for the vendor", "SAMPLE Couple Tan");
await u.fill("Email or phone", "couple.tan@example.test");
await u.fill("Message (optional)", "SAMPLE: could you confirm for a Saturday dinner?");
await u.clickLabel("Share these details and this part of my plan with");
await shot("request-modal", [1366, 390]);
await u.clickButton("Send request");
await u.waitForText("Waiting for SAMPLE Garden Pavilion Co to confirm.", 15_000);
check("request: venue shows waiting", true, true);
check("request: decorator still only an Estimate", await has("Request a confirmed estimate"), true);

// 7. The venue vendor sees the real selections and confirms.
await u.clickButton("Sign out").catch(() => cdp.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Sign out')).click()"));
await sleep(1500);
await u.goto(`${base}/sign-in`);
await u.fill("Email", venueLogin.email);
await u.fill("Password", venueLogin.password);
await u.clickButton("Sign in");
await u.waitForText("SAMPLE Garden Pavilion Co", 20_000);
await u.goto(`${base}/vendor/leads`);
await u.waitForText("SAMPLE Couple Tan", 20_000);
await sleep(1500);
check("leads: today's total for the venue part", await has("$53,955.60"), true);
await shot("vendor-leads");
await u.clickLink("SAMPLE Couple Tan");
await u.waitForText("At today's prices", 20_000);
await sleep(1200);
const detail = await u.text();
check("lead: guests", detail.includes("185"), true);
check("lead: the venue's own chosen items", ["SAMPLE Floral arch", "SAMPLE Table centrepiece", "SAMPLE Chair sash"].every((t) => detail.includes(t)), true);
check("lead: another vendor's items are not shared", detail.includes("SAMPLE Lantern set"), false);
check("lead: contact details", detail.includes("couple.tan@example.test"), true);
check("lead: both saved renders", await cdp.evaluate("[...document.querySelectorAll('img')].filter(i => i.alt.startsWith('AI illustration,')).length"), 2);
await shot("vendor-lead");
await u.clickButton("Confirm estimate");
await u.waitFor("document.querySelector('[role=dialog]')");
const validDefault = await cdp.evaluate("[...document.querySelectorAll('input[type=date]')].find(i => i.labels?.[0]?.textContent.trim() === 'Valid until').value");
const expected = new Date(Date.now() + 14 * 86400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
check("confirm: default valid for 14 days", validDefault, expected);
await u.fill("Note to the couple (optional)", "SAMPLE: holding these prices for you.");
await shot("vendor-confirm-modal", [1366, 390]);
await cdp.evaluate("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Confirm estimate').click()");
await u.waitForText("What you confirmed", 15_000);
check("lead: confirmed", await has("Vendor Confirmed"), true);
await shot("vendor-lead-confirmed");

// 8. The vendor raises a price: confirmed part frozen, live estimate moves.
await u.goto(`${base}/vendor/inventory`);
await u.waitForText("SAMPLE Floral arch", 20_000);
await cdp.evaluate(`[...[...document.querySelectorAll('li')].filter(li => li.innerText.includes('SAMPLE Floral arch')).pop().querySelectorAll('button')].find(b => b.textContent.trim() === 'Edit').click()`);
await u.waitFor("[...document.querySelectorAll('input')].some(i => i.labels?.[0]?.textContent.trim() === 'Price')");
await u.fill("Price", "40000");
await u.clickButton("Save item");
await u.waitForText("$40,000.00", 15_000);
await u.goto(`${base}/vendor/leads`);
await u.waitForText("SAMPLE Couple Tan", 20_000);
await sleep(1500);
check("leads: confirmed row keeps the confirmed total", await has("$53,955.60"), true);

await u.clickButton("Sign out").catch(() => cdp.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Sign out')).click()"));
await sleep(1500);
await u.goto(`${base}/sign-in`);
await u.fill("Email", couple.email);
await u.fill("Password", couple.password);
await u.clickButton("Sign in");
await u.waitFor("location.pathname !== '/sign-in'", { timeout: 20_000 });
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=estimate`);
await u.waitForText("Vendor Confirmed · Valid until", 20_000);
await sleep(1500);
const venueText = await sectionText(VENUE);
check("couple: badge says Vendor Confirmed · Valid until", venueText.includes("Vendor Confirmed · Valid until"), true);
check("couple: confirmed venue total unchanged", await sectionTotal(VENUE), "Total $53,955.60");
check("couple: confirmed line keeps the old price", venueText.includes("$1,200.00"), true);
check("couple: decorator part is still an Estimate", await sectionTotal(DECO), "Estimated total $855.00");
check("couple: combined total unchanged", (await combined())[0], "$54,810.60");
check("couple: summary bar agrees (no today's-price total anywhere)", await has("$65,984.08"), false);
await shot("studio-confirmed");
await u.goto(`${base}/plans`);
await u.waitForText("1 of 2 vendors confirmed", 20_000);
check("my plans: confirmed part counted at its confirmed price", await has("$54,810.60"), true);
await u.clickButton("Create a family link");
await u.waitForText("Choose 2 or 3 renders", 10_000);
await u.waitFor("document.body.innerText.includes(' estimate') && !document.body.innerText.includes('Loading SAMPLE')", { timeout: 15_000 });
await sleep(800);
check("live estimate moved after the price change", await has("$54,810.60 estimate"), false);
await u.clickButton("Cancel");
await u.goto(`${base}/plans/${planId}/print`);
await u.waitFor(`document.body.textContent.includes("Partly vendor confirmed")`, { timeout: 20_000, what: "print heading" });
check("print: venue part confirmed with date", await has("Vendor Confirmed · Valid until"), true);
await shot("print-confirmed", [1366, 390]);

// 9. Turning the link off.
await u.goto(`${base}/plans`);
await u.clickButton("Turn off link");
await u.waitFor("document.querySelector('[role=dialog]')");
await cdp.evaluate("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Turn off').click()");
await u.waitForText("Turned off", 15_000);
await f.goto(link);
await f.waitForText("This link is no longer active", 20_000);
check("revoked: family sees no longer active", true, true);
check("revoked: no renders left on the page", await fam.evaluate("document.querySelectorAll('img[alt^=\"Option\"]').length"), 0);
await shot("link-revoked", [1366, 390], fam);

// 10. The couple deletes their account.
await u.goto(`${base}/account`);
await u.clickButton("Delete account");
await u.fill("Password", couple.password);
await u.clickButton("Delete permanently");
await u.waitFor("location.search.includes('accountDeleted=1')", { timeout: 30_000, what: "account deleted" });
await f.goto(link);
await f.waitForText("This project has been removed", 20_000);
check("deleted: family sees project removed", true, true);
await shot("link-removed", [1366, 390], fam);

console.table(results);
const errors = [...new Set([...cdp.errors, ...fam.errors])];
if (errors.length) console.log("Console errors:\n" + errors.join("\n"));
await fam.close();
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || errors.length ? 1 : 0);

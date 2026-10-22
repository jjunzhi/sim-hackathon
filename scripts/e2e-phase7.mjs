#!/usr/bin/env node
// Phase 7 walkthrough on fresh emulators with SAMPLE seed data.
//  1. An admin creates a pilot invite (scripts/admin.mjs).
//  2. A brand-new decorator opens the link and onboards guided only by the
//     app's "Get set up" checklist: details, where they work, an item with a
//     photo, plan (the invite), publish. Couples then find them in the Studio.
//  3. The pilot ends: the decorator disappears from discovery, with a banner.
//  4. Signed Stripe events: an active subscription lists them again; a failed
//     payment shows the grace banner. Checkout without keys says billing is off.
//  5. A confirmed lead becomes a booking: the vendor marks it, the couple
//     confirms, the statement shows it with a 3% commission set by the admin.
//  6. Feedback from the Help page, and the pilot milestone export.
//
// Usage: npm run emulators (fresh), npm run seed, npm run dev, then
//   node scripts/e2e-phase7.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from "firebase/firestore";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const PROJECT_ID = "demo-weddingvista";
const outDir = process.argv[2] ?? "docs/screenshots/phase7";
const base = "http://localhost:3000";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const WEBHOOK = `http://127.0.0.1:5001/${PROJECT_ID}/asia-southeast1/stripeWebhook`;
const WEBHOOK_SECRET = "whsec_emulator_only_not_a_real_secret"; // functions/.secret.local (emulator only)
const { couple } = JSON.parse(readFileSync("scripts/emulator-test-accounts.json", "utf8"));
const pilot = { email: `pilot.decorator.${Date.now()}@example.test`, password: "Emulator-Only-p7d1" };
mkdirSync(outDir, { recursive: true });

const Stripe = createRequire(join(process.cwd(), "functions/package.json"))("stripe");
const signer = new Stripe("sk_test_signing_only");

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
const readDoc = async (path) => {
  let data = null;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data() ?? null;
  });
  return data;
};
const admin = (...a) => execFileSync(process.execPath, ["scripts/admin.mjs", ...a, "--emulator"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const uidOf = async (email, password) =>
  (await (await fetch(`${AUTH}/accounts:signInWithPassword?key=fake-api-key`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json()).localId;
let seq = 0;
async function stripeEvent(uid, status, createdSec) {
  const event = {
    id: `evt_walkthrough_${Date.now()}_${seq++}`,
    object: "event",
    type: "customer.subscription.updated",
    created: createdSec,
    data: {
      object: {
        id: "sub_walkthrough",
        object: "subscription",
        status,
        customer: "cus_walkthrough",
        cancel_at_period_end: false,
        metadata: { uid },
        items: { object: "list", data: [{ id: "si_w", object: "subscription_item", current_period_end: createdSec + 30 * 86400 }] },
      },
    },
  };
  const payload = JSON.stringify(event);
  const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": signer.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) }, body: payload });
  return res.status;
}

const cdp = await launch({ port: 9361 });
const u = ui(cdp);
const fam = await launch({ port: 9362 }); // a couple browsing, signed out
const f = ui(fam);
const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });
const has = async (t, c = u) => (await c.text()).includes(t);

async function shot(name, widths = [1366, 390], c = cdp) {
  for (const width of widths) {
    await c.evaluate("[...document.querySelectorAll('li[data-state] button[aria-label]')].forEach(b => b.click())");
    await setViewport(c, width);
    await sleep(1600);
    const m = JSON.parse(await c.evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})"));
    writeFileSync(join(outDir, `${name}-${width}.png`), await capture(c, width, m.h));
    if (m.sw > m.cw) results.push({ check: `${name}-${width}: no sideways scroll`, expected: m.cw, actual: m.sw, result: "FAIL" });
  }
  await setViewport(c, 1366);
  await sleep(300);
}
/** Sign out from wherever we are; public pages stay put, guarded ones go home. */
async function signOut() {
  await cdp.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Sign out')).click()");
  await u.waitFor("![...document.querySelectorAll('button')].some(b => b.textContent.includes('Sign out'))", { timeout: 15_000, what: "signed out" });
  await sleep(800);
}
/** Click the checklist's link for a step, as a vendor would. */
async function followStep(title) {
  await u.goto(`${base}/vendor`);
  await u.waitForText("Get set up", 15_000);
  await cdp.evaluate(`[...document.querySelectorAll('ol li')].find(li => li.innerText.includes(${JSON.stringify(title)})).querySelector('a').click()`);
  await sleep(1500);
}
const stepDone = (title) =>
  cdp.evaluate(`(() => { const li = [...document.querySelectorAll('ol li')].find(li => li.innerText.includes(${JSON.stringify(title)})); return li ? li.innerText.includes('(done)') || !li.querySelector('a') : null; })()`);
const decoratorInStudio = async () => {
  await f.goto(`${base}/studio/sample-garden-pavilion`);
  await f.waitForText("Plan your day", 20_000);
  await f.clickButton("Next: Style");
  await f.waitForText("The venue's own decor", 15_000);
  await sleep(2000);
  return has("SAMPLE Pilot Blooms", f);
};

await setViewport(cdp, 1366);
await setViewport(fam, 1366);

// 1. Admin creates a pilot invite.
const link = admin("invite", "--until", "2027-03-31", "--note", "SAMPLE pilot decorator");
check("admin: invite link printed", /\/sign-up\?role=vendor&invite=[A-Za-z0-9_-]{22}$/.test(link), true);

// 2. Cold start: a new decorator follows the link and the checklist.
await u.goto(link);
await u.waitForText("Create your account", 15_000);
check("invite link: vendor role preselected", await cdp.evaluate("document.querySelector('input[name=role][value=vendor]')?.checked"), true);
await u.clickLabel("I agree to how my information is used");
await u.fill("Email", pilot.email);
await u.fill("Password", pilot.password);
await u.clickButton("Create account");
await u.waitForText("Set up your business", 20_000);
await u.clickLabel("Decorator");
await u.fill("Business name", "SAMPLE Pilot Blooms");
await u.clickButton("Continue");
await u.waitForText("Get set up", 20_000);
await u.waitFor(`document.body.innerText.includes("Pilot invite applied")`, { timeout: 15_000, what: "invite redeemed toast" });
check("invite: applied after sign-up", true, true);
const pilotUid = await uidOf(pilot.email, pilot.password);
check("invite: billing pilot until 31 Mar 2027 (SG end of day)", (await readDoc(`billing/${pilotUid}`))?.pilotUntilMs, new Date("2027-03-31T23:59:59.999+08:00").getTime());
await u.waitFor("[...document.querySelectorAll('ol li')].some(li => li.innerText.includes('Plan') && !li.querySelector('a'))", { timeout: 15_000, what: "plan step done" });
check("checklist: plan step done by the invite", await stepDone("Plan"), true);
check("checklist: items step to do", await stepDone("Your decor items"), false);
await shot("vendor-checklist-start");

await followStep("Business details");
check("checklist link: Business page", await cdp.evaluate("location.pathname"), "/vendor/business");
await u.fill("About your business", "SAMPLE florals and lighting for garden weddings.");
await u.clickButton("Save details");
await sleep(1200);

await u.goto(`${base}/vendor`);
await u.waitForText("Get set up", 15_000);
if (await stepDone("Where you work")) {
  check("checklist: 'Where you work' already done (new decorators default to any venue)", true, true);
} else {
  await followStep("Where you work");
  await u.clickLabel("Any venue");
  await u.clickButton("Save venues");
  await sleep(1200);
}

await followStep("Your decor items");
check("checklist link: Inventory", await cdp.evaluate("location.pathname"), "/vendor/inventory");
await u.clickButton("Add an item");
await u.fill("Item name", "SAMPLE Pilot lantern garland");
await u.select("Category", "Lighting");
await u.clickLabel("per table");
await u.fill("Price", "60");
await u.clickButton("Add item");
await u.waitForText("Item added", 10_000);
await u.uploadSamplePhoto("SAMPLE PILOT GARLAND");
await u.clickButton("Cancel");
await sleep(1000);

await followStep("Publish");
await u.clickButton("Publish business");
await u.waitForText("Business published", 10_000);
await u.goto(`${base}/vendor`);
await u.waitForText("Estimate requests", 15_000);
await sleep(1500);
check("checklist: hidden once everything is done", await has("Get set up"), false);
await shot("vendor-overview-done");

check("couples find the new pilot decorator in the Studio", await decoratorInStudio(), true);
await shot("couple-studio-pilot-decorator", [1366], fam);

// Plan page during the pilot; Checkout is off without Stripe keys.
await u.goto(`${base}/vendor/billing`);
await u.waitForText("Your plan", 15_000);
check("billing: pilot badge and date", (await has("Pilot")) && (await has("free until 31 March 2027")), true);
await u.clickButton("Choose the monthly plan");
await u.waitForText("Online payment isn't switched on yet.", 15_000);
check("billing: checkout reports billing is off without keys", true, true);
await shot("vendor-billing-pilot");

// 3. The pilot ends.
admin("extend-pilot", pilotUid, "--until", "2026-01-31");
check("pilot ended: decorator unlisted", (await readDoc(`vendors/${pilotUid}`))?.listed, false);
check("pilot ended: couples no longer find them", await decoratorInStudio(), false);
await u.goto(`${base}/vendor`);
await u.waitForText("Couples can't find your listings because your pilot has ended.", 15_000);
check("pilot ended: banner explains why", true, true);
await shot("vendor-banner-lapsed");
await u.goto(`${base}/vendor/billing`);
await u.waitForText("Not listed", 15_000);
check("billing: lapsed state", await has("Your pilot has ended. Choose the monthly plan to be listed again."), true);
await shot("vendor-billing-lapsed");

// 4. Stripe: subscribed, then a failed payment in its grace period.
const t0 = Math.floor(Date.now() / 1000);
check("webhook: active subscription accepted", await stripeEvent(pilotUid, "active", t0), 200);
await u.waitForText("Active", 15_000);
check("billing: active with renewal date", await has("Your plan renews on"), true);
check("subscribed: listed again", (await readDoc(`vendors/${pilotUid}`))?.listed, true);
check("subscribed: couples find them again", await decoratorInStudio(), true);
await u.goto(`${base}/vendor/billing`);
await u.waitForText("Manage billing", 15_000);
check("billing: one primary action, Manage billing", (await has("Manage billing")) && !(await has("Choose the monthly plan")), true);
await shot("vendor-billing-active");
check("webhook: past_due accepted", await stripeEvent(pilotUid, "past_due", t0 + 5), 200);
await u.waitForText("Payment issue", 15_000);
check("grace: still listed", (await readDoc(`vendors/${pilotUid}`))?.listed, true);
await u.goto(`${base}/vendor`);
await u.waitForText("Your last payment didn't go through.", 15_000);
check("grace: banner with the date", true, true);
await shot("vendor-banner-grace");
await stripeEvent(pilotUid, "active", t0 + 10);

// 5. A confirmed lead becomes a booking (couple and venue owner).
await signOut();
admin("set-commission", VENUE_OWNER, "300");
await u.goto(`${base}/studio/sample-garden-pavilion`);
await u.waitForText("Plan your day", 20_000);
await u.setSlider("Guests", 185);
await u.clickButton("Next: Style");
await u.waitForText("The venue's own decor", 15_000);
for (const item of ["SAMPLE Floral arch", "SAMPLE Table centrepiece", "SAMPLE Chair sash"]) await u.clickLabel(item);
await u.clickButton("Next: Render");
await u.clickButton("Next: Estimate");
await u.waitFor("document.querySelector('section[aria-label=\"SAMPLE Garden Pavilion Co\"]') || document.querySelector('section[aria-label=\"Total across vendors\"]')", { timeout: 15_000 });
await u.clickButton("Save your plan");
await u.waitForText("Create your account", 15_000);
await u.clickLabel("I agree to how my information is used");
await u.fill("Email", couple.email);
await u.fill("Password", couple.password);
await u.clickButton("Create account");
await u.waitFor("location.search.includes('plan=')", { timeout: 30_000, what: "plan saved" });
await u.waitForText("Saved", 15_000);
const planId = new URL(await cdp.evaluate("location.href")).searchParams.get("plan");
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=estimate`);
await u.waitForText("Request a confirmed estimate", 20_000);
await u.clickButton("Request a confirmed estimate");
await u.waitFor("document.querySelector('[role=dialog]')");
await u.fill("Name for the vendor", "SAMPLE Couple Lim");
await u.fill("Email or phone", "couple.lim@example.test");
await u.fill("Wedding date (optional)", "2027-05-22");
await u.clickLabel("Share these details and this part of my plan with");
await u.clickButton("Send request");
await u.waitForText("Waiting for SAMPLE Garden Pavilion Co to confirm.", 15_000);
await signOut();

await u.goto(`${base}/sign-in`);
await u.fill("Email", venueLogin.email);
await u.fill("Password", venueLogin.password);
await u.clickButton("Sign in");
await u.waitForText("SAMPLE Garden Pavilion Co", 20_000);
await u.goto(`${base}/vendor/leads`);
await u.clickLink("SAMPLE Couple Lim");
await u.waitForText("At today's prices", 20_000);
await u.clickButton("Confirm estimate");
await u.waitFor("document.querySelector('[role=dialog]')");
await cdp.evaluate("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Confirm estimate').click()");
await u.waitForText("Did this couple book with you?", 15_000);
await u.clickButton("Mark as booked");
await u.waitFor("document.querySelector('[role=dialog]')");
check("booking: event date suggested from the request", await cdp.evaluate("[...document.querySelectorAll('input[type=date]')].find(i => i.labels?.[0]?.textContent.trim() === 'Event date')?.value"), "2027-05-22");
await u.fill("Booked value (optional)", "54810.60");
await shot("vendor-booking-modal");
await cdp.evaluate("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Record booking').click()");
await u.waitForText("Waiting for the couple", 15_000);
check("booking: claimed", true, true);
await shot("vendor-booking-claimed");
await signOut();

await u.goto(`${base}/sign-in`);
await u.fill("Email", couple.email);
await u.fill("Password", couple.password);
await u.clickButton("Sign in");
await u.waitFor("location.pathname !== '/sign-in'", { timeout: 20_000 });
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=estimate`);
await u.waitForText("says you booked with them for 22 May 2027, for $54,810.60.", 20_000);
check("couple: sees the booking claim under the vendor", true, true);
await shot("couple-booking-claim");
await u.clickButton("Yes, we booked");
await u.waitForText("Booked with SAMPLE Garden Pavilion Co for 22 May 2027.", 15_000);
check("couple: confirmed the booking", true, true);
await signOut();

await u.goto(`${base}/sign-in`);
await u.fill("Email", venueLogin.email);
await u.fill("Password", venueLogin.password);
await u.clickButton("Sign in");
await u.waitForText("SAMPLE Garden Pavilion Co", 20_000);
await u.goto(`${base}/vendor/billing`);
await u.waitForText("May 2027", 15_000);
check("statement: booked value", await has("$54,810.60"), true);
// 3% of $54,810.60 = $1,644.318 -> $1,644.32 (half-up)
check("statement: 3% commission, half-up", await has("$1,644.32"), true);
await shot("vendor-billing-statement");

// 6. Help and feedback; the pilot export.
await u.goto(`${base}/vendor/help`);
await u.waitForText("What confirming an estimate commits you to", 15_000);
await shot("vendor-help");
await u.clickButton("Send feedback");
await u.waitFor("document.querySelector('[role=dialog]')");
await u.fill("Your feedback", "SAMPLE: the setup checklist made it clear what to do next.");
await cdp.evaluate("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Send').click()");
await u.waitForText("Thank you. We read every message.", 10_000);
let feedback = [];
await env.withSecurityRulesDisabled(async (ctx) => {
  feedback = (await getDocs(collection(ctx.firestore(), "feedback"))).docs.map((d) => d.data());
});
check("feedback: stored with uid, text and page only", feedback.length === 1 && Object.keys(feedback[0]).sort().join(",") === "createdAt,page,text,uid" && feedback[0].page === "/vendor/help", true);

const csv = admin("export-pilot");
const row = csv.split("\n").find((l) => l.startsWith(pilotUid));
check("export: pilot decorator row", !!row, true);
check("export: invited, published, listed, active", !!row && row.includes(",yes,") && /,yes,yes,active,/.test(row), true);
check("export: no couple contact data", csv.includes("couple.lim@example.test") || csv.includes("SAMPLE Couple Lim"), false);
writeFileSync(join(outDir, "export-pilot.csv"), csv + "\n");

console.table(results);
const errors = [...new Set([...cdp.errors, ...fam.errors])];
if (errors.length) console.log("Console errors:\n" + errors.join("\n"));
await env.cleanup();
await fam.close();
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || errors.length ? 1 : 0);

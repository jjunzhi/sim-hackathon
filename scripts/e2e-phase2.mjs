#!/usr/bin/env node
// Phase 2 walkthrough through the real UI against the local emulators:
// decorator sign-up and onboarding, inventory, a package, publishing, and the
// estimate preview checked against docs/estimate-examples.md. Saves
// screenshots of each screen at 390 and 1366px.
//
// Usage (emulators + dev server running, fresh emulator data):
//   node scripts/e2e-phase2.mjs [outDir=docs/screenshots/phase2]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const outDir = process.argv[2] ?? "docs/screenshots/phase2";
const base = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const { decorator } = JSON.parse(readFileSync("scripts/emulator-test-accounts.json", "utf8"));
mkdirSync(outDir, { recursive: true });

const cdp = await launch({ port: 9337 });
const u = ui(cdp);
const results = [];
const check = (name, actual, expected) => {
  const pass = actual === expected;
  results.push({ check: name, expected, actual, result: pass ? "PASS" : "FAIL" });
};

async function shot(name, width) {
  // Clear toasts and let number animations settle so captures show final values.
  await cdp.evaluate("[...document.querySelectorAll('button[aria-label=Dismiss]')].forEach(b => b.click())");
  await setViewport(cdp, width);
  await sleep(1800);
  const m = JSON.parse(await cdp.evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})"));
  writeFileSync(join(outDir, `${name}-${width}.png`), await capture(cdp, width, m.h));
  if (m.sw > m.cw) results.push({ check: `${name}-${width} no sideways scroll`, expected: m.cw, actual: m.sw, result: "FAIL" });
}

// Final (non-animated) value of an estimate row, read from its screen-reader text.
const amount = (labelStart) =>
  cdp.evaluate(`(() => {
    const dt = [...document.querySelectorAll('section[aria-label=Estimate] dt')].find(d => d.textContent.trim().startsWith(${JSON.stringify(labelStart)}));
    return dt?.closest('div')?.querySelector('dd .sr-only')?.textContent ?? null;
  })()`);
const total = () => cdp.evaluate("document.querySelector('section[aria-label=Estimate] [aria-live]')?.textContent ?? null");
const perGuest = () =>
  cdp.evaluate("[...document.querySelectorAll('section[aria-label=Estimate] .sr-only')].map(e => e.textContent).find((t, i, all) => i === all.length - 2) ?? null");

await setViewport(cdp, 1366);

// 1. Sign up as a vendor.
await u.goto(`${base}/sign-up?role=vendor`);
await u.clickLabel("I agree to how my information is used");
await u.fill("Email", decorator.email);
await u.fill("Password", decorator.password);
await u.clickButton("Create account");
await u.waitForText("Set up your business", 20_000);
await shot("business-setup", 1366);
await shot("business-setup", 390);
await setViewport(cdp, 1366);

// 2. Decorator onboarding: validation first, then the real thing.
await u.clickButton("Continue");
await u.waitForText("Choose at least one");
check("setup: asks for a kind and a name", await cdp.evaluate("document.body.innerText.includes('Add your business name.')"), true);
await u.clickLabel("Decorator");
await u.fill("Business name", "SAMPLE Petal & Lantern");
await u.clickButton("Continue");
await u.waitForText("Not published yet", 15_000);

// 3. Inventory: three items, one with a photo.
await u.goto(`${base}/vendor/inventory`);
await u.waitForText("No items yet");
await shot("inventory-empty", 1366);
await setViewport(cdp, 1366);
await u.clickButton("Add an item");
await u.fill("Item name", "SAMPLE Floral arch");
await u.fill("Price", "1,200");
await u.clickButton("Add item");
await u.waitForText("Item added");
await u.uploadSamplePhoto("SAMPLE FLORAL ARCH");
await u.clickButton("Cancel");

await u.clickButton("Add an item");
await u.fill("Item name", "SAMPLE Table centrepiece");
await u.select("Category", "Table decor");
await u.clickLabel("per table");
await u.fill("Price", "88");
await u.clickButton("Add item");
await u.waitForText("Item added");
await u.clickButton("Cancel");

await u.clickButton("Add an item");
await u.fill("Item name", "SAMPLE Chair sash");
await u.select("Category", "Draping");
await u.clickLabel("per guest");
await u.fill("Price", "3.5");
await u.clickButton("Add item");
await u.waitForText("Item added");
await u.clickButton("Cancel");
await u.waitForText("Showing 3 of 3");
check("inventory: 3 items listed", (await u.text()).includes("Showing 3 of 3"), true);
await u.clickLabel("Draping");
check("inventory: category filter", (await u.text()).includes("Showing 1 of 3"), true);
await u.clickLabel("All");
await shot("inventory", 1366);
await shot("inventory", 390);
await setViewport(cdp, 1366);

// 4. A package that includes the centrepiece.
await u.goto(`${base}/vendor/packages`);
await u.clickButton("Add a package");
await u.fill("Package name", "SAMPLE Garden package");
await u.clickLabel("SAMPLE Table centrepiece");
await u.fill("Package price", "250");
await u.clickButton("Add package");
await u.waitForText("Includes SAMPLE Table centrepiece");
await shot("packages", 1366);
await shot("packages", 390);
await setViewport(cdp, 1366);

// 5. Publish the business.
await u.goto(`${base}/vendor/business`);
await u.clickButton("Publish business");
await u.waitForText("Business published");
await shot("business", 1366);
await shot("business", 390);
await setViewport(cdp, 1366);

// 6. Estimate preview, decor only, 185 guests (hand-calculated).
await u.goto(`${base}/vendor/estimate-preview`);
await u.waitForText("Decor only");
await u.setSlider("Guests", 185);
await u.clickLabel("SAMPLE Floral arch");
await u.clickLabel("SAMPLE Table centrepiece");
await u.clickLabel("SAMPLE Chair sash");
await sleep(600);
check("decor: centrepiece 19 tables", await amount("SAMPLE Table centrepiece"), "$1,672.00");
check("decor: sashes 185 guests", await amount("SAMPLE Chair sash"), "$647.50");
// Example I in docs/estimate-examples.md.
check("decor: subtotal", await amount("Subtotal"), "$3,519.50");
check("decor: service charge 10%", await amount("Service charge"), "$351.95");
check("decor: GST 9%", await amount("GST"), "$348.43");
check("decor: total", await total(), "Estimated total $4,219.88");
check("decor: per guest", await perGuest(), "$22.81");
await shot("estimate-preview", 1366);
await shot("estimate-preview", 390);
await setViewport(cdp, 1366);

// Package replaces the centrepiece; it can't be double-counted.
await u.clickLabel("SAMPLE Garden package");
await sleep(600);
check("package: centrepiece now disabled", await cdp.evaluate("[...document.querySelectorAll('[role=checkbox]')].find(c => c.labels?.[0]?.textContent === 'SAMPLE Table centrepiece')?.disabled"), true);
check("package: 19 tables x $250", await amount("SAMPLE Garden package"), "$4,750.00");
check("package: total", await total(), "Estimated total $7,910.40");

// 7. Become a venue too, with SAMPLE venue data seeded directly (as an admin would).
await u.goto(`${base}/vendor/business`);
await u.clickLabel("Venue");
await u.clickButton("Save details");
await u.waitForText("Details saved");
const uidOf = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-weddingvista/accounts:query", {
  method: "POST",
  headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
  body: "{}",
}).then((r) => r.json());
const uid = uidOf.userInfo.find((x) => x.email === decorator.email).localId;
const env = await initializeTestEnvironment({ projectId: "demo-weddingvista", firestore: { host: "127.0.0.1", port: 8080 } });
const t = Timestamp.now();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "venues/pav"), {
    ownerUid: uid, status: "active", verified: false, name: "SAMPLE Pavilion", address: "1 Sample Road", postalCode: "123456",
    description: "", styleTags: [], cultureTags: [], wheelchairAccess: true, liftAccess: true, coverPhoto: null, createdAt: t, updatedAt: t,
  });
  await setDoc(doc(db, "venues/pav/spaces/ball"), {
    name: "SAMPLE Ballroom", capacityMin: 80, capacityMax: 250, seatsPerTable: 10,
    tiers: { peak: { roomRentalCents: 1_200_000, minimumSpendCents: 4_500_050 }, offPeak: { roomRentalCents: 650_000, minimumSpendCents: null } },
    photo: null, photoVersion: 0, sortOrder: 0, createdAt: t, updatedAt: t,
  });
});
await env.cleanup();

// Examples B and C in the UI.
await u.goto(`${base}/vendor/estimate-preview`);
await u.waitFor("[...document.querySelectorAll('[role=combobox]')].length > 0");
await u.select("Room", "SAMPLE Pavilion: SAMPLE Ballroom");
await u.setSlider("Guests", 185);
await u.clickLabel("SAMPLE Floral arch");
await u.clickLabel("SAMPLE Table centrepiece");
await u.clickLabel("SAMPLE Chair sash");
await sleep(600);
check("B: Peak rental", await amount("Room rental"), "$12,000.00");
check("B: minimum spend shortfall line", await amount("Minimum spend shortfall"), "$29,481.00");
check("B: subtotal unchanged by minimum", await amount("Subtotal"), "$15,519.50");
check("B: total", await total(), "Estimated total $53,955.60");
await shot("estimate-preview-minimum", 1366);
await u.select("Pricing", "Off-Peak");
await sleep(600);
check("C: Off-Peak, no shortfall", await amount("Minimum spend shortfall"), null);
check("C: total", await total(), "Estimated total $12,013.38");

// Overview after everything.
await u.goto(`${base}/vendor`);
await u.waitForText("SAMPLE Petal & Lantern");
await shot("overview", 1366);
await shot("overview", 390);

console.table(results);
if (cdp.errors.length) console.log("Console errors:\n" + [...new Set(cdp.errors)].join("\n"));
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || cdp.errors.length ? 1 : 0);

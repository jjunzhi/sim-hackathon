#!/usr/bin/env node
// Phase 3 walkthrough (DEMO mode, local emulators): a vendor renders a SAMPLE
// room, changes theme, switches back (cache hit), and checks usage. Saves
// screenshots to docs/screenshots/phase3.
//
// Usage (fresh `npm run emulators` + `npm run dev`): node scripts/e2e-phase3.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

// sharp is a dependency of the functions package; resolve it from there.
const sharpEntry = createRequire(join(process.cwd(), "functions/package.json")).resolve("sharp");
const sharp = (await import(pathToFileURL(sharpEntry).href)).default;
const outDir = process.argv[2] ?? "docs/screenshots/phase3";
const base = "http://localhost:3000";
const { vendor } = JSON.parse(readFileSync("scripts/emulator-test-accounts.json", "utf8"));
mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });

// ---- seed a SAMPLE venue owned by the test vendor ----
const signUp = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: vendor.email, password: vendor.password, returnSecureToken: true }),
}).then((r) => r.json());
const uid = signUp.localId;
const env = await initializeTestEnvironment({
  projectId: "demo-weddingvista",
  firestore: { host: "127.0.0.1", port: 8080 },
  storage: { host: "127.0.0.1", port: 9199 },
});
const t = Timestamp.now();
const room = await sharp(readFileSync("public/samples/hall-before.svg")).resize(2048, 1536).jpeg({ quality: 85 }).toBuffer();
const swatch = (hex, label) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#f4ece6"/><circle cx="300" cy="200" r="140" fill="${hex}"/><text x="300" y="410" font-family="Arial" font-size="34" text-anchor="middle" fill="#2a2325">${label}</text></svg>`))
    .webp()
    .toBuffer();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const st = ctx.storage("gs://demo-weddingvista.appspot.com");
  await setDoc(doc(db, `users/${uid}`), { role: "vendor", consent: { version: "draft", acceptedAt: t }, createdAt: t });
  await setDoc(doc(db, `vendors/${uid}`), {
    kinds: ["venue"], businessName: "SAMPLE Garden Pavilion Co", description: "", servesAnyVenue: true, servesVenueIds: [], published: true,
    tax: { serviceChargeBps: 1000, gstBps: 900, noServiceChargeNote: "", noGstNote: "" }, createdAt: t, updatedAt: t,
  });
  await setDoc(doc(db, "venues/pav"), {
    ownerUid: uid, status: "active", verified: false, name: "SAMPLE Pavilion", address: "1 Sample Road", postalCode: "123456",
    description: "", styleTags: [], cultureTags: [], wheelchairAccess: true, liftAccess: true, coverPhoto: null, createdAt: t, updatedAt: t,
  });
  await uploadBytes(ref(st, "venues/pav/spaces/ball/room1.jpg"), room, { contentType: "image/jpeg" });
  await setDoc(doc(db, "venues/pav/spaces/ball"), {
    name: "SAMPLE Ballroom", capacityMin: 80, capacityMax: 250, seatsPerTable: 10,
    tiers: { standard: { roomRentalCents: 800_000, minimumSpendCents: null } },
    photo: { path: "venues/pav/spaces/ball/room1.jpg", width: 2048, height: 1536, contentType: "image/jpeg" },
    photoVersion: 1, sortOrder: 0, createdAt: t, updatedAt: t,
  });
  for (const [id, name, hex, unit, price] of [["arch", "SAMPLE Floral arch", "#b84c60", "piece", 120_000], ["lanterns", "SAMPLE Lantern set", "#b8935a", "table", 4_500]]) {
    await uploadBytes(ref(st, `vendors/${uid}/items/${id}/p1.webp`), await swatch(hex, name), { contentType: "image/webp" });
    await setDoc(doc(db, `vendors/${uid}/items/${id}`), {
      name, category: "Florals", unit, priceCents: price, description: "", active: true,
      photo: { path: `vendors/${uid}/items/${id}/p1.webp`, width: 600, height: 450, contentType: "image/webp" }, createdAt: t, updatedAt: t,
    });
  }
});
await env.cleanup();

// ---- drive the UI ----
const cdp = await launch({ port: 9338 });
const u = ui(cdp);
async function shot(name, width) {
  await cdp.evaluate("[...document.querySelectorAll('button[aria-label=Dismiss]')].forEach(b => b.click())");
  await setViewport(cdp, width);
  await sleep(1500);
  const m = JSON.parse(await cdp.evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})"));
  writeFileSync(join(outDir, `${name}-${width}.png`), await capture(cdp, width, m.h));
  if (m.sw > m.cw) results.push({ check: `${name}-${width} no sideways scroll`, expected: m.cw, actual: m.sw, result: "FAIL" });
}
// During the cross-fade the outgoing and incoming images are both present, so pick by theme.
const renderImg = (theme) =>
  cdp.evaluate(`[...document.querySelectorAll('img')].find(i => i.alt.startsWith('AI illustration') && i.alt.includes(${JSON.stringify(theme)}))?.src ?? null`);
const detailsText = () => cdp.evaluate("document.querySelector('dl[id]')?.innerText ?? ''");
const live = () => cdp.evaluate("[...document.querySelectorAll('[aria-live=polite]')].map(e => e.textContent).join(' | ')");

await setViewport(cdp, 1366);
await u.goto(`${base}/sign-in`);
await u.fill("Email", vendor.email);
await u.fill("Password", vendor.password);
await u.clickButton("Sign in");
await u.waitForText("SAMPLE Garden Pavilion Co", 20_000);

await u.goto(`${base}/vendor/estimate-preview`);
await u.waitFor("[...document.querySelectorAll('[role=option],[role=combobox]')].length > 0");
check("decor-only: render explains it needs a room", (await u.text()).includes("Choose a room to render it decorated."), true);
await u.select("Room", "SAMPLE Pavilion: SAMPLE Ballroom");
await u.clickLabel("SAMPLE Floral arch");
await u.clickLabel("SAMPLE Lantern set");
await u.select("Theme", "Peranakan");

// 1. First render, with a slow network so the loading state can be seen and captured.
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 3000, downloadThroughput: -1, uploadThroughput: -1 });
await u.clickButton("Show it decorated");
await u.waitForText("Decorating your room...");
check("loading: calm text shown", (await u.text()).includes("Decorating your room..."), true);
check("loading: announced to screen readers", (await live()).includes("Decorating your room."), true);
await shot("render-loading", 1366);
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await u.waitFor("[...document.querySelectorAll('img')].some(i => i.alt.startsWith('AI illustration') && i.complete && i.naturalWidth > 0)", { timeout: 30_000 });
check("done: render ready announced", (await live()).includes("Render ready."), true);
check("done: AI illustration note", (await u.text()).includes("AI illustration. Final decor may differ."), true);
check("done: DEMO badge", (await u.text()).includes("DEMO: not an AI render"), true);
const first = await renderImg("Peranakan");
await u.clickButton("Visualization details");
check("details: used 1 render", (await detailsText()).includes("Used 1 render from your allowance"), true);
await shot("render-done", 1366);
await shot("render-done", 390);
await setViewport(cdp, 1366);

// 2. Change the theme: the panel says so, and a new render is made.
await u.select("Theme", "Chinese");
check("stale: change notice", (await u.text()).includes("Your theme or items changed. Render again to see them."), true);
await u.clickButton("Render again");
await u.waitFor(`[...document.querySelectorAll('img')].some(i => i.alt.startsWith('AI illustration') && i.alt.includes('Chinese') && i.complete && i.naturalWidth > 0)`, { timeout: 30_000 });
const second = await renderImg("Chinese");
check("new theme: different render image", second !== first, true);

// 3. Back to Peranakan: same image as before, from the cache.
await u.select("Theme", "Peranakan");
await u.clickButton("Render again");
await u.waitFor(`[...document.querySelectorAll('img')].some(i => i.alt.startsWith('AI illustration') && i.alt.includes('Peranakan') && i.complete)`, { timeout: 30_000 });
const key = (url) => url?.match(/renders%2F([0-9a-f]{64})/)?.[1] ?? null;
check("back: same render as the first", key(await renderImg("Peranakan")), key(first));
if (!(await cdp.evaluate("!!document.querySelector('dl[id]')"))) await u.clickButton("Visualization details");
check("back: reused, no allowance used", (await detailsText()).includes("Reused a saved render"), true);

// Usage on the Overview: 2 new renders, the cache hit didn't count.
await u.goto(`${base}/vendor`);
await u.waitForText("AI renders this month");
await u.waitFor("document.body.innerText.includes('2 of 300')", { timeout: 10_000 });
check("overview: usage 2 of 300", (await u.text()).includes("2 of 300"), true);
await shot("overview-usage", 1366);
await shot("overview-usage", 390);

console.table(results);
if (cdp.errors.length) console.log("Console errors:\n" + [...new Set(cdp.errors)].join("\n"));
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || cdp.errors.length ? 1 : 0);

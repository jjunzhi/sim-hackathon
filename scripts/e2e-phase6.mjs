#!/usr/bin/env node
// Phase 6 walkthrough on fresh emulators with SAMPLE seed data:
// languages (menu, <html lang>, fonts, draft note, no raw keys, profile sync),
// access and menu filters, the venue page (access, menus, MUIS link, map
// fallback, booked dates), the Studio (wedding date clash warning, dietary
// filter, .ics download), ritual checklists (ticks and own items persist),
// vendor booked dates and dietary tags. Key screens in all four languages.
//
// Usage: npm run emulators (fresh), npm run seed, npm run dev, then
//   node scripts/e2e-phase6.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { capture, launch, setViewport, sleep } from "./lib/cdp.mjs";
import { ui } from "./lib/ui.mjs";

const PROJECT_ID = "demo-weddingvista";
const outDir = process.argv[2] ?? "docs/screenshots/phase6";
const base = "http://localhost:3000";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const { couple } = JSON.parse(readFileSync("scripts/emulator-test-accounts.json", "utf8"));
mkdirSync(outDir, { recursive: true });

const LANGS = { en: "en-SG", zh: "zh-Hans-SG", ms: "ms-SG", ta: "ta-SG" };

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

const cdp = await launch({ port: 9343 });
const u = ui(cdp);
const results = [];
const check = (name, actual, expected) => results.push({ check: name, expected, actual, result: actual === expected ? "PASS" : "FAIL" });
const has = async (t, c = u) => (await c.text()).includes(t);
const bodyHas = (t, c = cdp) => c.evaluate(`document.body.innerText.includes(${JSON.stringify(t)})`);

async function shot(name, widths = [1366, 390], c = cdp) {
  for (const width of widths) {
    // Close any toasts first (their Dismiss label is translated, so find them by structure).
    await c.evaluate("[...document.querySelectorAll('li[data-state] button[aria-label]')].forEach(b => b.tagName === 'BUTTON' && b.click())");
    await setViewport(c, width);
    await sleep(1600);
    const m = JSON.parse(await c.evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})"));
    writeFileSync(join(outDir, `${name}-${width}.png`), await capture(c, width, m.h));
    if (m.sw > m.cw) results.push({ check: `${name}-${width}: no sideways scroll`, expected: m.cw, actual: m.sw, result: "FAIL" });
    // Phone bottom navigation: a label wider than its slot overlaps its neighbour without scrolling the page.
    const crowded = await c.evaluate("[...document.querySelectorAll('nav.fixed li a')].filter(a => a.offsetParent && a.scrollWidth > a.clientWidth + 1).map(a => a.textContent.trim())");
    if (crowded.length) results.push({ check: `${name}-${width}: bottom nav labels fit`, expected: "", actual: crowded.join(" | "), result: "FAIL" });
  }
  await setViewport(c, 1366);
  await sleep(300);
}

// A raw dictionary key on screen means a missing translation or a typo in a key.
const KEY_RE = /\b(?:common|nav|badge|render|money|guests|tables|access|diet|error|ui|landing|auth|catalog|tag|tier|studio|unit|theme|estimate|plans|print|sharing|vote|checklists|ritual|filters|venue|map|date|lang)\.[a-z][A-Za-z]*(?:\.[A-Za-z]+)*\b/g;
async function noRawKeys(label, c = cdp) {
  const text = await c.evaluate("document.body.innerText + ' ' + [...document.querySelectorAll('[aria-label],[alt],[title],[placeholder]')].map(e => [e.getAttribute('aria-label'), e.getAttribute('alt'), e.getAttribute('title'), e.getAttribute('placeholder')].join(' ')).join(' ')");
  const found = [...new Set(text.match(KEY_RE) ?? [])].filter((k) => !/@|example\.test|\.(?:com|sg|jpg|webp|ics)$/.test(k));
  check(`${label}: no raw keys`, found.join(", "), "");
}

/** Pick a language through the real menu (Radix opens on pointer down, so use real mouse events). */
async function chooseLanguage(c, code) {
  const rect = JSON.parse(await c.evaluate("JSON.stringify(document.querySelector('button[aria-haspopup=menu]').getBoundingClientRect())"));
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  const f = ui(c);
  await f.waitFor(`document.querySelector('[role=menuitemradio][lang="${LANGS[code]}"]')`, { what: `language ${code} in menu` });
  await c.evaluate(`document.querySelector('[role=menuitemradio][lang="${LANGS[code]}"]').click()`);
  await f.waitFor(`document.documentElement.lang === "${LANGS[code]}"`, { what: `html lang ${LANGS[code]}` });
  await sleep(1200); // dictionary load and font swap
}
/** Faster switch for screenshots: set the stored choice, then reload. */
async function setLanguage(c, code) {
  await c.evaluate(`localStorage.setItem('wv-locale', '${code}')`);
  await c.send("Page.reload");
  await ui(c).waitFor(`document.documentElement.lang === "${LANGS[code]}"`, { timeout: 15_000, what: `html lang ${LANGS[code]}` });
  await sleep(1500);
}

await setViewport(cdp, 1366);

// 1. Landing in all four languages, through the menu.
await u.goto(`${base}/`);
await u.waitForText("Find a venue", 15_000);
check("landing en: html lang", await cdp.evaluate("document.documentElement.lang"), "en-SG");
check("landing en: no draft note", await bodyHas("translation is a draft"), false);
await shot("landing-en");
for (const code of ["zh", "ms", "ta"]) {
  await chooseLanguage(cdp, code);
  check(`landing ${code}: html lang`, await cdp.evaluate("document.documentElement.lang"), LANGS[code]);
  check(`landing ${code}: data-locale`, await cdp.evaluate("document.documentElement.dataset.locale"), code);
  check(`landing ${code}: English headline gone`, await bodyHas("See your venue decorated, with honest prices."), false);
  check(`landing ${code}: draft note shown`, await cdp.evaluate("!!document.querySelector('[role=note]')"), true);
  await noRawKeys(`landing ${code}`);
  if (code !== "en") {
    const font = await cdp.evaluate("getComputedStyle(document.body).fontFamily");
    check(`landing ${code}: script font`, code === "zh" ? /noto.?sans.?sc/i.test(font) : code === "ta" ? /noto.?sans.?tamil/i.test(font) : /jakarta/i.test(font), true);
  }
  await shot(`landing-${code}`);
}
await chooseLanguage(cdp, "en");
check("back to English", await bodyHas("Find a venue"), true);

// 2. Catalog: Phase 6 access and menu filters.
await u.goto(`${base}/venues`);
await u.waitForText("3 venues", 20_000);
await u.clickLabel("Accessible toilet");
await sleep(400);
check("filter: accessible toilet = 2 venues", await has("2 venues"), true);
await u.clickLabel("Accessible parking");
await sleep(400);
check("filter: + accessible parking = 1 venue", await has("1 venue"), true);
await u.clickButton("Clear");
await sleep(300);
await u.clickLabel("Halal");
await sleep(400);
check("filter: halal menus = 1 venue", await has("1 venue"), true);
check("filter: the halal venue is Garden Pavilion", await has("SAMPLE Garden Pavilion"), true);
await u.clickLabel("Vegan");
await sleep(400);
check("filter: halal + vegan = none", await has("No venues match all of these"), true);
await u.clickButton("Clear");
await sleep(300);
await shot("catalog-en");

// 3. Venue page: access, menus, MUIS link, map links, booked dates.
await u.goto(`${base}/venues/sample-garden-pavilion`);
await u.waitForText("Rooms", 15_000);
await sleep(1500);
check("venue: accessible toilet listed", await has("Accessible toilet"), true);
check("venue: menus listed", (await has("Halal")) && (await has("Vegetarian")) && (await has("No beef")), true);
check("venue: MUIS link", await cdp.evaluate("!!document.querySelector('a[href=\"https://halal.muis.gov.sg/halal/establishments\"]')"), true);
check("venue: no map placeholder without a key", await has("The map preview isn't set up here."), false);
check("venue: Google Maps link", await cdp.evaluate("[...document.querySelectorAll('a')].some(a => a.href.startsWith('https://www.google.com/maps/search/?api=1&query=') && a.target === '_blank')"), true);
check("venue: booked dates listed", (await has("15 May 2027")) && (await has("12 Jun 2027")), true);
check("venue: vendor-statement wording", await has("As stated by the vendor."), true);
await shot("venue-en");
await u.goto(`${base}/venues/sample-heritage-shophouse`);
await u.waitForText("Rooms", 15_000);
check("venue without new fields: not listed, not 'no'", await has("Accessible toilet: not listed"), true);
check("venue without menus", await has("No dietary options listed"), true);

// 4. Studio: wedding date clash, dietary filter.
await u.goto(`${base}/studio/sample-garden-pavilion`);
await u.waitForText("Plan your day", 20_000);
await u.setSlider("Guests", 185);
await u.fill("Wedding date (optional)", "2027-05-15");
await u.waitForText("The venue says 15 May 2027 is already booked.", 5_000);
check("studio: booked-date warning", true, true);
await u.fill("Wedding date (optional)", "2027-05-22");
await sleep(400);
check("studio: free date, no warning", await has("is already booked"), false);
await shot("studio-venue-date");
await u.clickButton("Next: Style");
await u.waitForText("The venue's own decor", 15_000);
check("studio: food listed", (await has("SAMPLE Halal banquet menu")) && (await has("SAMPLE Vegetarian banquet menu")), true);
await u.clickLabel("Halal");
await sleep(400);
check("studio diet: halal kept", await has("SAMPLE Halal banquet menu"), true);
check("studio diet: vegetarian menu hidden", await has("SAMPLE Vegetarian banquet menu"), false);
check("studio diet: decor never hidden", await has("SAMPLE Floral arch"), true);
check("studio diet: hidden count", await has("1 food item hidden by your filter."), true);
await shot("studio-style-diet");
await u.clickLabel("Halal");
for (const item of ["SAMPLE Floral arch", "SAMPLE Table centrepiece", "SAMPLE Chair sash", "SAMPLE Lantern set"]) await u.clickLabel(item);
await u.clickButton("Next: Render");
await u.clickButton("Next: Estimate");
await u.waitFor("document.querySelector('section[aria-label=\"Total across vendors\"]')", { timeout: 15_000 });

// 5. Save (sign up); the date survives; Add to calendar.
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
check("plan: wedding date saved", (await readDoc(`projects/${planId}`))?.weddingDate, "2027-05-22");
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=estimate`);
await u.waitForText("Add to calendar", 20_000);
await cdp.evaluate(`(() => {
  const orig = URL.createObjectURL;
  URL.createObjectURL = (blob) => { blob.text().then((t) => { window.__ics = t; }); return orig.call(URL, blob); };
  HTMLAnchorElement.prototype.click = function () { window.__icsName = this.download; };
})()`);
await u.clickButton("Add to calendar");
await u.waitFor("window.__ics", { what: ".ics generated" });
const ics = await cdp.evaluate("window.__ics");
check("ics: all-day on the wedding date", ics.includes("DTSTART;VALUE=DATE:20270522"), true);
check("ics: ends the next day", ics.includes("DTEND;VALUE=DATE:20270523"), true);
check("ics: stable UID per plan", ics.includes(`UID:plan-${planId}@weddingvista`), true);
check("ics: location", ics.includes("LOCATION:SAMPLE Garden Pavilion\\, 1 Sample Garden Road"), true);
check("ics: CRLF line endings", ics.includes("\r\n") && !/[^\r]\n/.test(ics), true);
check("ics: file name", await cdp.evaluate("window.__icsName"), "SAMPLE Garden Pavilion plan.ics");
await shot("studio-estimate-calendar");

// Two saved renders and a family link, for the vote page screenshots.
async function renderAndSave(count) {
  await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=render`);
  await u.clickButton("Show it decorated");
  await u.waitFor("[...document.querySelectorAll('img')].some(i => i.alt.startsWith('AI illustration') && i.complete && i.naturalWidth > 0)", { timeout: 30_000 });
  await u.clickButton("Save this render");
  await u.waitForText(`Saved renders (${count} of 6)`, 10_000);
  await sleep(1500);
}
await renderAndSave(1);
await u.goto(`${base}/studio/sample-garden-pavilion?plan=${planId}&step=style`);
await u.waitForText("The venue's own decor", 15_000);
await u.select("Theme", "Modern Botanical");
await sleep(1500);
await renderAndSave(2);
await u.goto(`${base}/plans`);
await u.clickButton("Create a family link");
await u.waitFor("document.querySelectorAll('fieldset input[type=checkbox]').length === 2", { timeout: 15_000, what: "two saved renders" });
await cdp.evaluate("[...document.querySelectorAll('fieldset input[type=checkbox]')].forEach(i => i.click())");
await u.clickButton("Create link");
await u.waitFor("[...document.querySelectorAll('input')].some(i => i.labels?.[0]?.textContent.trim() === 'Link' && i.value.includes('/s/'))", { timeout: 15_000 });
const link = await cdp.evaluate("[...document.querySelectorAll('input')].find(i => i.labels?.[0]?.textContent.trim() === 'Link').value");

// 6. Ritual checklists: ticks and own items persist.
await u.goto(`${base}/checklists`);
await u.waitForText("Chinese Tea Ceremony", 20_000);
const lists = await u.text();
check("checklists: four lists", ["Chinese Tea Ceremony", "Malay Akad Nikah and Sanding", "Indian Vivaha and Sangeet", "ROM Solemnization"].every((x) => lists.includes(x)), true);
check("checklists: needs-review badge", await has("Draft content: needs community review"), true);
await u.clickLabel("Agree with both families who is served");
await u.fill("Your item for Chinese Tea Ceremony", "SAMPLE: collect the rented tea set");
await cdp.evaluate(`[...document.querySelectorAll('form')].find(f => f.innerText.includes('Your item for Chinese Tea Ceremony')).requestSubmit()`);
await u.waitForText("SAMPLE: collect the rented tea set", 10_000);
await sleep(1200);
await u.goto(`${base}/checklists`);
await u.waitForText("SAMPLE: collect the rented tea set", 20_000);
check(
  "checklists: tick persisted",
  await cdp.evaluate("(() => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim().startsWith('Agree with both families')); return document.getElementById(l.htmlFor)?.getAttribute('aria-checked') ?? null; })()"),
  "true",
);
check("checklists: progress counts own items", await has("1 of 16 done"), true);
await shot("checklists-en");

// 7. Profile language: saved on change, restored on a device with no choice.
await chooseLanguage(cdp, "ms");
await sleep(1500);
const signedIn = await (
  await fetch(`${AUTH}/accounts:signInWithPassword?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: couple.email, password: couple.password, returnSecureToken: true }),
  })
).json();
check("profile: locale saved", (await readDoc(`users/${signedIn.localId}`))?.locale, "ms");
await cdp.evaluate("localStorage.removeItem('wv-locale')");
await u.goto(`${base}/checklists`);
await u.waitFor(`document.documentElement.lang === "ms-SG"`, { timeout: 15_000, what: "profile language restored" });
check("profile: language follows the account to a fresh device", await cdp.evaluate("document.documentElement.lang"), "ms-SG");

// 8. Key screens in every language (signed in as the couple).
const screens = [
  ["catalog", `${base}/venues`, "SAMPLE Garden Pavilion"],
  ["venue", `${base}/venues/sample-garden-pavilion`, "SAMPLE Glasshouse Ballroom"],
  ["studio-estimate", `${base}/studio/sample-garden-pavilion?plan=${planId}&step=estimate`, "SAMPLE Petal & Lantern Studio"],
  ["plans", `${base}/plans`, "SAMPLE Garden Pavilion plan"],
  ["checklists", `${base}/checklists`, "SAMPLE: collect the rented tea set"],
  ["print", `${base}/plans/${planId}/print`, "SAMPLE Glasshouse Ballroom"],
];
for (const code of ["zh", "ms", "ta", "en"]) {
  await u.goto(`${base}/`);
  await setLanguage(cdp, code);
  for (const [name, url, marker] of screens) {
    await u.goto(url);
    await u.waitFor(`document.body.innerText.includes(${JSON.stringify(marker)})`, { timeout: 20_000, what: `${name} ${code}` });
    await u.waitFor(`document.documentElement.lang === "${LANGS[code]}"`, { timeout: 10_000 });
    await sleep(1500);
    await noRawKeys(`${name} ${code}`);
    if (code !== "en") await shot(`${name}-${code}`);
  }
}

// 9. Family vote page in every language, as an anonymous visitor.
const fam = await launch({ port: 9344 });
const f = ui(fam);
await setViewport(fam, 1366);
for (const code of ["en", "zh", "ms", "ta"]) {
  await f.goto(`${base}/`);
  await fam.evaluate(`localStorage.setItem('wv-locale', '${code}')`);
  await f.goto(link);
  await f.waitFor("document.querySelectorAll('input[name=option]').length === 2", { timeout: 20_000, what: `vote page ${code}` });
  await f.waitFor(`document.documentElement.lang === "${LANGS[code]}"`, { timeout: 10_000 });
  await sleep(1500);
  await noRawKeys(`vote ${code}`, fam);
  if (code !== "en") check(`vote ${code}: English intro gone`, await bodyHas("Tap your favourite.", fam), false);
  await shot(`vote-${code}`, [1366, 390], fam);
}
await fam.close();

// 10. Vendor: booked dates and dietary tags (English portal).
await u.goto(`${base}/plans`);
await setLanguage(cdp, "en");
await u.waitForText("My plans", 15_000);
await cdp.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Sign out')).click()");
await u.waitFor("location.pathname === '/'", { timeout: 15_000, what: "signed out" });
await sleep(1000);
await u.goto(`${base}/sign-in`);
await u.fill("Email", venueLogin.email);
await u.fill("Password", venueLogin.password);
await u.clickButton("Sign in");
await u.waitForText("SAMPLE Garden Pavilion Co", 20_000);
await u.goto(`${base}/vendor/business`);
await u.waitForText("Booked dates", 15_000);
await u.waitForText("15 May 2027", 15_000);
await u.fill("Booked date", "2027-07-03");
await u.fill("Note for yourself (optional)", "SAMPLE booking");
await u.clickButton("Add date");
await u.waitForText("3 Jul 2027", 10_000);
check("vendor: booked date added", true, true);
await shot("vendor-booked-dates");
await u.goto(`${base}/vendor/inventory`);
await u.waitForText("SAMPLE Halal banquet menu", 20_000);
await cdp.evaluate(`[...[...document.querySelectorAll('li')].filter(li => li.innerText.includes('SAMPLE Halal banquet menu')).pop().querySelectorAll('button')].find(b => b.textContent.trim() === 'Edit').click()`);
await u.waitForText("Shown to couples as your statement, and used in their filters.", 10_000);
check("vendor item: dietary chips on food", await cdp.evaluate("[...document.querySelectorAll('fieldset legend')].some(l => l.textContent.trim() === 'Dietary')"), true);
check("vendor item: halal ticked", await cdp.evaluate("[...document.querySelectorAll('label')].find(l => l.textContent.trim() === 'Halal')?.querySelector('input')?.checked"), true);
await shot("vendor-item-dietary");
await u.goto(`${base}/venues/sample-garden-pavilion`);
await u.waitForText("3 Jul 2027", 15_000);
check("venue: vendor's new booked date is public", true, true);

console.table(results);
const errors = [...new Set([...cdp.errors])];
if (errors.length) console.log("Console errors:\n" + errors.join("\n"));
await env.cleanup();
await cdp.close();
process.exit(results.some((r) => r.result === "FAIL") || errors.length ? 1 : 0);

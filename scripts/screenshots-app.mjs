#!/usr/bin/env node
// Screenshots of the signed-in app screens at 390 and 1366px, against the
// local emulators. Signs in with the emulator-only vendor test account.
//
// Usage (emulators + dev server running, vendor test account and a venue exist):
//   node scripts/screenshots-app.mjs <venueId> [outDir=docs/screenshots/phase1]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture, launch, loadAndMeasure, setViewport, sleep } from "./lib/cdp.mjs";

const venueId = process.argv[2];
const outDir = process.argv[3] ?? "docs/screenshots/phase1";
const base = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const { vendor } = JSON.parse(readFileSync("scripts/emulator-test-accounts.json", "utf8"));

const publicPages = [
  ["home", "/"],
  ["sign-up", "/sign-up"],
  ["sign-in", "/sign-in"],
];
const vendorPages = [
  ["vendor-dashboard", "/vendor"],
  ...(venueId
    ? [
        ["venue-details", `/vendor/venues/${venueId}?step=details`],
        ["venue-spaces", `/vendor/venues/${venueId}?step=spaces`],
        ["venue-tax", `/vendor/venues/${venueId}?step=tax`],
        ["venue-publish", `/vendor/venues/${venueId}?step=publish`],
      ]
    : []),
  ["vendor-account", "/account"],
];

// Sets a React-controlled input's value the way typing would.
const fill = (label, value) => `(() => {
  const input = [...document.querySelectorAll('input')].find(i => i.labels?.[0]?.textContent === ${JSON.stringify(label)});
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`;

mkdirSync(outDir, { recursive: true });
const cdp = await launch({ port: 9335 });
const report = [];

async function shoot(name, path, width) {
  const before = cdp.errors.length;
  const m = await loadAndMeasure(cdp, `${base}${path}`);
  const file = `${name}-${width}.png`;
  writeFileSync(join(outDir, file), await capture(cdp, width, m.h));
  report.push({ file, overflowX: m.sw > m.cw ? `YES (${m.sw} > ${m.cw})` : "no", consoleErrors: cdp.errors.length - before });
}

for (const width of [390, 1366]) {
  await setViewport(cdp, width);
  for (const [name, path] of publicPages) await shoot(name, path, width);
}

// Sign in once; the session persists across navigations.
await cdp.send("Page.navigate", { url: `${base}/sign-in` });
await sleep(3000);
await cdp.evaluate(fill("Email", vendor.email));
await cdp.evaluate(fill("Password", vendor.password));
await cdp.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Sign in').click()`);
await sleep(4000);

for (const width of [390, 1366]) {
  await setViewport(cdp, width);
  for (const [name, path] of vendorPages) await shoot(name, path, width);
}

console.table(report);
if (cdp.errors.length) console.log("Console errors:\n" + [...new Set(cdp.errors)].join("\n"));
await cdp.close();

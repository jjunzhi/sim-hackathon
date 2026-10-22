#!/usr/bin/env node
// Pilot administration with the Admin SDK. No admin UI exists on purpose: these
// run from your machine, signed in with Application Default Credentials
// (`gcloud auth application-default login`), against the project you name.
//
//   npm run admin -- <command> [args] --project <id>      real project
//   npm run admin -- <command> [args] --emulator          local emulators (demo-weddingvista)
//
// Commands:
//   invite --until YYYY-MM-DD [--note "who it's for"]   create a pilot invite link
//   extend-pilot <uid> --until YYYY-MM-DD               move a vendor's pilot end date
//   set-commission <uid> <basis-points>                 e.g. 300 = 3% (0 during the pilot)
//   verify <venueId> [--off]                            add or remove the Verified badge
//   sync <uid>                                          recompute a vendor's catalog listing
//   export-pilot                                        CSV of each vendor's milestones (stdout)
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : undefined;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["--emulator", "--off"].includes(args[i - 1])));
const [command, ...rest] = positional;

const emulator = flag("emulator") === true;
const projectId = emulator ? "demo-weddingvista" : flag("project");
if (!command) fail("Name a command. See the top of scripts/admin.mjs.");
if (!projectId || projectId === true) fail("Say which project: --project <id> for the real one, or --emulator for local.");
if (emulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
} else if (process.env.FIRESTORE_EMULATOR_HOST) {
  fail("FIRESTORE_EMULATOR_HOST is set but --project was given. Unset it, or use --emulator.");
}

const require = createRequire(join(process.cwd(), "functions/package.json"));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
// Shared with the Cloud Functions so the scripts and the webhook agree (needs `npm run functions:build`).
const { syncListing } = await import(pathToFileURL(join(process.cwd(), "functions/lib/billing/listing.js")).href);
const { readBilling, standingOf } = await import(pathToFileURL(join(process.cwd(), "functions/lib/billing/standing.js")).href);

initializeApp({ projectId });
const db = getFirestore();
const appBaseUrl = (process.env.APP_BASE_URL ?? (emulator ? "http://localhost:3000" : "")).replace(/\/+$/, "");
console.error(`Project: ${projectId}${emulator ? " (emulators)" : ""}`);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
/** End of that day in Singapore, so "until 2027-01-31" includes the 31st. */
function sgEndOfDay(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("Give a date as YYYY-MM-DD.");
  const ms = new Date(`${date}T23:59:59.999+08:00`).getTime();
  if (Number.isNaN(ms)) fail(`Not a real date: ${date}`);
  return ms;
}
const iso = (ms) => (ms ? new Date(ms).toISOString() : "");
const tsMs = (v) => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : null);

switch (command) {
  case "invite": {
    const until = sgEndOfDay(flag("until"));
    if (until <= Date.now()) fail("The pilot end date must be in the future.");
    const code = randomBytes(16).toString("base64url"); // 128 bits, unguessable
    await db.doc(`invites/${code}`).create({ pilotUntilMs: until, note: String(flag("note") ?? "").slice(0, 200), redeemedBy: null, createdAtMs: Date.now() });
    console.log(appBaseUrl ? `${appBaseUrl}/sign-up?role=vendor&invite=${code}` : `Invite code: ${code} (set APP_BASE_URL to print the full link)`);
    break;
  }
  case "extend-pilot": {
    const [uid] = rest;
    if (!uid) fail("Give the vendor's uid.");
    const until = sgEndOfDay(flag("until"));
    await db.doc(`billing/${uid}`).set({ pilotUntilMs: until, updatedAtMs: Date.now() }, { merge: true });
    console.log(`Pilot for ${uid} now ends ${iso(until)}; listed: ${await syncListing(db, uid, Date.now())}`);
    break;
  }
  case "set-commission": {
    const [uid, bpsRaw] = rest;
    const bps = Number(bpsRaw);
    if (!uid || !Number.isInteger(bps) || bps < 0 || bps > 500) fail("Give a uid and basis points between 0 and 500 (0% to 5%).");
    await db.doc(`billing/${uid}`).set({ commissionBps: bps, updatedAtMs: Date.now() }, { merge: true });
    console.log(`Commission for ${uid}: ${bps / 100}%`);
    break;
  }
  case "verify": {
    const [venueId] = rest;
    if (!venueId) fail("Give the venue id.");
    const ref = db.doc(`venues/${venueId}`);
    if (!(await ref.get()).exists) fail(`No venue ${venueId}.`);
    await ref.update({ verified: flag("off") !== true });
    console.log(`${venueId}: verified = ${flag("off") !== true}`);
    break;
  }
  case "sync": {
    const [uid] = rest;
    if (!uid) fail("Give the vendor's uid.");
    console.log(`${uid}: listed = ${await syncListing(db, uid, Date.now())}`);
    break;
  }
  case "export-pilot": {
    // Milestones only: no couple data leaves the project.
    const [vendors, billing, venues, leads, confs, bookings, feedback, invites] = await Promise.all(
      ["vendors", "billing", "venues", "leads", "confirmations", "bookings", "feedback", "invites"].map((c) => db.collection(c).get()),
    );
    const first = (docs, uid, field, uidField = "vendorUid") =>
      Math.min(...docs.filter((d) => d.get(uidField) === uid).map((d) => tsMs(d.get(field)) ?? Infinity), Infinity);
    const billingOf = new Map(billing.docs.map((d) => [d.id, readBilling(d.data())]));
    const rows = [["uid", "business", "kinds", "signed_up", "invited", "first_venue", "published", "listed", "plan", "pilot_until", "first_lead", "first_confirmation", "first_booking", "confirmed_bookings", "feedback_messages"]];
    for (const v of vendors.docs) {
      const uid = v.id;
      const b = billingOf.get(uid) ?? readBilling(undefined);
      const val = (ms) => (Number.isFinite(ms) ? iso(ms) : "");
      rows.push([
        uid,
        v.get("businessName") ?? "",
        (v.get("kinds") ?? []).join("+"),
        iso(tsMs(v.get("createdAt"))),
        invites.docs.some((i) => i.get("redeemedBy") === uid) ? "yes" : "no",
        val(first(venues.docs, uid, "createdAt", "ownerUid")),
        v.get("published") ? "yes" : "no",
        v.get("listed") ? "yes" : "no",
        standingOf(b, Date.now()).kind,
        iso(b.pilotUntilMs),
        val(first(leads.docs, uid, "createdAt")),
        val(first(confs.docs, uid, "confirmedAt")),
        val(first(bookings.docs, uid, "createdAt")),
        String(bookings.docs.filter((d) => d.get("vendorUid") === uid && d.get("status") === "confirmed").length),
        String(feedback.docs.filter((d) => d.get("uid") === uid).length),
      ]);
    }
    const cell = (s) => (/[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
    console.log(rows.map((r) => r.map((x) => cell(String(x))).join(",")).join("\n"));
    break;
  }
  default:
    fail(`Unknown command: ${command}`);
}
process.exit(0);

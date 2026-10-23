#!/usr/bin/env node
// Loads (or removes) the demonstration listings: 9 venues and 3 decorators.
// They are fictional; at the product owner's request (2026-10-23) the site
// shows no "SAMPLE" wording for them. config/sampleListings records every id
// so `remove` deletes them all. Uses the Admin SDK.
//
//   npm run sample-venues -- load   --emulator | --project <id> [--bucket <name>] [--photos <dir>]
//   npm run sample-venues -- remove --emulator | --project <id> [--bucket <name>]
//
// Room photos come from scripts/sample-venues/photos/<venueId>--<spaceId>.jpg
// (licensed stock, credited in CREDITS.md; --photos <dir> uses another folder).
// Any room without one gets an illustrated scene (marked ILLUSTRATION) instead.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DECORATORS, VENUES } from "./sample-venues/data.mjs";
import { FOOD_STYLE, foodSvg } from "./sample-venues/food.mjs";
import { SCENES, swatchSvg } from "./sample-venues/scenes.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : undefined;
};
const command = args.find((a) => a === "load" || a === "remove");
const emulator = flag("emulator") === true;
const projectId = emulator ? "demo-weddingvista" : flag("project");
const fail = (m) => {
  console.error(m);
  process.exit(1);
};
if (!command) fail("Say load or remove.");
if (!projectId || projectId === true) fail("Say which project: --project <id> for the real one, or --emulator for local.");
if (emulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= "127.0.0.1:9199";
} else if (process.env.FIRESTORE_EMULATOR_HOST) fail("FIRESTORE_EMULATOR_HOST is set but --project was given.");
const bucketName = typeof flag("bucket") === "string" ? flag("bucket") : emulator ? `${projectId}.appspot.com` : `${projectId}.firebasestorage.app`;
// Licensed stock photos for some rooms (see sample-venues/photos/CREDITS.md); others use illustrated scenes.
const photosDir = typeof flag("photos") === "string" ? flag("photos") : join(process.cwd(), "scripts/sample-venues/photos");

const require = createRequire(join(process.cwd(), "functions/package.json"));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const sharp = (await import(pathToFileURL(require.resolve("sharp")).href)).default;

initializeApp({ projectId, storageBucket: bucketName });
const db = getFirestore();
const bucket = getStorage().bucket();
console.error(`Project: ${projectId}${emulator ? " (emulators)" : ""}, bucket: ${bucketName}`);

const now = Timestamp.now();
const PILOT = { status: "none", pilotUntilMs: Date.UTC(2099, 0, 1), pastDueSinceMs: null, stripeCustomerId: null, stripeSubscriptionId: null, currentPeriodEndMs: null, cancelAtPeriodEnd: false, commissionBps: 0, lastEventAtMs: null };
const photo = (path, width, height, contentType) => ({ path, width, height, contentType });

async function put(path, bytes, contentType) {
  await bucket.file(path).save(bytes, { contentType, resumable: false, metadata: { cacheControl: "public, max-age=31536000" } });
}

/** A room photo: an approved one from --photos if present, otherwise an illustrated scene. */
async function roomImage(venueId, spaceId, scene) {
  const file = photosDir && join(photosDir, `${venueId}--${spaceId}.jpg`);
  const src = file && existsSync(file) ? readFileSync(file) : Buffer.from(SCENES[scene]());
  return sharp(src).resize(2048, 1536, { fit: "cover" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

async function vendorDoc(uid, business, description, kinds, tax) {
  // Billing first, so the listing triggers agree with `listed` below.
  await db.doc(`billing/${uid}`).set({ ...PILOT, updatedAtMs: Date.now() });
  await db.doc(`vendors/${uid}`).set({
    kinds, businessName: business, description, tax, servesAnyVenue: true, servesVenueIds: [], published: true, listed: true, createdAt: now, updatedAt: now,
  });
}

/**
 * An item's picture: an approved stock photo from photos/items (named
 * <owner>--<item>.jpg when two listings share an item id, else <item>.jpg;
 * see CREDITS.md), otherwise a drawn picture of how a menu is served, or the
 * decor's colour swatch. Re-encoding strips any metadata.
 */
async function itemImage(uid, it) {
  for (const name of [`${uid}--${it.id}.jpg`, `${it.id}.jpg`]) {
    const file = photosDir && join(photosDir, "items", name);
    if (file && existsSync(file)) {
      return { bytes: await sharp(readFileSync(file)).resize(1200, 900, { fit: "cover" }).webp({ quality: 82 }).toBuffer(), width: 1200, height: 900 };
    }
  }
  const style = FOOD_STYLE[it.id];
  const veg = it.dietaryTags.includes("vegetarian") || it.dietaryTags.includes("vegan");
  const svg = style ? foodSvg(style, { veg, accent: it.hex }) : swatchSvg(it.hex, it.name);
  return { bytes: await sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer(), width: 800, height: 600 };
}

async function items(uid, list) {
  for (const it of list) {
    const path = `vendors/${uid}/items/${it.id}/p1.webp`;
    const img = await itemImage(uid, it);
    await put(path, img.bytes, "image/webp");
    await db.doc(`vendors/${uid}/items/${it.id}`).set({
      name: it.name, category: it.category, unit: it.unit, priceCents: it.priceCents, description: "",
      photo: photo(path, img.width, img.height, "image/webp"), active: true, dietaryTags: it.dietaryTags, createdAt: now, updatedAt: now,
    });
  }
}

async function load() {
  const venueIds = [];
  const vendorUids = [];
  for (const v of VENUES) {
    await vendorDoc(v.owner, v.business, v.venue.description, ["venue"], v.tax);
    vendorUids.push(v.owner);
    const id = v.venue.id;
    const coverPath = `venues/${id}/cover/c1.jpg`;
    await put(coverPath, await roomImage(id, v.spaces[0].id, v.spaces[0].scene), "image/jpeg");
    const fields = Object.fromEntries(Object.entries(v.venue).filter(([k]) => k !== "id"));
    await db.doc(`venues/${id}`).set({
      ...fields, ownerUid: v.owner, status: "active", verified: false, postalCode: "", listed: true,
      coverPhoto: photo(coverPath, 2048, 1536, "image/jpeg"), createdAt: now, updatedAt: now,
    });
    venueIds.push(id);
    for (const [i, s] of v.spaces.entries()) {
      const path = `venues/${id}/spaces/${s.id}/p1.jpg`;
      await put(path, await roomImage(id, s.id, s.scene), "image/jpeg");
      await db.doc(`venues/${id}/spaces/${s.id}`).set({
        name: s.name, capacityMin: s.capacityMin, capacityMax: s.capacityMax, seatsPerTable: 10, tiers: s.tiers,
        photo: photo(path, 2048, 1536, "image/jpeg"), photoVersion: s.photoVersion ?? 1, sortOrder: i, createdAt: now, updatedAt: now,
      });
    }
    await items(v.owner, v.items);
    for (const [i, date] of v.blocked.entries()) await db.doc(`vendors/${v.owner}/blockedDates/sample-${i}`).set({ date, note: "Booked", createdAt: now, updatedAt: now });
    console.error(`  venue ${id}: ${v.spaces.length} room(s), ${v.items.length} item(s)`);
  }
  for (const d of DECORATORS) {
    await vendorDoc(d.owner, d.business, d.description, ["decorator"], d.tax);
    vendorUids.push(d.owner);
    await items(d.owner, d.items);
    if (d.package) {
      const { id, ...p } = d.package;
      await db.doc(`vendors/${d.owner}/packages/${id}`).set({ ...p, description: "", photo: null, active: true, createdAt: now, updatedAt: now });
    }
    console.error(`  decorator ${d.owner}: ${d.items.length} item(s)`);
  }
  await db.doc("config/sampleListings").set({ venueIds, vendorUids, loadedAtMs: Date.now() });
  console.log(`Loaded ${venueIds.length} demonstration venues and ${DECORATORS.length} decorators (recorded in config/sampleListings for removal).`);
}

async function remove() {
  const record = (await db.doc("config/sampleListings").get()).data();
  const venueIds = record?.venueIds ?? VENUES.map((v) => v.venue.id);
  const vendorUids = record?.vendorUids ?? [...VENUES.map((v) => v.owner), ...DECORATORS.map((d) => d.owner)];
  for (const id of venueIds) {
    await bucket.deleteFiles({ prefix: `venues/${id}/` }).catch(() => undefined);
    await db.recursiveDelete(db.doc(`venues/${id}`));
  }
  for (const uid of vendorUids) {
    await bucket.deleteFiles({ prefix: `vendors/${uid}/` }).catch(() => undefined);
    await db.recursiveDelete(db.doc(`vendors/${uid}`));
    await db.doc(`billing/${uid}`).delete();
    // Cached renders of SAMPLE rooms or items go too.
    const [a, b] = await Promise.all([db.collection("renders").where("vendorUid", "==", uid).get(), db.collection("renders").where("itemVendorUids", "array-contains", uid).get()]);
    for (const r of new Map([...a.docs, ...b.docs].map((d) => [d.id, d])).values()) {
      const path = r.get("path");
      if (path) await bucket.file(path).delete({ ignoreNotFound: true });
      await r.ref.delete();
    }
  }
  const plans = await db.collection("projects").where("venueId", "in", venueIds.slice(0, 30)).get();
  await db.doc("config/catalog").set({ sampleListings: false }, { merge: true });
  await db.doc("config/sampleListings").delete();
  console.log(`Removed ${venueIds.length} SAMPLE venues and ${vendorUids.length} SAMPLE vendors.`);
  if (plans.size) console.log(`Note: ${plans.size} couple plan(s) referred to SAMPLE venues; they will show "This venue isn't available".`);
}

await (command === "load" ? load() : remove());
process.exit(0);

#!/usr/bin/env node
// Loads clearly labelled SAMPLE venues, spaces, items and a decorator into the
// LOCAL emulators so the catalog and Studio have content. Never touches a real
// project: it only talks to 127.0.0.1 and refuses project IDs not starting "demo-".
//
// Usage (with `npm run emulators` running): npm run seed
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

const PROJECT_ID = "demo-weddingvista";
if (!PROJECT_ID.startsWith("demo-")) throw new Error("Seeding is only allowed for demo- projects");
const sharp = (await import(pathToFileURL(createRequire(join(process.cwd(), "functions/package.json")).resolve("sharp")).href)).default;

const env = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { host: "127.0.0.1", port: 8080 },
  storage: { host: "127.0.0.1", port: 9199 },
});
const t = Timestamp.now();
const hall = readFileSync("public/samples/hall-before.svg");
const room = (hue, brightness = 1) => sharp(hall).resize(2048, 1536).modulate({ hue, brightness }).jpeg({ quality: 82 }).toBuffer();
const swatch = (hex, label) =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#f4ece6"/><circle cx="400" cy="270" r="190" fill="${hex}"/><text x="400" y="560" font-family="Arial" font-size="40" font-weight="700" text-anchor="middle" fill="#2a2325">${label}</text></svg>`,
    ),
  )
    .webp({ quality: 85 })
    .toBuffer();
const photo = (path, w, h, contentType) => ({ path, width: w, height: h, contentType });
const tax = (serviceChargeBps, gstBps) => ({ serviceChargeBps, gstBps, noServiceChargeNote: "No service charge", noGstNote: "Prices not subject to GST" });

const VENUE_OWNERS = ["sample-venue-1", "sample-venue-2", "sample-venue-3"];
const DECORATOR = "sample-decorator-1";

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const st = ctx.storage(`gs://${PROJECT_ID}.appspot.com`);
  const put = async (path, bytes, contentType) => uploadBytes(ref(st, path), bytes, { contentType });
  const vendor = (uid, businessName, kinds, t2, extra = {}) =>
    setDoc(doc(db, `vendors/${uid}`), {
      kinds, businessName, description: "SAMPLE business for testing. Not a real vendor.", tax: t2,
      servesAnyVenue: true, servesVenueIds: [], published: true, createdAt: t, updatedAt: t, ...extra,
    });
  const venue = async (id, ownerUid, o, hue) => {
    await put(`venues/${id}/cover/c1.jpg`, await room(hue), "image/jpeg");
    await setDoc(doc(db, `venues/${id}`), {
      ownerUid, status: "active", verified: false, postalCode: "", description: "", coverPhoto: photo(`venues/${id}/cover/c1.jpg`, 2048, 1536, "image/jpeg"),
      createdAt: t, updatedAt: t, ...o,
    });
  };
  const space = async (venueId, id, o, hue) => {
    const path = `venues/${venueId}/spaces/${id}/p1.jpg`;
    await put(path, await room(hue, 1.04), "image/jpeg");
    await setDoc(doc(db, `venues/${venueId}/spaces/${id}`), {
      seatsPerTable: 10, photo: photo(path, 2048, 1536, "image/jpeg"), photoVersion: 1, sortOrder: 0, createdAt: t, updatedAt: t, ...o,
    });
  };
  const item = async (vendorUid, id, name, category, unit, priceCents, hex) => {
    const path = `vendors/${vendorUid}/items/${id}/p1.webp`;
    await put(path, await swatch(hex, name), "image/webp");
    await setDoc(doc(db, `vendors/${vendorUid}/items/${id}`), {
      name, category, unit, priceCents, description: "SAMPLE item.", photo: photo(path, 800, 600, "image/webp"), active: true, createdAt: t, updatedAt: t,
    });
  };

  // Venue 1: two rooms, Peak/Off-Peak with a Peak minimum spend, in-house decor.
  await vendor(VENUE_OWNERS[0], "SAMPLE Garden Pavilion Co", ["venue"], tax(1000, 900));
  await venue("sample-garden-pavilion", VENUE_OWNERS[0], {
    name: "SAMPLE Garden Pavilion", address: "1 Sample Garden Road, Singapore", postalCode: "123456",
    description: "SAMPLE venue for testing. A glasshouse ballroom opening onto a garden terrace.",
    styleTags: ["Garden", "Ballroom"], cultureTags: ["Chinese", "Malay", "Fusion"], wheelchairAccess: true, liftAccess: true,
  }, 0);
  await space("sample-garden-pavilion", "glasshouse", {
    name: "SAMPLE Glasshouse Ballroom", capacityMin: 80, capacityMax: 250,
    tiers: { peak: { roomRentalCents: 1_200_000, minimumSpendCents: 4_500_050 }, offPeak: { roomRentalCents: 650_000, minimumSpendCents: null } },
  }, 0);
  await space("sample-garden-pavilion", "terrace", {
    name: "SAMPLE Orchid Terrace", capacityMin: 30, capacityMax: 80, sortOrder: 1,
    tiers: { standard: { roomRentalCents: 300_000, minimumSpendCents: null } },
  }, 40);
  await item(VENUE_OWNERS[0], "arch", "SAMPLE Floral arch", "Florals", "piece", 120_000, "#b84c60");
  await item(VENUE_OWNERS[0], "centrepiece", "SAMPLE Table centrepiece", "Table decor", "table", 8_800, "#7e9c7a");
  await item(VENUE_OWNERS[0], "sash", "SAMPLE Chair sash", "Draping", "guest", 350, "#e7a9b5");

  // Venue 2: heritage, no lift or wheelchair access, no service charge.
  await vendor(VENUE_OWNERS[1], "SAMPLE Heritage Shophouse Pte", ["venue"], tax(0, 900));
  await venue("sample-heritage-shophouse", VENUE_OWNERS[1], {
    name: "SAMPLE Heritage Shophouse", address: "2 Sample Heritage Street, Singapore",
    description: "SAMPLE venue for testing. An intimate courtyard in a restored shophouse.",
    styleTags: ["Heritage", "Intimate"], cultureTags: ["Peranakan", "Chinese"], wheelchairAccess: false, liftAccess: false,
  }, 120);
  await space("sample-heritage-shophouse", "courtyard", {
    name: "SAMPLE Courtyard", capacityMin: 30, capacityMax: 90, tiers: { standard: { roomRentalCents: 450_000, minimumSpendCents: 800_000 } },
  }, 120);

  // Venue 3: rooftop, verified by an admin (shows the Verified tag).
  await vendor(VENUE_OWNERS[2], "SAMPLE Rooftop Loft LLP", ["venue"], tax(1000, 900));
  await venue("sample-rooftop-loft", VENUE_OWNERS[2], {
    name: "SAMPLE Rooftop Loft", address: "3 Sample Skyline Avenue, Singapore", verified: true,
    description: "SAMPLE venue for testing. City views and an industrial loft.",
    styleTags: ["Rooftop", "Industrial"], cultureTags: ["Western", "Indian", "Fusion"], wheelchairAccess: true, liftAccess: true,
  }, 220);
  await space("sample-rooftop-loft", "loft", {
    name: "SAMPLE Skyline Loft", capacityMin: 60, capacityMax: 160,
    tiers: { peak: { roomRentalCents: 900_000, minimumSpendCents: null }, offPeak: { roomRentalCents: 550_000, minimumSpendCents: null } },
  }, 220);

  // A decorator who works at any venue, not GST-registered, no service charge.
  await vendor(DECORATOR, "SAMPLE Petal & Lantern Studio", ["decorator"], tax(0, 0));
  await item(DECORATOR, "lanterns", "SAMPLE Lantern set", "Lighting", "table", 4_500, "#b8935a");
  await item(DECORATOR, "backdrop", "SAMPLE Peony backdrop", "Backdrops and stage", "piece", 280_000, "#f4d3d9");
  await item(DECORATOR, "canopy", "SAMPLE Fairy light canopy", "Lighting", "piece", 150_000, "#f5d58e");
  await setDoc(doc(db, `vendors/${DECORATOR}/packages/garden`), {
    name: "SAMPLE Garden romance", unit: "table", priceCents: 12_000, description: "SAMPLE package.", itemIds: ["lanterns"],
    photo: null, active: true, createdAt: t, updatedAt: t,
  });
});
await env.cleanup();
console.log("Seeded SAMPLE data: 3 venues, 4 spaces, 6 items, 1 package, 1 decorator. Capacity summaries are filled in by the emulator trigger.");

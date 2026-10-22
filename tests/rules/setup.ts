import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";

// Must match .firebaserc: the emulators run in single-project mode.
export const PROJECT_ID = "demo-weddingvista";
export const BUCKET = `gs://${PROJECT_ID}.appspot.com`;

export async function makeEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
}

export const VENDOR = "vendor-alice";
export const OTHER_VENDOR = "vendor-bob";
export const COUPLE = "couple-carol";

export const tax = { serviceChargeBps: 1000, gstBps: 900, noServiceChargeNote: "", noGstNote: "Prices not subject to GST" };

/** A valid new venue as the client would send it. */
export function newVenue(ownerUid: string, overrides: Record<string, unknown> = {}) {
  return {
    ownerUid,
    status: "draft",
    verified: false,
    name: "SAMPLE Garden Hall",
    address: "1 Example Road",
    postalCode: "123456",
    description: "",
    styleTags: ["Garden"],
    cultureTags: [],
    wheelchairAccess: true,
    liftAccess: false,
    coverPhoto: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

export function newSpace(overrides: Record<string, unknown> = {}) {
  return {
    name: "SAMPLE Ballroom",
    capacityMin: 80,
    capacityMax: 250,
    seatsPerTable: 10,
    tiers: { standard: { roomRentalCents: 800_000, minimumSpendCents: null } },
    photo: null,
    photoVersion: 0,
    sortOrder: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** Seed data bypassing rules (as an admin would). */
export async function seed(env: RulesTestEnvironment, path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

export const fixedTime = Timestamp.fromMillis(Date.UTC(2026, 9, 1));

export async function seedUser(env: RulesTestEnvironment, uid: string, role: "couple" | "vendor") {
  await seed(env, `users/${uid}`, { role, consent: { version: "draft", acceptedAt: fixedTime }, createdAt: fixedTime });
}

export function newVendorProfile(overrides: Record<string, unknown> = {}) {
  return {
    kinds: ["decorator"],
    businessName: "SAMPLE Blooms",
    description: "",
    tax,
    servesAnyVenue: true,
    servesVenueIds: [],
    published: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

export function newItem(overrides: Record<string, unknown> = {}) {
  return {
    name: "SAMPLE Floral arch",
    category: "Florals",
    unit: "piece",
    priceCents: 120_000,
    description: "",
    photo: null,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

export function newPackage(overrides: Record<string, unknown> = {}) {
  return {
    name: "SAMPLE Garden package",
    unit: "table",
    priceCents: 25_000,
    description: "",
    itemIds: ["item1"],
    photo: null,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

export async function seedVendor(env: RulesTestEnvironment, uid: string, published = false) {
  await seed(env, `vendors/${uid}`, { ...newVendorProfile({ published }), createdAt: fixedTime, updatedAt: fixedTime });
}

export async function seedVenue(env: RulesTestEnvironment, id: string, ownerUid: string, status: "draft" | "active" = "draft") {
  await seed(env, `venues/${id}`, { ...newVenue(ownerUid), status, createdAt: fixedTime, updatedAt: fixedTime });
}

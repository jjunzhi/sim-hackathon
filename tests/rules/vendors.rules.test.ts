import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  BUCKET,
  COUPLE,
  OTHER_VENDOR,
  VENDOR,
  fixedTime,
  makeEnv,
  newItem,
  newPackage,
  newVendorProfile,
  seed,
  seedUser,
  seedVendor,
} from "./setup";

let env: RulesTestEnvironment;
const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const storage = (uid?: string) => (uid ? env.authenticatedContext(uid).storage(BUCKET) : env.unauthenticatedContext().storage(BUCKET));
const tax = (t: Record<string, unknown>) => ({ serviceChargeBps: 1000, gstBps: 900, noServiceChargeNote: "", noGstNote: "", ...t });

beforeAll(async () => {
  env = await makeEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seedUser(env, VENDOR, "vendor");
  await seedUser(env, OTHER_VENDOR, "vendor");
  await seedUser(env, COUPLE, "couple");
});

describe("business profile", () => {
  it("a vendor can create their own profile as a venue, a decorator, or both", async () => {
    await assertSucceeds(setDoc(doc(db(VENDOR), "vendors", VENDOR), newVendorProfile({ kinds: ["venue", "decorator"] })));
  });

  it("a couple cannot create a business profile", async () => {
    await assertFails(setDoc(doc(db(COUPLE), "vendors", COUPLE), newVendorProfile()));
  });

  it("nobody can create a profile for someone else", async () => {
    await assertFails(setDoc(doc(db(VENDOR), "vendors", OTHER_VENDOR), newVendorProfile()));
  });

  it("validates kinds", async () => {
    await assertFails(setDoc(doc(db(VENDOR), "vendors", VENDOR), newVendorProfile({ kinds: [] })));
    await assertFails(setDoc(doc(db(VENDOR), "vendors", VENDOR), newVendorProfile({ kinds: ["caterer"] })));
  });

  it("tax settings: service charge 10% or 0, GST 9% or 0, whole basis points only", async () => {
    const make = (t: Record<string, unknown>) => setDoc(doc(db(VENDOR), "vendors", VENDOR), newVendorProfile({ tax: tax(t) }));
    await assertFails(make({ serviceChargeBps: 500 }));
    await assertFails(make({ gstBps: 800 }));
    await assertFails(make({ gstBps: 9.5 }));
    await assertSucceeds(make({ serviceChargeBps: 0, gstBps: 0 }));
  });

  it("only the owner edits; nobody deletes from the client", async () => {
    await seedVendor(env, VENDOR);
    await assertSucceeds(updateDoc(doc(db(VENDOR), "vendors", VENDOR), { businessName: "SAMPLE New", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(OTHER_VENDOR), "vendors", VENDOR), { businessName: "Hijack", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db(VENDOR), "vendors", VENDOR)));
  });

  it("unpublished profiles are private; published ones are public", async () => {
    await seedVendor(env, VENDOR, false);
    await assertFails(getDoc(doc(db(), "vendors", VENDOR)));
    await assertSucceeds(getDoc(doc(db(VENDOR), "vendors", VENDOR)));
    await seedVendor(env, VENDOR, true);
    await assertSucceeds(getDoc(doc(db(), "vendors", VENDOR)));
  });
});

describe("inventory items", () => {
  const items = (uid: string | undefined, owner = VENDOR) => collection(db(uid), "vendors", owner, "items");

  it("needs a business profile first", async () => {
    await assertFails(addDoc(items(VENDOR), newItem()));
    await seedVendor(env, VENDOR);
    await assertSucceeds(addDoc(items(VENDOR), newItem()));
  });

  it("validates unit, category, price and fields", async () => {
    await seedVendor(env, VENDOR);
    await assertSucceeds(addDoc(items(VENDOR), newItem({ unit: "table", category: "Table decor", priceCents: 8_800 })));
    await assertSucceeds(addDoc(items(VENDOR), newItem({ unit: "guest", category: "Food and drink", priceCents: 0 })));
    await assertFails(addDoc(items(VENDOR), newItem({ unit: "hour" })));
    await assertFails(addDoc(items(VENDOR), newItem({ category: "Fireworks" })));
    await assertFails(addDoc(items(VENDOR), newItem({ priceCents: 10.5 })));
    await assertFails(addDoc(items(VENDOR), newItem({ priceCents: -100 })));
    await assertFails(addDoc(items(VENDOR), newItem({ name: "" })));
    await assertFails(addDoc(items(VENDOR), newItem({ rating: 5 })));
  });

  it("photo paths must be inside the vendor's own folder", async () => {
    await seedVendor(env, VENDOR);
    const photo = (path: string) => ({ path, width: 2048, height: 1536, contentType: "image/webp" });
    await assertSucceeds(addDoc(items(VENDOR), newItem({ photo: photo(`vendors/${VENDOR}/items/x/a.webp`) })));
    await assertFails(addDoc(items(VENDOR), newItem({ photo: photo(`vendors/${OTHER_VENDOR}/items/x/a.webp`) })));
  });

  it("another vendor or a couple cannot add, edit or delete items", async () => {
    await seedVendor(env, VENDOR);
    await seed(env, `vendors/${VENDOR}/items/i1`, { ...newItem(), createdAt: fixedTime, updatedAt: fixedTime });
    await assertFails(addDoc(items(OTHER_VENDOR), newItem()));
    await assertFails(addDoc(items(COUPLE), newItem()));
    await assertFails(updateDoc(doc(db(OTHER_VENDOR), `vendors/${VENDOR}/items/i1`), { priceCents: 1, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db(OTHER_VENDOR), `vendors/${VENDOR}/items/i1`)));
    await assertSucceeds(updateDoc(doc(db(VENDOR), `vendors/${VENDOR}/items/i1`), { priceCents: 1, updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(db(VENDOR), `vendors/${VENDOR}/items/i1`)));
  });

  it("couples see only active items, and only once the business is published", async () => {
    await seedVendor(env, VENDOR, false);
    await seed(env, `vendors/${VENDOR}/items/on`, { ...newItem(), createdAt: fixedTime, updatedAt: fixedTime });
    await seed(env, `vendors/${VENDOR}/items/off`, { ...newItem({ active: false }), createdAt: fixedTime, updatedAt: fixedTime });
    await assertFails(getDoc(doc(db(COUPLE), `vendors/${VENDOR}/items/on`)));
    await seedVendor(env, VENDOR, true);
    await assertSucceeds(getDoc(doc(db(COUPLE), `vendors/${VENDOR}/items/on`)));
    await assertFails(getDoc(doc(db(COUPLE), `vendors/${VENDOR}/items/off`)));
    await assertSucceeds(getDocs(query(items(COUPLE), where("active", "==", true))));
    await assertFails(getDocs(items(COUPLE)));
    await assertSucceeds(getDoc(doc(db(VENDOR), `vendors/${VENDOR}/items/off`)));
  });
});

describe("packages", () => {
  const packages = (uid: string) => collection(db(uid), "vendors", VENDOR, "packages");

  it("the owner can create a package listing its items", async () => {
    await seedVendor(env, VENDOR);
    await assertSucceeds(addDoc(packages(VENDOR), newPackage()));
  });

  it("a package needs 1 to 30 items and a valid price and unit", async () => {
    await seedVendor(env, VENDOR);
    await assertFails(addDoc(packages(VENDOR), newPackage({ itemIds: [] })));
    await assertFails(addDoc(packages(VENDOR), newPackage({ itemIds: Array.from({ length: 31 }, (_, i) => `i${i}`) })));
    await assertFails(addDoc(packages(VENDOR), newPackage({ unit: "hour" })));
    await assertFails(addDoc(packages(VENDOR), newPackage({ priceCents: 1.5 })));
  });

  it("another vendor cannot create or edit packages", async () => {
    await seedVendor(env, VENDOR);
    await assertFails(addDoc(packages(OTHER_VENDOR), newPackage()));
  });
});

describe("inventory photos in Storage", () => {
  const path = (owner = VENDOR, file = "a.webp") => `vendors/${owner}/items/i1/${file}`;
  const webp = { contentType: "image/webp" };
  const bytes = new Uint8Array(1000).fill(3);

  it("only the owner uploads; type and size are checked", async () => {
    await seedVendor(env, VENDOR);
    await assertSucceeds(uploadBytes(ref(storage(VENDOR), path()), bytes, webp));
    await assertFails(uploadBytes(ref(storage(OTHER_VENDOR), path()), bytes, webp));
    await assertFails(uploadBytes(ref(storage(VENDOR), path()), bytes, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(storage(VENDOR), path(VENDOR, "a.gif")), bytes, webp));
    await assertFails(uploadBytes(ref(storage(VENDOR), path()), new Uint8Array(3 * 1024 * 1024 + 1), webp));
  });

  it("photos become public only when the business is published", async () => {
    await seedVendor(env, VENDOR, false);
    await uploadBytes(ref(storage(VENDOR), path()), bytes, webp);
    await assertFails(getBytes(ref(storage(), path())));
    await assertSucceeds(getBytes(ref(storage(VENDOR), path())));
    await seedVendor(env, VENDOR, true);
    await assertSucceeds(getBytes(ref(storage(), path())));
  });
});

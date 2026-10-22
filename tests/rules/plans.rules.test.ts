import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { COUPLE, VENDOR, fixedTime, makeEnv, newVenue, seed, seedUser, seedVenue } from "./setup";

let env: RulesTestEnvironment;
const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const OTHER_COUPLE = "couple-dan";

const plan = (ownerUid: string, o: Record<string, unknown> = {}) => ({
  ownerUid,
  name: "SAMPLE plan",
  venueId: "v1",
  spaceId: "s1",
  tierKey: "peak",
  headcount: 185,
  themeId: "peranakan",
  selections: { "item:vendor:arch": 1 },
  savedRenders: [],
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...o,
});

const party = (o: Record<string, unknown> = {}) => ({
  label: "Auntie Mei's family",
  tier: "extended",
  seats: 4,
  plusOnes: 0,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...o,
});

beforeAll(async () => {
  env = await makeEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seedUser(env, COUPLE, "couple");
  await seedUser(env, OTHER_COUPLE, "couple");
  await seedUser(env, VENDOR, "vendor");
});

describe("plans (projects)", () => {
  it("a couple creates their own plan", async () => {
    await assertSucceeds(addDoc(collection(db(COUPLE), "projects"), plan(COUPLE)));
  });

  it("vendors, signed-out visitors and impostors cannot create plans", async () => {
    await assertFails(addDoc(collection(db(VENDOR), "projects"), plan(VENDOR)));
    await assertFails(addDoc(collection(db(), "projects"), plan(COUPLE)));
    await assertFails(addDoc(collection(db(COUPLE), "projects"), plan(OTHER_COUPLE)));
  });

  it("validates fields and sizes", async () => {
    const make = (o: Record<string, unknown>) => addDoc(collection(db(COUPLE), "projects"), plan(COUPLE, o));
    await assertFails(make({ headcount: -1 }));
    await assertFails(make({ headcount: 10.5 }));
    await assertFails(make({ tierKey: "weekend" }));
    await assertFails(make({ name: "" }));
    await assertFails(make({ savedRenders: [1, 2, 3, 4, 5, 6, 7] }));
    await assertFails(make({ selections: Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`item:v:${i}`, 1])) }));
    await assertFails(make({ guestNames: ["x"] }));
    await assertSucceeds(make({ spaceId: null, tierKey: null, headcount: 0 }));
  });

  it("only the owner reads, updates or deletes; ownership can't move", async () => {
    await seed(env, "projects/p1", { ...plan(COUPLE), createdAt: fixedTime, updatedAt: fixedTime });
    await assertSucceeds(getDoc(doc(db(COUPLE), "projects/p1")));
    await assertFails(getDoc(doc(db(OTHER_COUPLE), "projects/p1")));
    await assertFails(getDoc(doc(db(VENDOR), "projects/p1")));
    await assertSucceeds(updateDoc(doc(db(COUPLE), "projects/p1"), { headcount: 200, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(COUPLE), "projects/p1"), { ownerUid: OTHER_COUPLE, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(OTHER_COUPLE), "projects/p1"), { headcount: 1, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db(OTHER_COUPLE), "projects/p1")));
    await assertSucceeds(deleteDoc(doc(db(COUPLE), "projects/p1")));
  });
});

describe("guest lists", () => {
  it("a couple keeps their own list and parties", async () => {
    await assertSucceeds(setDoc(doc(db(COUPLE), `guestLists/${COUPLE}`), { trimOrder: ["casual", "close", "extended"], planId: null, updatedAt: serverTimestamp() }));
    await assertSucceeds(addDoc(collection(db(COUPLE), `guestLists/${COUPLE}/parties`), party()));
  });

  it("nobody else can read or write them", async () => {
    await seed(env, `guestLists/${COUPLE}/parties/g1`, { ...party(), createdAt: fixedTime, updatedAt: fixedTime });
    await assertFails(getDoc(doc(db(OTHER_COUPLE), `guestLists/${COUPLE}/parties/g1`)));
    await assertFails(getDoc(doc(db(VENDOR), `guestLists/${COUPLE}/parties/g1`)));
    await assertFails(addDoc(collection(db(OTHER_COUPLE), `guestLists/${COUPLE}/parties`), party()));
  });

  it("stores only a label, tier and seat counts", async () => {
    const add = (o: Record<string, unknown>) => addDoc(collection(db(COUPLE), `guestLists/${COUPLE}/parties`), party(o));
    await assertFails(add({ phone: "91234567" }));
    await assertFails(add({ email: "a@b.c" }));
    await assertFails(add({ score: 3 }));
    await assertFails(add({ tier: "vip" }));
    await assertFails(add({ seats: 0 }));
    await assertFails(add({ plusOnes: 11 }));
    await assertFails(add({ label: "" }));
  });

  it("trim order must be the three trimmable tiers", async () => {
    const set = (trimOrder: string[]) => setDoc(doc(db(COUPLE), `guestLists/${COUPLE}`), { trimOrder, planId: null, updatedAt: serverTimestamp() });
    await assertSucceeds(set(["extended", "casual", "close"]));
    await assertFails(set(["must", "casual", "close"]));
    await assertFails(set(["casual", "close"]));
  });
});

describe("venue capacity summary is server-only", () => {
  it("vendors can't set or change it", async () => {
    await assertFails(addDoc(collection(db(VENDOR), "venues"), newVenue(VENDOR, { capacitySummary: { min: 1, max: 9999 } })));
    await seedVenue(env, "v1", VENDOR);
    await seed(env, "venues/v1", { ...newVenue(VENDOR), createdAt: fixedTime, updatedAt: fixedTime, capacitySummary: { min: 80, max: 250, ranges: [{ min: 80, max: 250 }], spaceCount: 1, fromRentalCents: 1 } });
    await assertFails(updateDoc(doc(db(VENDOR), "venues/v1"), { capacitySummary: { min: 1, max: 9999 }, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(VENDOR), "venues/v1"), { name: "SAMPLE renamed", updatedAt: serverTimestamp() }));
  });
});

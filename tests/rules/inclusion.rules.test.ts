import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { COUPLE, OTHER_VENDOR, VENDOR, fixedTime, makeEnv, newItem, newVenue, seed, seedUser, seedVendor } from "./setup";

// Phase 6: profile language, ritual checklists, dietary and access fields,
// blocked dates and the optional wedding date on plans.
let env: RulesTestEnvironment;
const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const OTHER_COUPLE = "couple-dan";

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
  await seedUser(env, OTHER_VENDOR, "vendor");
});

describe("users/{uid}.locale", () => {
  it("a user can set their own language, and nothing else", async () => {
    await assertSucceeds(updateDoc(doc(db(COUPLE), "users", COUPLE), { locale: "ta" }));
    await assertSucceeds(updateDoc(doc(db(COUPLE), "users", COUPLE), { locale: "zh" }));
    await assertFails(updateDoc(doc(db(COUPLE), "users", COUPLE), { locale: "fr" }));
    await assertFails(updateDoc(doc(db(COUPLE), "users", COUPLE), { locale: "ms", role: "vendor" }));
    await assertFails(updateDoc(doc(db(COUPLE), "users", COUPLE), { role: "vendor" }));
  });

  it("nobody else can set it", async () => {
    await assertFails(updateDoc(doc(db(OTHER_COUPLE), "users", COUPLE), { locale: "ms" }));
    await assertFails(updateDoc(doc(db(), "users", COUPLE), { locale: "ms" }));
  });
});

describe("checklists/{uid}", () => {
  const ticks = (t: Record<string, true>) => ({ ticks: t, updatedAt: serverTimestamp() });
  const item = (o: Record<string, unknown> = {}) => ({ ritualId: "tea", text: "SAMPLE own item", done: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...o });

  it("the couple keeps their own ticks", async () => {
    await assertSucceeds(setDoc(doc(db(COUPLE), "checklists", COUPLE), ticks({ "tea.order": true }), { merge: true }));
    await assertSucceeds(getDoc(doc(db(COUPLE), "checklists", COUPLE)));
    await assertSucceeds(setDoc(doc(db(COUPLE), "checklists", COUPLE), ticks({ "rom.rings": true }), { merge: true }));
  });

  it("nobody else reads or writes them, and vendors have none", async () => {
    await seed(env, `checklists/${COUPLE}`, { ticks: { "tea.order": true }, updatedAt: fixedTime });
    await assertFails(getDoc(doc(db(OTHER_COUPLE), "checklists", COUPLE)));
    await assertFails(getDoc(doc(db(), "checklists", COUPLE)));
    await assertFails(setDoc(doc(db(OTHER_COUPLE), "checklists", COUPLE), ticks({ x: true })));
    await assertFails(setDoc(doc(db(VENDOR), "checklists", VENDOR), ticks({ "tea.order": true })));
  });

  it("only ticks and a timestamp", async () => {
    await assertFails(setDoc(doc(db(COUPLE), "checklists", COUPLE), { ticks: {}, notes: "x", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db(COUPLE), "checklists", COUPLE), { ticks: [], updatedAt: serverTimestamp() }));
  });

  it("own items: known checklist, 1 to 120 characters, owner only", async () => {
    const mine = collection(db(COUPLE), "checklists", COUPLE, "items");
    const ref = await assertSucceeds(addDoc(mine, item()));
    await assertSucceeds(updateDoc(ref, { done: true, updatedAt: serverTimestamp() }));
    await assertFails(addDoc(mine, item({ ritualId: "other" })));
    await assertFails(addDoc(mine, item({ text: "" })));
    await assertFails(addDoc(mine, item({ text: "x".repeat(121) })));
    await assertFails(addDoc(mine, item({ owner: COUPLE })));
    await assertFails(addDoc(collection(db(OTHER_COUPLE), "checklists", COUPLE, "items"), item()));
    await assertFails(getDoc(doc(db(OTHER_COUPLE), "checklists", COUPLE, "items", ref.id)));
    await assertSucceeds(deleteDoc(ref));
  });
});

describe("venue access fields and menus", () => {
  it("a vendor can declare them, using known dietary ids only, once each", async () => {
    await assertSucceeds(setDoc(doc(db(VENDOR), "venues", "v1"), newVenue(VENDOR)));
    await assertFails(setDoc(doc(db(VENDOR), "venues", "v2"), newVenue(VENDOR, { menuOptions: ["kosher"] })));
    await assertFails(setDoc(doc(db(VENDOR), "venues", "v3"), newVenue(VENDOR, { menuOptions: ["halal", "halal"] })));
    await assertFails(setDoc(doc(db(VENDOR), "venues", "v4"), newVenue(VENDOR, { accessibleToilet: "yes" })));
  });

  it("venues saved before Phase 6 (no new fields) can still be updated", async () => {
    const legacy = { ...newVenue(VENDOR), createdAt: fixedTime, updatedAt: fixedTime } as Record<string, unknown>;
    for (const k of ["stepFreeEntrance", "accessibleToilet", "accessibleParking", "menuOptions"]) delete legacy[k];
    await seed(env, "venues/old", legacy);
    await assertSucceeds(updateDoc(doc(db(VENDOR), "venues", "old"), { name: "SAMPLE renamed", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(VENDOR), "venues", "old"), { menuOptions: ["vegetarian"], updatedAt: serverTimestamp() }));
  });
});

describe("item dietary tags", () => {
  beforeEach(async () => {
    await seedVendor(env, VENDOR, true);
  });

  it("known ids only, optional for items saved earlier", async () => {
    const items = collection(db(VENDOR), "vendors", VENDOR, "items");
    await assertSucceeds(addDoc(items, newItem({ category: "Food and drink", unit: "guest", dietaryTags: ["halal", "no-pork"] })));
    await assertFails(addDoc(items, newItem({ dietaryTags: ["spicy"] })));
    const legacy = { ...newItem(), createdAt: fixedTime, updatedAt: fixedTime } as Record<string, unknown>;
    delete legacy.dietaryTags;
    await seed(env, `vendors/${VENDOR}/items/old`, legacy);
    await assertSucceeds(updateDoc(doc(db(VENDOR), "vendors", VENDOR, "items", "old"), { active: false, updatedAt: serverTimestamp() }));
  });
});

describe("vendors/{uid}/blockedDates", () => {
  const blocked = (o: Record<string, unknown> = {}) => ({ date: "2027-05-15", note: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...o });

  it("the vendor adds and removes its own dates; a valid date and a short note only", async () => {
    await seedVendor(env, VENDOR, false);
    const mine = collection(db(VENDOR), "vendors", VENDOR, "blockedDates");
    const ref = await assertSucceeds(addDoc(mine, blocked()));
    await assertFails(addDoc(mine, blocked({ date: "15/05/2027" })));
    await assertFails(addDoc(mine, blocked({ date: "2027-13-01" })));
    await assertFails(addDoc(mine, blocked({ note: "x".repeat(81) })));
    await assertFails(addDoc(mine, blocked({ client: "Tan" })));
    await assertFails(updateDoc(ref, { date: "2027-05-16", updatedAt: serverTimestamp() }));
    await assertFails(addDoc(collection(db(OTHER_VENDOR), "vendors", VENDOR, "blockedDates"), blocked()));
    await assertFails(addDoc(collection(db(COUPLE), "vendors", VENDOR, "blockedDates"), blocked()));
    await assertSucceeds(deleteDoc(ref));
  });

  it("couples and visitors read them only once the business is published", async () => {
    await seedVendor(env, VENDOR, false);
    await seed(env, `vendors/${VENDOR}/blockedDates/b1`, { date: "2027-05-15", note: "", createdAt: fixedTime, updatedAt: fixedTime });
    await assertFails(getDoc(doc(db(COUPLE), "vendors", VENDOR, "blockedDates", "b1")));
    await seedVendor(env, VENDOR, true);
    await assertSucceeds(getDoc(doc(db(COUPLE), "vendors", VENDOR, "blockedDates", "b1")));
    await assertSucceeds(getDoc(doc(db(), "vendors", VENDOR, "blockedDates", "b1")));
  });
});

describe("plan wedding date", () => {
  const plan = (o: Record<string, unknown> = {}) => ({
    ownerUid: COUPLE,
    name: "SAMPLE plan",
    venueId: "v1",
    spaceId: "s1",
    tierKey: "peak",
    headcount: 185,
    themeId: "peranakan",
    selections: {},
    savedRenders: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...o,
  });

  it("optional; null or YYYY-MM-DD", async () => {
    const plans = collection(db(COUPLE), "projects");
    await assertSucceeds(addDoc(plans, plan()));
    await assertSucceeds(addDoc(plans, plan({ weddingDate: null })));
    const ref = await assertSucceeds(addDoc(plans, plan({ weddingDate: "2027-05-15" })));
    await assertFails(addDoc(plans, plan({ weddingDate: "15 May 2027" })));
    await assertFails(addDoc(plans, plan({ weddingDate: 20270515 })));
    await assertSucceeds(updateDoc(ref, { weddingDate: "2027-06-12", updatedAt: serverTimestamp() }));
  });
});

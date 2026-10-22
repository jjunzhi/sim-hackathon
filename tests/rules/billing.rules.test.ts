import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { COUPLE, OTHER_VENDOR, VENDOR, fixedTime, makeEnv, newVendorProfile, newVenue, seed, seedUser, seedVendor } from "./setup";

// Phase 7: plan status, the listed gate, bookings and feedback.
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

describe("billing/{uid}", () => {
  it("the vendor reads its own plan status and can never write it", async () => {
    await seed(env, `billing/${VENDOR}`, { status: "none", pilotUntilMs: Date.UTC(2099, 0, 1) });
    await assertSucceeds(getDoc(doc(db(VENDOR), "billing", VENDOR)));
    await assertFails(getDoc(doc(db(OTHER_VENDOR), "billing", VENDOR)));
    await assertFails(getDoc(doc(db(), "billing", VENDOR)));
    await assertFails(updateDoc(doc(db(VENDOR), "billing", VENDOR), { status: "active" }));
    await assertFails(setDoc(doc(db(OTHER_VENDOR), "billing", OTHER_VENDOR), { status: "active", pilotUntilMs: Date.UTC(2099, 0, 1) }));
  });

  it("invites and processed Stripe events are server-only", async () => {
    await seed(env, "invites/abcdefghijklmnopqrstuv", { pilotUntilMs: Date.UTC(2099, 0, 1), redeemedBy: null });
    await assertFails(getDoc(doc(db(VENDOR), "invites", "abcdefghijklmnopqrstuv")));
    await assertFails(updateDoc(doc(db(VENDOR), "invites", "abcdefghijklmnopqrstuv"), { redeemedBy: VENDOR }));
    await assertFails(setDoc(doc(db(VENDOR), "stripeEvents", "evt_1"), { type: "x" }));
  });
});

describe("listed: only the server lists a vendor", () => {
  it("a vendor can't create or change `listed` on its business or venues", async () => {
    await assertFails(setDoc(doc(db(VENDOR), "vendors", VENDOR), newVendorProfile({ listed: true })));
    await assertSucceeds(setDoc(doc(db(VENDOR), "vendors", VENDOR), newVendorProfile()));
    await assertFails(updateDoc(doc(db(VENDOR), "vendors", VENDOR), { listed: true, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db(VENDOR), "venues", "v1"), newVenue(VENDOR, { listed: true })));
    await assertSucceeds(setDoc(doc(db(VENDOR), "venues", "v2"), newVenue(VENDOR)));
    await assertFails(updateDoc(doc(db(VENDOR), "venues", "v2"), { listed: true, updatedAt: serverTimestamp() }));
  });

  it("a server-listed venue stays editable by its owner, without touching `listed`", async () => {
    await seed(env, "venues/live", { ...newVenue(VENDOR), status: "active", listed: false, createdAt: fixedTime, updatedAt: fixedTime });
    await assertSucceeds(updateDoc(doc(db(VENDOR), "venues", "live"), { name: "SAMPLE renamed", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(VENDOR), "venues", "live"), { listed: true, updatedAt: serverTimestamp() }));
  });

  it("a known active venue opens directly even when not listed (saved plans keep working)", async () => {
    await seed(env, "venues/lapsed", { ...newVenue(VENDOR), status: "active", listed: false, createdAt: fixedTime, updatedAt: fixedTime });
    await assertSucceeds(getDoc(doc(db(COUPLE), "venues", "lapsed")));
    await assertSucceeds(getDoc(doc(db(), "venues", "lapsed")));
  });

  it("discovering decorators needs published and listed", async () => {
    await seed(env, `vendors/${VENDOR}`, { ...newVendorProfile({ kinds: ["decorator"], published: true }), listed: true, createdAt: fixedTime, updatedAt: fixedTime });
    const q = (filters: ReturnType<typeof where>[]) => getDocs(query(collection(db(COUPLE), "vendors"), ...filters));
    await assertSucceeds(q([where("published", "==", true), where("listed", "==", true), where("kinds", "array-contains", "decorator")]));
    await assertFails(q([where("published", "==", true), where("kinds", "array-contains", "decorator")]));
    // A direct read of a published business is still allowed (an existing plan's prices).
    await assertSucceeds(getDoc(doc(db(COUPLE), "vendors", VENDOR)));
  });
});

describe("bookings/{leadId}", () => {
  const lead = (status: string, o: Record<string, unknown> = {}) => ({ coupleUid: COUPLE, vendorUid: VENDOR, status, createdAt: fixedTime, ...o });
  const booking = (o: Record<string, unknown> = {}) => ({
    leadId: "L1",
    vendorUid: VENDOR,
    coupleUid: COUPLE,
    eventDate: "2027-05-22",
    valueCents: 5_481_060,
    status: "claimed",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...o,
  });

  beforeEach(async () => {
    await seedVendor(env, VENDOR, true);
  });

  it("only the lead's vendor claims a booking, only on a confirmed lead, with matching parties", async () => {
    await seed(env, "leads/L1", lead("new"));
    await assertFails(setDoc(doc(db(VENDOR), "bookings", "L1"), booking()));
    await seed(env, "leads/L1", lead("confirmed"));
    await assertFails(setDoc(doc(db(OTHER_VENDOR), "bookings", "L1"), booking({ vendorUid: OTHER_VENDOR })));
    await assertFails(setDoc(doc(db(COUPLE), "bookings", "L1"), booking()));
    await assertFails(setDoc(doc(db(VENDOR), "bookings", "L1"), booking({ coupleUid: OTHER_COUPLE })));
    await assertFails(setDoc(doc(db(VENDOR), "bookings", "L1"), booking({ status: "confirmed" })));
    await assertFails(setDoc(doc(db(VENDOR), "bookings", "L1"), booking({ eventDate: "22/05/2027" })));
    await assertFails(setDoc(doc(db(VENDOR), "bookings", "L1"), booking({ valueCents: -1 })));
    await assertFails(setDoc(doc(db(VENDOR), "bookings", "L1"), booking({ contact: "x" })));
    await assertFails(setDoc(doc(db(VENDOR), "bookings", "L2"), booking()));
    await assertSucceeds(setDoc(doc(db(VENDOR), "bookings", "L1"), booking({ valueCents: null })));
  });

  it("the couple confirms or disputes once; nobody else reads it", async () => {
    await seed(env, "leads/L1", lead("confirmed"));
    await seed(env, "bookings/L1", { ...booking(), createdAt: fixedTime, updatedAt: fixedTime });
    await assertSucceeds(getDoc(doc(db(COUPLE), "bookings", "L1")));
    await assertSucceeds(getDoc(doc(db(VENDOR), "bookings", "L1")));
    await assertFails(getDoc(doc(db(OTHER_COUPLE), "bookings", "L1")));
    await assertFails(updateDoc(doc(db(COUPLE), "bookings", "L1"), { status: "confirmed", valueCents: 1, respondedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(OTHER_COUPLE), "bookings", "L1"), { status: "confirmed", respondedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(COUPLE), "bookings", "L1"), { status: "confirmed", respondedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(COUPLE), "bookings", "L1"), { status: "disputed", respondedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    // A confirmed booking can't be withdrawn or edited by the vendor.
    await assertFails(deleteDoc(doc(db(VENDOR), "bookings", "L1")));
    await assertFails(updateDoc(doc(db(VENDOR), "bookings", "L1"), { valueCents: 1, status: "claimed", updatedAt: serverTimestamp() }));
  });

  it("after a dispute the vendor may correct it, which asks the couple again", async () => {
    await seed(env, "leads/L1", lead("confirmed"));
    await seed(env, "bookings/L1", { ...booking(), status: "disputed", createdAt: fixedTime, updatedAt: fixedTime });
    await assertFails(updateDoc(doc(db(VENDOR), "bookings", "L1"), { status: "confirmed", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(VENDOR), "bookings", "L1"), { eventDate: "2027-05-29", status: "claimed", updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(db(VENDOR), "bookings", "L1")));
  });
});

describe("feedback", () => {
  it("vendors send it; nobody reads it from the app", async () => {
    const fb = (o: Record<string, unknown> = {}) => ({ uid: VENDOR, text: "SAMPLE feedback", page: "/vendor", createdAt: serverTimestamp(), ...o });
    const ref = await assertSucceeds(addDoc(collection(db(VENDOR), "feedback"), fb()));
    await assertFails(addDoc(collection(db(VENDOR), "feedback"), fb({ uid: OTHER_VENDOR })));
    await assertFails(addDoc(collection(db(VENDOR), "feedback"), fb({ text: "" })));
    await assertFails(addDoc(collection(db(VENDOR), "feedback"), fb({ text: "x".repeat(1001) })));
    await assertFails(addDoc(collection(db(VENDOR), "feedback"), fb({ email: "x@example.test" })));
    await assertFails(addDoc(collection(db(COUPLE), "feedback"), fb({ uid: COUPLE })));
    await assertFails(getDoc(doc(db(VENDOR), "feedback", ref.id)));
  });
});

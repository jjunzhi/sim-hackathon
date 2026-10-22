import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { COUPLE, VENDOR, fixedTime, makeEnv, seed, seedUser } from "./setup";

let env: RulesTestEnvironment;
const OTHER_COUPLE = "couple-dan";
const AUNTIE = "anon-auntie";
const COUSIN = "anon-cousin";
const SHARE = "AbCdEfGhIjKlMnOpQrStUv"; // 22 chars
const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
// A real anonymous sign-in carries this provider in its token.
const anon = (uid: string) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const key = "a".repeat(64);
const option = (o: Record<string, unknown> = {}) => ({
  planId: "p1", planName: "SAMPLE plan", venueName: "SAMPLE Hall", renderKey: key, renderPath: `renders/${key}.jpg`,
  themeId: "chinese", demo: true, aspect: "4 / 3", estimateTotalCents: 5_000_000, ...o,
});
const share = (o: Record<string, unknown> = {}) => ({
  ownerUid: COUPLE, title: "Which one?", status: "active", options: [option(), option({ themeId: "peranakan" })],
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...o,
});
const vote = (o: Record<string, unknown> = {}) => ({ optionIndex: 0, name: "Auntie Mei", note: "Love it", createdAt: serverTimestamp(), ...o });

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

const seedShare = (o: Record<string, unknown> = {}) => seed(env, `shares/${SHARE}`, { ...share(), createdAt: fixedTime, updatedAt: fixedTime, ...o });

describe("anonymous family sessions", () => {
  it("can never create a profile, so never a plan, link or lead", async () => {
    await assertFails(setDoc(doc(anon(AUNTIE), `users/${AUNTIE}`), { role: "couple", consent: { version: "v", acceptedAt: serverTimestamp() }, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(anon(AUNTIE), `shares/${SHARE}`), share({ ownerUid: AUNTIE })));
  });
});

describe("family links", () => {
  it("a couple creates a link with 2 or 3 renders", async () => {
    await assertSucceeds(setDoc(doc(db(COUPLE), `shares/${SHARE}`), share()));
  });

  it("refuses short (guessable) ids, 1 or 4 options, and odd render paths", async () => {
    await assertFails(setDoc(doc(db(COUPLE), "shares/short"), share()));
    await assertFails(setDoc(doc(db(COUPLE), `shares/${SHARE}`), share({ options: [option()] })));
    await assertFails(setDoc(doc(db(COUPLE), `shares/${SHARE}`), share({ options: [option(), option(), option(), option()] })));
    await assertFails(setDoc(doc(db(COUPLE), `shares/${SHARE}`), share({ options: [option(), option({ renderPath: "venues/x/private.jpg" })] })));
    await assertFails(setDoc(doc(db(VENDOR), `shares/${SHARE}`), share({ ownerUid: VENDOR })));
  });

  it("anyone signed in (including anonymous) can open a link by id; nobody can list others' links", async () => {
    await seedShare();
    await assertSucceeds(getDoc(doc(anon(AUNTIE), `shares/${SHARE}`)));
    await assertFails(getDoc(doc(db(), `shares/${SHARE}`)));
    await assertFails(getDocs(collection(anon(AUNTIE), "shares")));
    await assertFails(getDocs(query(collection(db(OTHER_COUPLE), "shares"), where("ownerUid", "==", COUPLE))));
    await assertSucceeds(getDocs(query(collection(db(COUPLE), "shares"), where("ownerUid", "==", COUPLE))));
  });

  it("the owner can only revoke (clearing options), and revoking is final", async () => {
    await seedShare();
    await assertFails(updateDoc(doc(db(COUPLE), `shares/${SHARE}`), { title: "New", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(COUPLE), `shares/${SHARE}`), { status: "revoked", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(OTHER_COUPLE), `shares/${SHARE}`), { status: "revoked", options: [], title: "", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(COUPLE), `shares/${SHARE}`), { status: "revoked", options: [], title: "", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(COUPLE), `shares/${SHARE}`), { status: "active", updatedAt: serverTimestamp() }));
  });

  it("only the owner deletes", async () => {
    await seedShare();
    await assertFails(deleteDoc(doc(anon(AUNTIE), `shares/${SHARE}`)));
    await assertSucceeds(deleteDoc(doc(db(COUPLE), `shares/${SHARE}`)));
  });
});

describe("votes", () => {
  const voteRef = (fs: ReturnType<typeof anon>, uid: string) => doc(fs, `shares/${SHARE}/votes/${uid}`);

  it("a family member votes once, anonymously", async () => {
    await seedShare();
    await assertSucceeds(setDoc(voteRef(anon(AUNTIE), AUNTIE), vote()));
  });

  it("a second vote from the same voter is blocked (no change, no delete)", async () => {
    await seedShare();
    await assertSucceeds(setDoc(voteRef(anon(AUNTIE), AUNTIE), vote()));
    await assertFails(setDoc(voteRef(anon(AUNTIE), AUNTIE), vote({ optionIndex: 1 })));
    await assertFails(updateDoc(voteRef(anon(AUNTIE), AUNTIE), { optionIndex: 1 }));
    await assertFails(deleteDoc(voteRef(anon(AUNTIE), AUNTIE)));
  });

  it("nobody votes for someone else, for a missing option, or on a revoked link", async () => {
    await seedShare();
    await assertFails(setDoc(voteRef(anon(AUNTIE), COUSIN), vote()));
    await assertFails(setDoc(voteRef(anon(COUSIN), COUSIN), vote({ optionIndex: 2 })));
    await assertFails(setDoc(voteRef(anon(COUSIN), COUSIN), vote({ note: "x".repeat(281) })));
    await assertFails(setDoc(voteRef(anon(COUSIN), COUSIN), vote({ ip: "1.2.3.4" })));
    await seedShare({ status: "revoked", options: [], title: "" });
    await assertFails(setDoc(voteRef(anon(COUSIN), COUSIN), vote()));
  });

  it("only the couple can delete votes (when deleting their link)", async () => {
    await seedShare();
    await seed(env, `shares/${SHARE}/votes/${AUNTIE}`, { ...vote(), createdAt: fixedTime });
    await assertFails(deleteDoc(voteRef(anon(AUNTIE), AUNTIE)));
    await assertFails(deleteDoc(voteRef(db(OTHER_COUPLE), AUNTIE)));
    await assertSucceeds(deleteDoc(voteRef(db(COUPLE), AUNTIE)));
  });

  it("voters see only their own vote; the couple sees all", async () => {
    await seedShare();
    await seed(env, `shares/${SHARE}/votes/${AUNTIE}`, { ...vote(), createdAt: fixedTime });
    await assertSucceeds(getDoc(voteRef(anon(AUNTIE), AUNTIE)));
    await assertFails(getDoc(voteRef(anon(COUSIN), AUNTIE)));
    await assertSucceeds(getDocs(collection(db(COUPLE), `shares/${SHARE}/votes`)));
    await assertFails(getDocs(collection(db(OTHER_COUPLE), `shares/${SHARE}/votes`)));
  });
});

describe("leads and confirmations", () => {
  const lead = (o: Record<string, unknown> = {}) => ({
    coupleUid: COUPLE, vendorUid: VENDOR, venueOwnerUid: VENDOR, planId: "p1", venueId: "v1", venueName: "SAMPLE Hall", vendorName: "SAMPLE Co",
    spaceId: "s1", spaceName: "SAMPLE Ballroom", tierKey: "peak", headcount: 185, selections: { "item:vendor:arch": 1 }, renders: [],
    contact: { name: "Sam", reachAt: "sam@example.test", eventDate: "", message: "" }, status: "new", confirmationId: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...o,
  });
  const seedPlan = () => seed(env, "projects/p1", { ownerUid: COUPLE, name: "x", venueId: "v1", spaceId: "s1", tierKey: "peak", headcount: 185, themeId: "chinese", selections: {}, savedRenders: [], createdAt: fixedTime, updatedAt: fixedTime });
  const seedLead = (o: Record<string, unknown> = {}) => seed(env, "leads/L1", { ...lead(), createdAt: fixedTime, updatedAt: fixedTime, ...o });
  const confirmation = (o: Record<string, unknown> = {}) => ({
    leadId: "L1", vendorUid: VENDOR, coupleUid: COUPLE, planId: "p1", vendorName: "SAMPLE Co", venueName: "SAMPLE Hall", spaceName: "SAMPLE Ballroom",
    tierKey: "peak", headcount: 185, snapshot: { totalCents: 100 }, engineVersion: "1", confirmedBy: VENDOR, confirmedByName: "SAMPLE Co", note: "",
    confirmedAt: serverTimestamp(), validUntil: Timestamp.fromMillis(Date.now() + 14 * 86_400_000), ...o,
  });
  const confirmBatch = (fs: ReturnType<typeof anon>, o: Record<string, unknown> = {}) => {
    const b = writeBatch(fs);
    b.set(doc(fs, "confirmations/L1"), confirmation(o));
    b.update(doc(fs, "leads/L1"), { status: "confirmed", confirmationId: "L1", updatedAt: serverTimestamp() });
    return b.commit();
  };

  it("a couple requests a confirmation for their own plan only", async () => {
    await seedPlan();
    await assertSucceeds(addDoc(collection(db(COUPLE), "leads"), lead()));
    await assertFails(addDoc(collection(db(OTHER_COUPLE), "leads"), lead({ coupleUid: OTHER_COUPLE })));
    await assertFails(addDoc(collection(db(COUPLE), "leads"), lead({ status: "confirmed" })));
    await assertFails(addDoc(collection(db(COUPLE), "leads"), lead({ contact: { name: "", reachAt: "x", eventDate: "", message: "" } })));
    await assertFails(addDoc(collection(anon(AUNTIE), "leads"), lead({ coupleUid: AUNTIE })));
  });

  it("only that couple and that vendor can read a lead", async () => {
    await seedLead();
    await assertSucceeds(getDoc(doc(db(COUPLE), "leads/L1")));
    await assertSucceeds(getDoc(doc(db(VENDOR), "leads/L1")));
    await assertFails(getDoc(doc(db(OTHER_COUPLE), "leads/L1")));
    await assertSucceeds(getDocs(query(collection(db(VENDOR), "leads"), where("vendorUid", "==", VENDOR))));
  });

  it("the vendor confirms with an immutable snapshot", async () => {
    await seedLead();
    await assertSucceeds(confirmBatch(db(VENDOR)));
    await assertFails(updateDoc(doc(db(VENDOR), "confirmations/L1"), { snapshot: { totalCents: 1 } }));
    await assertFails(deleteDoc(doc(db(VENDOR), "confirmations/L1")));
    await assertFails(updateDoc(doc(db(VENDOR), "leads/L1"), { status: "new", confirmationId: null, updatedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(db(COUPLE), "confirmations/L1")));
    await assertFails(getDoc(doc(db(OTHER_COUPLE), "confirmations/L1")));
  });

  it("confirmations must match the lead and stay within 90 days", async () => {
    await seedLead();
    await assertFails(confirmBatch(db(VENDOR), { headcount: 50 }));
    await assertFails(confirmBatch(db(VENDOR), { validUntil: Timestamp.fromMillis(Date.now() + 120 * 86_400_000) }));
    await assertFails(confirmBatch(db(VENDOR), { validUntil: Timestamp.fromMillis(Date.now() - 1000) }));
    await assertFails(confirmBatch(db(OTHER_COUPLE)));
    await assertFails(confirmBatch(db(COUPLE)));
  });

  it("the vendor can decline; the couple can withdraw only unconfirmed requests", async () => {
    await seedLead();
    await assertSucceeds(updateDoc(doc(db(VENDOR), "leads/L1"), { status: "declined", updatedAt: serverTimestamp() }));
    await seedLead({ status: "confirmed", confirmationId: "L1" });
    await assertFails(deleteDoc(doc(db(COUPLE), "leads/L1")));
    await seedLead();
    await assertSucceeds(deleteDoc(doc(db(COUPLE), "leads/L1")));
  });
});

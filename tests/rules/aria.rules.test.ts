import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { COUPLE, VENDOR, makeEnv, seedUser } from "./setup";

// Aria (Rose Garden): budget, brief and timeline on a plan, and the plan's decision log.
let env: RulesTestEnvironment;
const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const OTHER_COUPLE = "couple-dan";
const PLAN = "plan-1";

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
const brief = (o: Record<string, unknown> = {}) => ({ style: "relaxed garden", traditions: ["Malay", "Chinese"], dietaryTags: ["halal"], stepFree: true, notes: "Grandparents need seats near the front.", ...o });
const decision = (o: Record<string, unknown> = {}) => ({
  action: "applied",
  summary: "Option A: move to the terrace.",
  changes: ["Room: SAMPLE Orchid Terrace", "Guests: 185 to 80"],
  beforeCents: 5_000_000,
  afterCents: 3_100_000,
  createdAt: serverTimestamp(),
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
  await assertSucceeds(setDoc(doc(db(COUPLE), "projects", PLAN), plan()));
});

describe("plan budget, brief and timeline", () => {
  const update = (o: Record<string, unknown>) => updateDoc(doc(db(COUPLE), "projects", PLAN), { ...o, updatedAt: serverTimestamp() });
  const line = (time: string, label = "Something") => ({ time, label });

  it("a plan saved without them stays valid, and the owner can add them", async () => {
    await assertSucceeds(update({ budgetCents: 4_500_000, brief: brief(), timeline: [{ time: "11:00", label: "Ceremony" }, { time: "13:00", label: "Lunch" }] }));
    await assertSucceeds(update({ budgetCents: null, brief: null, timeline: [] }));
  });

  it("budget is whole cents within range", async () => {
    for (const bad of [0, -100, 12.5, "45000", 1_000_000_001]) await assertFails(update({ budgetCents: bad }));
  });

  it("brief: exact fields, known tags, short text", async () => {
    await assertFails(update({ brief: brief({ traditions: ["Klingon"] }) }));
    await assertFails(update({ brief: brief({ traditions: ["Malay", "Malay"] }) }));
    await assertFails(update({ brief: brief({ dietaryTags: ["keto"] }) }));
    await assertFails(update({ brief: brief({ style: "x".repeat(201) }) }));
    await assertFails(update({ brief: brief({ notes: "x".repeat(501) }) }));
    await assertFails(update({ brief: brief({ stepFree: "yes" }) }));
    await assertFails(update({ brief: brief({ phone: "+65 9123 4567" }) }));
    const missing: Record<string, unknown> = brief();
    delete missing.notes;
    await assertFails(update({ brief: missing }));
    await assertSucceeds(update({ brief: brief({ notes: "x".repeat(500), style: "" }) }));
  });

  it("timeline: up to 15 lines, each a valid time and a short label", async () => {
    await assertSucceeds(update({ timeline: Array.from({ length: 15 }, (_, i) => line(`${String(i).padStart(2, "0")}:00`, "x".repeat(120))) }));
    await assertFails(update({ timeline: Array.from({ length: 16 }, () => line("10:00")) }));
    await assertFails(update({ timeline: [line("24:00")] }));
    await assertFails(update({ timeline: [line("9:00")] }));
    await assertFails(update({ timeline: [line("10:00", "")] }));
    await assertFails(update({ timeline: [line("10:00", "x".repeat(121))] }));
    await assertFails(update({ timeline: [{ ...line("10:00"), who: "someone" }] }));
    await assertFails(update({ timeline: [line("10:00", "two\nlines")] }));
    await assertFails(update({ timeline: [{ time: "10:00" }] }));
    await assertFails(update({ timeline: [{ time: 1000, label: "x" }] }));
    // The last of 15 lines is checked too.
    await assertFails(update({ timeline: [...Array.from({ length: 14 }, () => line("10:00")), line("99:99")] }));
    await assertFails(update({ timeline: "11:00 Ceremony" }));
  });

  it("a plan with every field at its limit still saves", async () => {
    await assertSucceeds(
      update({
        budgetCents: 1_000_000_000,
        weddingDate: "2027-05-22",
        selections: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`item:v:${i}`, 1])),
        brief: brief({ style: "s".repeat(200), notes: "n".repeat(500), traditions: ["Chinese", "Malay", "Indian", "Peranakan", "Western", "Fusion", "Halal-friendly"], dietaryTags: ["halal", "vegetarian", "vegan", "no-beef", "no-pork"] }),
        timeline: Array.from({ length: 15 }, (_, i) => line(`${String(i).padStart(2, "0")}:30`, "x".repeat(120))),
        itinerary: { title: "t".repeat(80), style: "festive", approved: true },
      }),
    );
  });

  it("itinerary: an optional heading, a known style and the approval", async () => {
    const it = (o: Record<string, unknown>) => ({ title: "Mei & Arjun's Wedding", style: "classic", approved: true, ...o });
    await assertSucceeds(update({ itinerary: it({}) }));
    await assertSucceeds(update({ itinerary: it({ title: "", style: "botanical", approved: false }) }));
    await assertSucceeds(update({ itinerary: null }));
    await assertFails(update({ itinerary: it({ title: "x".repeat(81) }) }));
    await assertFails(update({ itinerary: it({ style: "gothic" }) }));
    await assertFails(update({ itinerary: it({ approved: "yes" }) }));
    await assertFails(update({ itinerary: it({ phone: "+65 9123 4567" }) }));
    const missing: Record<string, unknown> = it({});
    delete missing.style;
    await assertFails(update({ itinerary: missing }));
    await assertFails(updateDoc(doc(db(OTHER_COUPLE), "projects", PLAN), { itinerary: it({}), updatedAt: serverTimestamp() }));
  });

  it("someone else can't set them", async () => {
    await assertFails(updateDoc(doc(db(OTHER_COUPLE), "projects", PLAN), { budgetCents: 100, updatedAt: serverTimestamp() }));
  });
});

describe("decision log (projects/{id}/decisions)", () => {
  const log = (uid: string, o: Record<string, unknown> = {}) => addDoc(collection(db(uid), "projects", PLAN, "decisions"), decision(o));

  it("the plan's owner records and reads decisions", async () => {
    const ref = await assertSucceeds(log(COUPLE));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDocs(collection(db(COUPLE), "projects", PLAN, "decisions")));
    for (const action of ["adjusted", "declined", "alternatives"]) await assertSucceeds(log(COUPLE, { action }));
    await assertSucceeds(log(COUPLE, { beforeCents: null, afterCents: null, changes: [] }));
  });

  it("nobody else can write or read them", async () => {
    await assertFails(log(OTHER_COUPLE));
    await assertFails(log(VENDOR));
    await assertFails(addDoc(collection(db(), "projects", PLAN, "decisions"), decision()));
    const ref = await log(COUPLE);
    await assertFails(getDoc(doc(db(OTHER_COUPLE), ref.path)));
    await assertFails(getDocs(collection(db(OTHER_COUPLE), "projects", PLAN, "decisions")));
    await assertFails(deleteDoc(doc(db(OTHER_COUPLE), ref.path)));
  });

  it("write-once: no edits; the owner may delete", async () => {
    const ref = await log(COUPLE);
    await assertFails(updateDoc(doc(db(COUPLE), ref.path), { summary: "changed" }));
    await assertSucceeds(deleteDoc(doc(db(COUPLE), ref.path)));
  });

  it("validates every field", async () => {
    await assertFails(log(COUPLE, { action: "booked" }));
    await assertFails(log(COUPLE, { summary: "x".repeat(401) }));
    await assertFails(log(COUPLE, { changes: Array.from({ length: 11 }, () => "a") }));
    await assertFails(log(COUPLE, { changes: ["ok", ""] }));
    await assertFails(log(COUPLE, { changes: [...Array.from({ length: 9 }, () => "a"), "x".repeat(201)] }));
    await assertFails(log(COUPLE, { changes: [42] }));
    await assertFails(log(COUPLE, { beforeCents: -1 }));
    await assertFails(log(COUPLE, { afterCents: 1.5 }));
    await assertFails(log(COUPLE, { createdAt: new Date(2020, 0, 1) }));
    await assertFails(log(COUPLE, { guestNames: ["Auntie Mei"] }));
    const missing: Record<string, unknown> = decision();
    delete missing.afterCents;
    await assertFails(addDoc(collection(db(COUPLE), "projects", PLAN, "decisions"), missing));
  });

  it("nothing is logged on a plan that doesn't exist", async () => {
    await assertFails(addDoc(collection(db(COUPLE), "projects", "no-such-plan", "decisions"), decision()));
  });
});

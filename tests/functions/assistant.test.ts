import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PROJECT_ID, fixedTime, makeEnv, newItem, newSpace, newVendorProfile, newVenue, seed, seedUser } from "../rules/setup";

// The emulator runs with GEMINI_API_KEY=demo, so the assistant answers with
// its labelled DEMO rules; the whole request, limit and validation path runs.
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const FN = `http://127.0.0.1:5001/${PROJECT_ID}/asia-southeast1/planAssistant`;
const OWNER = "assistant-owner";

let env: RulesTestEnvironment;

async function signUp(email: string) {
  const res = await fetch(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-1", returnSecureToken: true }),
  });
  const b = (await res.json()) as { localId: string; idToken: string };
  return { uid: b.localId, idToken: b.idToken };
}

type Proposal = { label: string; summary: string; changes: Array<Record<string, unknown>> };
type Res = {
  result?: { reply: string; proposals: Proposal[]; shortlist: Array<{ venueId: string; venueName: string; reason: string }>; offerRequest: boolean; demo: boolean; remainingToday: number };
  error?: { status: string; message: string };
};
async function ask(idToken: string | null, data: Record<string, unknown>): Promise<Res> {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return (await res.json()) as Res;
}

const plan = { headcount: 120, spaceId: "ball", tierKey: "standard", themeId: "peranakan", weddingDate: null, selections: {} };
const request = (text: string, extra: Record<string, unknown> = {}) => ({ venueId: "live", plan, messages: [{ role: "user", text }], locale: "en", estimateTotalCents: 800_000, ...extra });

/** A listed venue with one room, as the server's triggers leave it: listed (pilot plan) and with a capacity summary. */
async function listedVenue(id: string, name: string, room: { capacityMin: number; capacityMax: number }) {
  await seed(env, `venues/${id}`, { ...newVenue(OWNER, { name }), status: "active", createdAt: fixedTime, updatedAt: fixedTime });
  await seed(env, `venues/${id}/spaces/r1`, { ...newSpace(room), createdAt: fixedTime, updatedAt: fixedTime });
  for (let i = 0; i < 40; i++) {
    let ready = false;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = (await getDoc(doc(ctx.firestore(), "venues", id))).data();
      ready = d?.listed === true && d?.capacitySummary?.max === room.capacityMax;
    });
    if (ready) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`venue ${id} never became listed`);
}

beforeAll(async () => {
  env = await makeEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seedUser(env, OWNER, "vendor");
  // A pilot plan keeps the owner's venues listed when the listing trigger runs.
  await seed(env, `billing/${OWNER}`, { status: "none", pilotUntilMs: Date.UTC(2099, 0, 1), pastDueSinceMs: null, stripeCustomerId: null, stripeSubscriptionId: null, currentPeriodEndMs: null, cancelAtPeriodEnd: false, commissionBps: 0, lastEventAtMs: null });
  await seed(env, `vendors/${OWNER}`, { ...newVendorProfile({ kinds: ["venue"], published: true }), listed: true, createdAt: fixedTime, updatedAt: fixedTime });
  await seed(env, "venues/live", { ...newVenue(OWNER), status: "active", listed: true, createdAt: fixedTime, updatedAt: fixedTime });
  await seed(env, "venues/live/spaces/ball", { ...newSpace(), createdAt: fixedTime, updatedAt: fixedTime });
  await seed(env, `vendors/${OWNER}/items/arch`, { ...newItem(), createdAt: fixedTime, updatedAt: fixedTime });
});

describe("planAssistant", () => {
  it("requires a signed-in couple", async () => {
    expect((await ask(null, request("hi"))).error?.status).toBe("UNAUTHENTICATED");
    const vendor = await signUp(`asst-vendor-${Date.now()}@example.test`);
    await seedUser(env, vendor.uid, "vendor");
    expect((await ask(vendor.idToken, request("hi"))).error?.status).toBe("PERMISSION_DENIED");
  });

  it("DEMO: suggests checked changes from the venue's real items, and counts the message", async () => {
    const c = await signUp(`asst-couple-${Date.now()}@example.test`);
    await seedUser(env, c.uid, "couple");
    const r = await ask(c.idToken, request("We'd like 150 guests, Modern Botanical, and add the floral arch"));
    expect(r.error).toBeUndefined();
    expect(r.result?.demo).toBe(true);
    expect(r.result?.reply.startsWith("DEMO")).toBe(true);
    expect(r.result?.proposals).toHaveLength(1);
    expect(r.result?.proposals[0]?.label).toBe("");
    expect(r.result?.proposals[0]?.changes).toEqual(
      expect.arrayContaining([
        { kind: "headcount", value: 150 },
        { kind: "theme", themeId: "modern-botanical" },
        { kind: "add", key: `item:${OWNER}:arch`, quantity: 1 },
      ]),
    );
    expect(r.result?.remainingToday).toBe(29);
    let usage: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const docs = await import("firebase/firestore").then(({ collection, getDocs }) => getDocs(collection(ctx.firestore(), "usage")));
      usage = docs.docs.find((d) => d.id.startsWith(`chat_user_${c.uid}_`))?.data();
    });
    expect(usage).toMatchObject({ subject: c.uid, kind: "chat", count: 1 });
  });

  it("DEMO: over budget gives labelled options; nothing is applied on the server", async () => {
    const c = await signUp(`asst-options-${Date.now()}@example.test`);
    await seedUser(env, c.uid, "couple");
    const r = await ask(c.idToken, request("We're over budget. What are my options?", { plan: { ...plan, selections: { [`item:${OWNER}:arch`]: 1 } } }));
    expect(r.result?.proposals.map((p) => p.label)).toEqual(["Option A", "Option B"]);
    expect(r.result?.proposals[0]?.changes).toEqual([{ kind: "remove", key: `item:${OWNER}:arch` }]);
    // The callable never writes plans: only the couple's Apply does.
    let plans = 0;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { collection, getDocs } = await import("firebase/firestore");
      plans = (await getDocs(collection(ctx.firestore(), "projects"))).size;
    });
    expect(plans).toBe(0);
  });

  it("DEMO: shortlists only other active, listed venues", async () => {
    await listedVenue("other", "SAMPLE Other Hall", { capacityMin: 50, capacityMax: 300 });
    // A draft venue never appears, listed or not.
    await seed(env, "venues/hidden", { ...newVenue(OWNER, { name: "SAMPLE Draft" }), status: "draft", createdAt: fixedTime, updatedAt: fixedTime });
    const c = await signUp(`asst-short-${Date.now()}@example.test`);
    await seedUser(env, c.uid, "couple");
    const r = await ask(c.idToken, request("Show me other venues"));
    expect(r.result?.shortlist).toEqual([{ venueId: "other", venueName: "SAMPLE Other Hall", reason: "DEMO: has a room for 120 guests." }]);
  });

  it("DEMO: an over-capacity guest list is counted by seats, without reading labels into the reply", async () => {
    const c = await signUp(`asst-guests-${Date.now()}@example.test`);
    await seedUser(env, c.uid, "couple");
    await seed(env, `guestLists/${c.uid}/parties/p1`, { label: "Auntie Mei's family", tier: "must", seats: 30, plusOnes: 0, createdAt: fixedTime, updatedAt: fixedTime });
    await seed(env, `guestLists/${c.uid}/parties/p2`, { label: "Office friends", tier: "casual", seats: 300, plusOnes: 10, createdAt: fixedTime, updatedAt: fixedTime });
    await listedVenue("huge", "SAMPLE Huge Hall", { capacityMin: 100, capacityMax: 500 });
    const r = await ask(c.idToken, request("We have too many guests"));
    // 340 seats: the shortlist looks for a room that fits all of them.
    expect(r.result?.shortlist.map((v) => v.reason)).toEqual(["DEMO: has a room for 340 guests."]);
    expect(JSON.stringify(r.result)).not.toContain("Auntie");
    expect(r.result?.reply).toContain("never suggest removing particular guests");
  });

  it("accepts budget, brief and timeline in the plan, and refuses a brief that isn't checked", async () => {
    const c = await signUp(`asst-brief-${Date.now()}@example.test`);
    await seedUser(env, c.uid, "couple");
    const withBrief = { ...plan, budgetCents: 4_500_000, brief: { style: "garden", traditions: ["Malay"], dietaryTags: ["halal"], stepFree: true, notes: "" }, timeline: [{ time: "11:00", label: "Ceremony" }] };
    const r = await ask(c.idToken, request("Add vegetarian food too", { plan: withBrief }));
    expect(r.result?.proposals[0]?.changes).toEqual([{ kind: "brief", brief: { style: "garden", traditions: ["Malay"], dietaryTags: ["halal", "vegetarian"], stepFree: true, notes: "" } }]);
  });

  it("deleting a plan deletes its decision log", async () => {
    await seed(env, "projects/gone", { ownerUid: "someone", name: "x" });
    await seed(env, "projects/gone/decisions/d1", { action: "applied", summary: "s", changes: [], beforeCents: null, afterCents: null, createdAt: fixedTime });
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { deleteDoc, doc: d } = await import("firebase/firestore");
      await deleteDoc(d(ctx.firestore(), "projects/gone"));
    });
    let left = 1;
    for (let i = 0; i < 40 && left > 0; i++) {
      await new Promise((r) => setTimeout(r, 500));
      await env.withSecurityRulesDisabled(async (ctx) => {
        const { collection, getDocs } = await import("firebase/firestore");
        left = (await getDocs(collection(ctx.firestore(), "projects/gone/decisions"))).size;
      });
    }
    expect(left).toBe(0);
  });

  it("stops at the daily limit set by an admin", async () => {
    await seed(env, "config/assistantLimits", { userPerDay: 1 });
    const c = await signUp(`asst-limit-${Date.now()}@example.test`);
    await seedUser(env, c.uid, "couple");
    expect((await ask(c.idToken, request("hello"))).result).toBeDefined();
    const second = await ask(c.idToken, request("hello again"));
    expect(second.error?.status).toBe("RESOURCE_EXHAUSTED");
  });

  it("refuses malformed requests and unknown or draft venues", async () => {
    const c = await signUp(`asst-bad-${Date.now()}@example.test`);
    await seedUser(env, c.uid, "couple");
    expect((await ask(c.idToken, request("x".repeat(2001)))).error?.status).toBe("INVALID_ARGUMENT");
    expect((await ask(c.idToken, request("hi", { messages: [] }))).error?.status).toBe("INVALID_ARGUMENT");
    expect((await ask(c.idToken, request("hi", { venueId: "nope" }))).error?.status).toBe("NOT_FOUND");
    await seed(env, "venues/draft", { ...newVenue(OWNER), status: "draft", createdAt: fixedTime, updatedAt: fixedTime });
    expect((await ask(c.idToken, request("hi", { venueId: "draft" }))).error?.status).toBe("NOT_FOUND");
  });

  it("assistant usage is readable only by its owner", async () => {
    const c = await signUp(`asst-read-${Date.now()}@example.test`);
    await seedUser(env, c.uid, "couple");
    await ask(c.idToken, request("hello"));
    let id = "";
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { collection, getDocs } = await import("firebase/firestore");
      id = (await getDocs(collection(ctx.firestore(), "usage"))).docs.find((d) => d.id.startsWith(`chat_user_${c.uid}_`))!.id;
    });
    const other = env.authenticatedContext("someone-else").firestore();
    await expect(getDoc(doc(other, "usage", id))).rejects.toThrow();
    await expect(getDoc(doc(env.authenticatedContext(c.uid).firestore(), "usage", id))).resolves.toBeDefined();
  });
});

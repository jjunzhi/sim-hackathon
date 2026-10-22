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

type Res = { result?: { reply: string; proposal: { summary: string; changes: Array<Record<string, unknown>> } | null; demo: boolean; remainingToday: number }; error?: { status: string; message: string } };
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

beforeAll(async () => {
  env = await makeEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seedUser(env, OWNER, "vendor");
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
    expect(r.result?.proposal?.changes).toEqual(
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

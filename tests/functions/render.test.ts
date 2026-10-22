import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUCKET, PROJECT_ID, fixedTime, makeEnv, newItem, newSpace, seed, seedUser, seedVenue, newVendorProfile } from "../rules/setup";

// Runs against the emulators with no GEMINI_API_KEY, so requestRender is in DEMO mode:
// the full cache / quota / access path runs, but no AI service is called.
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const FN = `http://127.0.0.1:5001/${PROJECT_ID}/asia-southeast1/requestRender`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

let env: RulesTestEnvironment;
let couple: { uid: string; idToken: string };
let owner: { uid: string; idToken: string };
const DECORATOR = "deco-elsewhere";

async function signUp(email: string) {
  const res = await fetch(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-1", returnSecureToken: true }),
  });
  const b = (await res.json()) as { localId: string; idToken: string };
  return { uid: b.localId, idToken: b.idToken };
}

type CallResult = { result?: { key: string; path: string; cacheHit: boolean; demo: boolean }; error?: { status: string; message: string } };
async function render(idToken: string, data: Record<string, unknown>): Promise<CallResult> {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  return (await res.json()) as CallResult;
}

const req = (themeId: string, itemIds: string[], extra: Record<string, unknown> = {}) => ({
  venueId: "live",
  spaceId: "ball",
  themeId,
  items: itemIds.map((itemId) => ({ vendorUid: owner.uid, itemId })),
  ...extra,
});

async function usageCount(id: string) {
  let n = 0;
  await env.withSecurityRulesDisabled(async (ctx) => {
    n = ((await getDoc(doc(ctx.firestore(), `usage/${id}`))).get("count") as number | undefined) ?? 0;
  });
  return n;
}
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
const coupleToday = () => usageCount(`user_${couple.uid}_${todayKey()}`);

async function admin(fn: (db: ReturnType<ReturnType<RulesTestEnvironment["unauthenticatedContext"]>["firestore"]>) => Promise<void>) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

beforeAll(async () => {
  env = await makeEnv();
  await env.clearFirestore();
  await env.clearStorage();
  couple = await signUp(`couple-r-${Date.now()}@example.test`);
  owner = await signUp(`owner-r-${Date.now()}@example.test`);
  await seedUser(env, couple.uid, "couple");
  await seedUser(env, owner.uid, "vendor");
  await seed(env, `vendors/${owner.uid}`, { ...newVendorProfile({ kinds: ["venue"], published: true }), createdAt: fixedTime, updatedAt: fixedTime });
  await seedVenue(env, "live", owner.uid, "active");
  await seedVenue(env, "draft", owner.uid, "draft");
  const spacePhoto = { path: "venues/live/spaces/ball/room1.jpg", width: 2048, height: 1536, contentType: "image/jpeg" };
  await seed(env, "venues/live/spaces/ball", { ...newSpace({ photo: spacePhoto, photoVersion: 1 }), createdAt: fixedTime, updatedAt: fixedTime });
  await seed(env, "venues/draft/spaces/ball", { ...newSpace({ photo: { ...spacePhoto, path: "venues/draft/spaces/ball/room1.jpg" }, photoVersion: 1 }), createdAt: fixedTime, updatedAt: fixedTime });
  for (const id of ["arch", "lights"]) {
    await seed(env, `vendors/${owner.uid}/items/${id}`, {
      ...newItem({ name: `SAMPLE ${id}`, photo: { path: `vendors/${owner.uid}/items/${id}/p1.webp`, width: 100, height: 100, contentType: "image/webp" } }),
      createdAt: fixedTime,
      updatedAt: fixedTime,
    });
  }
  await seed(env, `vendors/${owner.uid}/items/nophoto`, { ...newItem({ name: "SAMPLE no photo" }), createdAt: fixedTime, updatedAt: fixedTime });
  // A decorator who only works at a different venue.
  await seed(env, `vendors/${DECORATOR}`, { ...newVendorProfile({ published: true, servesAnyVenue: false, servesVenueIds: ["elsewhere"] }), createdAt: fixedTime, updatedAt: fixedTime });
  await seed(env, `vendors/${DECORATOR}/items/vase`, {
    ...newItem({ photo: { path: `vendors/${DECORATOR}/items/vase/p.webp`, width: 100, height: 100, contentType: "image/webp" } }),
    createdAt: fixedTime,
    updatedAt: fixedTime,
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = ctx.storage(BUCKET);
    for (const p of ["venues/live/spaces/ball/room1.jpg", "venues/draft/spaces/ball/room1.jpg", `vendors/${owner.uid}/items/arch/p1.webp`, `vendors/${owner.uid}/items/lights/p1.webp`]) {
      await uploadBytes(ref(s, p), png, { contentType: "image/png" });
    }
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe("requestRender (DEMO mode)", () => {
  let firstKey = "";

  it("creates a labelled DEMO render and counts it", async () => {
    const r = await render(couple.idToken, req("peranakan", ["arch", "lights"]));
    expect(r.error).toBeUndefined();
    expect(r.result).toMatchObject({ cacheHit: false, demo: true });
    firstKey = r.result!.key;
    expect(r.result!.path).toBe(`renders/${firstKey}.jpg`);
    let bytes = 0;
    await env.withSecurityRulesDisabled(async (ctx) => {
      bytes = (await getBytes(ref(ctx.storage(BUCKET), r.result!.path))).byteLength;
    });
    expect(bytes).toBeGreaterThan(1000);
    expect(await coupleToday()).toBe(1);
  });

  it("the same request is a cache hit: same render, no quota used", async () => {
    const r = await render(couple.idToken, req("peranakan", ["arch", "lights"]));
    expect(r.result).toMatchObject({ key: firstKey, cacheHit: true });
    expect(await coupleToday()).toBe(1);
  });

  it("item order doesn't matter", async () => {
    const r = await render(couple.idToken, req("peranakan", ["lights", "arch"]));
    expect(r.result).toMatchObject({ key: firstKey, cacheHit: true });
  });

  it("changing the theme or the items makes a new render", async () => {
    const t = await render(couple.idToken, req("chinese", ["arch", "lights"]));
    expect(t.result).toMatchObject({ cacheHit: false });
    expect(t.result!.key).not.toBe(firstKey);
    const i = await render(couple.idToken, req("peranakan", ["arch"]));
    expect(i.result).toMatchObject({ cacheHit: false });
    expect(i.result!.key).not.toBe(firstKey);
    expect(await coupleToday()).toBe(3);
  });

  it("switching back to an earlier combination hits the cache", async () => {
    const r = await render(couple.idToken, req("peranakan", ["arch", "lights"]));
    expect(r.result).toMatchObject({ key: firstKey, cacheHit: true });
    expect(await coupleToday()).toBe(3);
  });

  it("a new room photo is a new render", async () => {
    await admin((db) => setDoc(doc(db, "venues/live/spaces/ball"), { photoVersion: 2 }, { merge: true }));
    const r = await render(couple.idToken, req("peranakan", ["arch", "lights"]));
    expect(r.result!.key).not.toBe(firstKey);
    expect(r.result!.cacheHit).toBe(false);
    await admin((db) => setDoc(doc(db, "venues/live/spaces/ball"), { photoVersion: 1 }, { merge: true }));
    expect(await coupleToday()).toBe(4);
  });

  it("a failed render uses no quota and is not cached", async () => {
    await admin((db) => setDoc(doc(db, "config/renderTesting"), { failNext: true }));
    const before = await coupleToday();
    const r = await render(couple.idToken, req("indian-vivaha", ["arch"]));
    expect(r.error?.status).toBe("UNAVAILABLE");
    expect(r.error?.message).toMatch(/try again/);
    expect(await coupleToday()).toBe(before);
    const again = await render(couple.idToken, req("indian-vivaha", ["arch"]));
    expect(again.result?.cacheHit).toBe(false);
    expect(await coupleToday()).toBe(before + 1);
  });

  it("limits block excess requests, but cache hits still work", async () => {
    const used = await coupleToday();
    await admin((db) => setDoc(doc(db, "config/renderLimits"), { userPerDay: used }));
    const blocked = await render(couple.idToken, req("malay-pelamin", ["arch"]));
    expect(blocked.error?.status).toBe("RESOURCE_EXHAUSTED");
    expect(blocked.error?.message).toMatch(/today's render limit/);
    expect(await coupleToday()).toBe(used);
    const hit = await render(couple.idToken, req("peranakan", ["arch", "lights"]));
    expect(hit.result?.cacheHit).toBe(true);
    await admin((db) => deleteDoc(doc(db, "config/renderLimits")));
  });

  it("the vendor's monthly limit applies to every couple rendering that venue", async () => {
    const month = todayKey().slice(0, 7);
    const vendorUsed = await usageCount(`vendor_${owner.uid}_${month}`);
    expect(vendorUsed).toBeGreaterThan(0);
    await admin((db) => setDoc(doc(db, "config/renderLimits"), { vendorPerMonth: vendorUsed }));
    const blocked = await render(owner.idToken, req("fusion-malay-indian", ["lights"]));
    expect(blocked.error?.status).toBe("RESOURCE_EXHAUSTED");
    expect(blocked.error?.message).toMatch(/venue has reached its render limit/);
    await admin((db) => deleteDoc(doc(db, "config/renderLimits")));
  });
});

describe("requestRender access checks", () => {
  it("refuses signed-out callers", async () => {
    const res = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: req("peranakan", []) }) });
    expect(((await res.json()) as CallResult).error?.status).toBe("UNAUTHENTICATED");
  });

  it("anonymous family sessions can't render", async () => {
    const res = await fetch(`${AUTH}/accounts:signUp?key=fake-api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    const { idToken } = (await res.json()) as { idToken: string };
    expect((await render(idToken, req("peranakan", ["arch"]))).error?.status).toBe("PERMISSION_DENIED");
  });

  it("couples can't render a draft venue; its owner can preview it", async () => {
    const c = await render(couple.idToken, req("peranakan", ["arch"], { venueId: "draft" }));
    expect(c.error?.status).toBe("PERMISSION_DENIED");
    const o = await render(owner.idToken, req("peranakan", ["arch"], { venueId: "draft" }));
    expect(o.result?.demo).toBe(true);
  });

  it("refuses items from a decorator who doesn't work at this venue", async () => {
    const r = await render(couple.idToken, { ...req("peranakan", []), items: [{ vendorUid: DECORATOR, itemId: "vase" }] });
    expect(r.error?.status).toBe("PERMISSION_DENIED");
  });

  it("refuses items without a photo, unknown themes, and too many items", async () => {
    expect((await render(couple.idToken, req("peranakan", ["nophoto"]))).error?.status).toBe("FAILED_PRECONDITION");
    expect((await render(couple.idToken, req("disco", ["arch"]))).error?.status).toBe("INVALID_ARGUMENT");
    expect((await render(couple.idToken, req("peranakan", Array.from({ length: 11 }, (_, i) => `i${i}`)))).error?.status).toBe("INVALID_ARGUMENT");
  });

  it("render documents hold no personal data", async () => {
    let fields: string[] = [];
    await env.withSecurityRulesDisabled(async (ctx) => {
      const r = await render(couple.idToken, req("peranakan", ["arch", "lights"]));
      fields = Object.keys((await getDoc(doc(ctx.firestore(), `renders/${r.result!.key}`))).data() ?? {});
    });
    expect(fields).not.toContain("uid");
    expect(fields).not.toContain("requestedBy");
    expect(fields).not.toContain("email");
  });
});

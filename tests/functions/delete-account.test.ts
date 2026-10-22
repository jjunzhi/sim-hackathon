import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BUCKET, PROJECT_ID, fixedTime, makeEnv, newItem, newPackage, newSpace, seed, seedUser, seedVendor, seedVenue } from "../rules/setup";

const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const FN = `http://127.0.0.1:5001/${PROJECT_ID}/asia-southeast1/deleteAccount`;

let env: RulesTestEnvironment;

async function signUp(email: string): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-1", returnSecureToken: true }),
  });
  const body = (await res.json()) as { localId: string; idToken: string };
  return { uid: body.localId, idToken: body.idToken };
}

async function callDelete(idToken?: string) {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ data: {} }),
  });
  return (await res.json()) as { result?: unknown; error?: { status: string; message: string } };
}

async function authUserExists(idToken: string): Promise<boolean> {
  const res = await fetch(`${AUTH}/accounts:lookup?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const body = (await res.json()) as { users?: unknown[] };
  return res.ok && (body.users?.length ?? 0) > 0;
}

async function docExists(path: string) {
  let exists = false;
  await env.withSecurityRulesDisabled(async (ctx) => {
    exists = (await getDoc(doc(ctx.firestore(), path))).exists();
  });
  return exists;
}

async function fileExists(path: string) {
  let exists = true;
  await env.withSecurityRulesDisabled(async (ctx) => {
    await getBytes(ref(ctx.storage(BUCKET), path)).catch(() => {
      exists = false;
    });
  });
  return exists;
}

async function putFile(path: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(BUCKET), path), new Uint8Array(100).fill(1), { contentType: "image/webp" });
  });
}

beforeAll(async () => {
  env = await makeEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});

describe("deleteAccount", () => {
  it("refuses callers who are not signed in", async () => {
    const res = await callDelete();
    expect(res.error?.status).toBe("UNAUTHENTICATED");
  });

  it("removes a vendor's Firestore data, Storage files and Auth account, and nobody else's", async () => {
    const me = await signUp(`vendor-${Date.now()}@example.test`);
    const other = await signUp(`other-${Date.now()}@example.test`);

    await seedUser(env, me.uid, "vendor");
    await seedVenue(env, "mine", me.uid, "active");
    await seed(env, "venues/mine/spaces/s1", { ...newSpace(), createdAt: fixedTime, updatedAt: fixedTime });
    await putFile("venues/mine/spaces/s1/a.webp");
    await putFile("venues/mine/cover/c.webp");

    await seedVendor(env, me.uid, true);
    await seed(env, `vendors/${me.uid}/items/i1`, { ...newItem(), createdAt: fixedTime, updatedAt: fixedTime });
    await seed(env, `vendors/${me.uid}/packages/p1`, { ...newPackage({ itemIds: ["i1"] }), createdAt: fixedTime, updatedAt: fixedTime });
    await putFile(`vendors/${me.uid}/items/i1/x.webp`);

    await seedUser(env, other.uid, "vendor");
    await seedVenue(env, "theirs", other.uid, "active");
    await putFile("venues/theirs/spaces/s1/b.webp");
    await seedVendor(env, other.uid, true);
    await seed(env, `vendors/${other.uid}/items/i9`, { ...newItem(), createdAt: fixedTime, updatedAt: fixedTime });
    await putFile(`vendors/${other.uid}/items/i9/y.webp`);

    const res = await callDelete(me.idToken);
    expect(res.error).toBeUndefined();
    expect(res.result).toEqual({ deleted: true });

    expect(await docExists(`users/${me.uid}`)).toBe(false);
    expect(await docExists("venues/mine")).toBe(false);
    expect(await docExists("venues/mine/spaces/s1")).toBe(false);
    expect(await fileExists("venues/mine/spaces/s1/a.webp")).toBe(false);
    expect(await fileExists("venues/mine/cover/c.webp")).toBe(false);
    expect(await docExists(`vendors/${me.uid}`)).toBe(false);
    expect(await docExists(`vendors/${me.uid}/items/i1`)).toBe(false);
    expect(await docExists(`vendors/${me.uid}/packages/p1`)).toBe(false);
    expect(await fileExists(`vendors/${me.uid}/items/i1/x.webp`)).toBe(false);
    expect(await authUserExists(me.idToken)).toBe(false);

    // Another vendor's data is untouched.
    expect(await docExists(`users/${other.uid}`)).toBe(true);
    expect(await docExists("venues/theirs")).toBe(true);
    expect(await fileExists("venues/theirs/spaces/s1/b.webp")).toBe(true);
    expect(await docExists(`vendors/${other.uid}/items/i9`)).toBe(true);
    expect(await fileExists(`vendors/${other.uid}/items/i9/y.webp`)).toBe(true);
    expect(await authUserExists(other.idToken)).toBe(true);
  });

  it("removes a couple's profile, plans (with saved renders), guest list and account; nobody else's", async () => {
    const me = await signUp(`couple-${Date.now()}@example.test`);
    const other = await signUp(`couple2-${Date.now()}@example.test`);
    await seedUser(env, me.uid, "couple");
    await seedUser(env, other.uid, "couple");
    const plan = (ownerUid: string) => ({
      ownerUid, name: "SAMPLE plan", venueId: "v", spaceId: "s", tierKey: null, headcount: 100, themeId: "chinese",
      selections: {}, savedRenders: [{ key: "k", path: "renders/k.jpg", themeId: "chinese", demo: true, savedAt: "2026-10-22T00:00:00Z" }],
      createdAt: fixedTime, updatedAt: fixedTime,
    });
    await seed(env, "projects/mine1", plan(me.uid));
    await seed(env, "projects/mine2", plan(me.uid));
    await seed(env, "projects/theirs", plan(other.uid));
    await seed(env, `guestLists/${me.uid}`, { trimOrder: ["casual", "close", "extended"], planId: null, updatedAt: fixedTime });
    await seed(env, `guestLists/${me.uid}/parties/g1`, { label: "x", tier: "must", seats: 2, plusOnes: 0, createdAt: fixedTime, updatedAt: fixedTime });
    await seed(env, `guestLists/${other.uid}/parties/g9`, { label: "y", tier: "must", seats: 2, plusOnes: 0, createdAt: fixedTime, updatedAt: fixedTime });

    const res = await callDelete(me.idToken);
    expect(res.result).toEqual({ deleted: true });
    expect(await docExists(`users/${me.uid}`)).toBe(false);
    expect(await docExists("projects/mine1")).toBe(false);
    expect(await docExists("projects/mine2")).toBe(false);
    expect(await docExists(`guestLists/${me.uid}`)).toBe(false);
    expect(await docExists(`guestLists/${me.uid}/parties/g1`)).toBe(false);
    expect(await authUserExists(me.idToken)).toBe(false);
    expect(await docExists("projects/theirs")).toBe(true);
    expect(await docExists(`guestLists/${other.uid}/parties/g9`)).toBe(true);
  });

  it("couple: links and votes go; unconfirmed leads go; confirmed leads keep the snapshot without contact or plan (option B)", async () => {
    const me = await signUp(`couple-l-${Date.now()}@example.test`);
    const other = await signUp(`couple-o-${Date.now()}@example.test`);
    await seedUser(env, me.uid, "couple");
    const share = (ownerUid: string) => ({ ownerUid, title: "x", status: "active", options: [], createdAt: fixedTime, updatedAt: fixedTime });
    await seed(env, "shares/mineShareIdAAAAAAAAAAA", share(me.uid));
    await seed(env, "shares/mineShareIdAAAAAAAAAAA/votes/anon1", { optionIndex: 0, name: "", note: "", createdAt: fixedTime });
    await seed(env, "shares/theirShareIdBBBBBBBBBB", share(other.uid));
    const lead = (status: string) => ({
      coupleUid: me.uid, vendorUid: "vendor-x", venueOwnerUid: "vendor-x", planId: "p1", venueId: "v", venueName: "V", vendorName: "X",
      spaceId: "s", spaceName: "S", tierKey: null, headcount: 100, selections: {}, renders: [{ key: "k", path: "renders/k.jpg", themeId: "chinese", aspect: "4 / 3" }],
      contact: { name: "Sam", reachAt: "sam@example.test", eventDate: "", message: "Hi" }, status, confirmationId: status === "confirmed" ? "Lc" : null,
      createdAt: fixedTime, updatedAt: fixedTime,
    });
    await seed(env, "leads/Ln", lead("new"));
    await seed(env, "leads/Lc", lead("confirmed"));
    await seed(env, "confirmations/Lc", { leadId: "Lc", vendorUid: "vendor-x", coupleUid: me.uid, planId: "p1", snapshot: { totalCents: 123 }, confirmedAt: fixedTime, validUntil: fixedTime });

    expect((await callDelete(me.idToken)).result).toEqual({ deleted: true });

    expect(await docExists("shares/mineShareIdAAAAAAAAAAA")).toBe(false);
    expect(await docExists("shares/mineShareIdAAAAAAAAAAA/votes/anon1")).toBe(false);
    expect(await docExists("shares/theirShareIdBBBBBBBBBB")).toBe(true);
    expect(await docExists("leads/Ln")).toBe(false);

    let kept: Record<string, unknown> = {};
    let conf: Record<string, unknown> = {};
    await env.withSecurityRulesDisabled(async (ctx) => {
      kept = (await getDoc(doc(ctx.firestore(), "leads/Lc"))).data() ?? {};
      conf = (await getDoc(doc(ctx.firestore(), "confirmations/Lc"))).data() ?? {};
    });
    expect(kept).toMatchObject({ status: "confirmed", contact: null, coupleUid: null, planId: null, renders: [], anonymised: true });
    expect(conf).toMatchObject({ coupleUid: null, planId: null, snapshot: { totalCents: 123 } });
  });

  it("vendor: its leads and the confirmations it gave are deleted", async () => {
    const me = await signUp(`vendor-l-${Date.now()}@example.test`);
    await seedUser(env, me.uid, "vendor");
    await seed(env, "leads/Lv", { vendorUid: me.uid, coupleUid: "c1", status: "confirmed", createdAt: fixedTime });
    await seed(env, "confirmations/Lv", { vendorUid: me.uid, coupleUid: "c1", snapshot: {}, confirmedAt: fixedTime });
    await seed(env, "leads/Lother", { vendorUid: "someone-else", coupleUid: "c1", status: "new", createdAt: fixedTime });
    expect((await callDelete(me.idToken)).result).toEqual({ deleted: true });
    expect(await docExists("leads/Lv")).toBe(false);
    expect(await docExists("confirmations/Lv")).toBe(false);
    expect(await docExists("leads/Lother")).toBe(true);
  });

  it("works for an account that never finished sign-up (no profile)", async () => {
    const me = await signUp(`half-${Date.now()}@example.test`);
    const res = await callDelete(me.idToken);
    expect(res.result).toEqual({ deleted: true });
    expect(await authUserExists(me.idToken)).toBe(false);
  });
});

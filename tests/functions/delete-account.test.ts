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

  it("removes a couple's profile and account", async () => {
    const me = await signUp(`couple-${Date.now()}@example.test`);
    await seedUser(env, me.uid, "couple");
    const res = await callDelete(me.idToken);
    expect(res.result).toEqual({ deleted: true });
    expect(await docExists(`users/${me.uid}`)).toBe(false);
    expect(await authUserExists(me.idToken)).toBe(false);
  });

  it("works for an account that never finished sign-up (no profile)", async () => {
    const me = await signUp(`half-${Date.now()}@example.test`);
    const res = await callDelete(me.idToken);
    expect(res.result).toEqual({ deleted: true });
    expect(await authUserExists(me.idToken)).toBe(false);
  });
});

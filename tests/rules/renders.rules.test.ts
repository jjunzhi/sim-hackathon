import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { BUCKET, COUPLE, VENDOR, makeEnv, seed } from "./setup";

let env: RulesTestEnvironment;
const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const storage = (uid?: string) => (uid ? env.authenticatedContext(uid).storage(BUCKET) : env.unauthenticatedContext().storage(BUCKET));

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

describe("renders", () => {
  it("any signed-in person can view a render; signed-out cannot", async () => {
    await seed(env, "renders/k1", { status: "ready", path: "renders/k1.jpg" });
    await assertSucceeds(getDoc(doc(db(COUPLE), "renders/k1")));
    await assertSucceeds(getDoc(doc(db("anonymous-family-member"), "renders/k1")));
    await assertFails(getDoc(doc(db(), "renders/k1")));
  });

  it("nobody writes renders from the client (no fake cache entries)", async () => {
    await assertFails(setDoc(doc(db(VENDOR), "renders/k2"), { status: "ready", path: "renders/evil.jpg" }));
  });

  it("render images: signed-in read only, no client uploads", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(BUCKET), "renders/k1.jpg"), new Uint8Array(10), { contentType: "image/jpeg" });
    });
    await assertSucceeds(getBytes(ref(storage(COUPLE), "renders/k1.jpg")));
    await assertFails(getBytes(ref(storage(), "renders/k1.jpg")));
    await assertFails(uploadBytes(ref(storage(VENDOR), "renders/k3.jpg"), new Uint8Array(10), { contentType: "image/jpeg" }));
  });
});

describe("usage and limits", () => {
  it("people see only their own usage counters and can't change them", async () => {
    await seed(env, `usage/user_${COUPLE}_2026-10`, { count: 3, subject: COUPLE });
    await seed(env, `usage/vendor_${VENDOR}_2026-10`, { count: 9, subject: VENDOR });
    await assertSucceeds(getDoc(doc(db(COUPLE), `usage/user_${COUPLE}_2026-10`)));
    await assertFails(getDoc(doc(db(COUPLE), `usage/vendor_${VENDOR}_2026-10`)));
    await assertSucceeds(getDoc(doc(db(VENDOR), `usage/vendor_${VENDOR}_2026-10`)));
    await assertFails(setDoc(doc(db(COUPLE), `usage/user_${COUPLE}_2026-10`), { count: 0, subject: COUPLE }));
  });

  it("limits are readable when signed in but only an admin changes them", async () => {
    await seed(env, "config/renderLimits", { userPerDay: 10 });
    await assertSucceeds(getDoc(doc(db(COUPLE), "config/renderLimits")));
    await assertFails(setDoc(doc(db(VENDOR), "config/renderLimits"), { userPerDay: 9999 }));
    await assertFails(getDoc(doc(db(VENDOR), "config/renderTesting")));
  });
});

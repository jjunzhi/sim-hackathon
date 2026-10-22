import { createRequire } from "node:module";
import { join } from "node:path";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PROJECT_ID, fixedTime, makeEnv, newVendorProfile, newVenue, seed, seedUser } from "../rules/setup";

// Stripe events are signed with the emulator-only secret from functions/.secret.local
// (see functions/.secret.local.example). No Stripe API is called: STRIPE_SECRET_KEY is "demo".
const WEBHOOK_SECRET = "whsec_emulator_only_not_a_real_secret";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const FN = (name: string) => `http://127.0.0.1:5001/${PROJECT_ID}/asia-southeast1/${name}`;
const fnRequire = createRequire(join(process.cwd(), "functions/package.json"));
const Stripe = fnRequire("stripe") as new (key: string) => { webhooks: { generateTestHeaderString(o: { payload: string; secret: string }): string } };
const signer = new Stripe("sk_test_signing_only");

let env: RulesTestEnvironment;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function signUp(email: string) {
  const res = await fetch(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-1", returnSecureToken: true }),
  });
  const b = (await res.json()) as { localId: string; idToken: string };
  return { uid: b.localId, idToken: b.idToken };
}

async function call(name: string, idToken: string | null, data: Record<string, unknown> = {}) {
  const res = await fetch(FN(name), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return (await res.json()) as { result?: Record<string, unknown>; error?: { status: string; message: string } };
}

let seq = 0;
function subEvent(type: string, o: { uid?: string; customer: string; status: string; createdSec: number; id?: string }) {
  return {
    id: o.id ?? `evt_test_${Date.now()}_${seq++}`,
    object: "event",
    type,
    created: o.createdSec,
    data: {
      object: {
        id: "sub_test_1",
        object: "subscription",
        status: o.status,
        customer: o.customer,
        cancel_at_period_end: false,
        metadata: o.uid ? { uid: o.uid } : {},
        items: { object: "list", data: [{ id: "si_1", object: "subscription_item", current_period_end: o.createdSec + 30 * 86400 }] },
      },
    },
  };
}

async function post(event: unknown, { signed = true, secret = WEBHOOK_SECRET }: { signed?: boolean; secret?: string } = {}) {
  const payload = JSON.stringify(event);
  const res = await fetch(FN("stripeWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(signed ? { "Stripe-Signature": signer.webhooks.generateTestHeaderString({ payload, secret }) } : {}) },
    body: payload,
  });
  return { status: res.status, body: res.status === 200 ? ((await res.json()) as Record<string, unknown>) : await res.text() };
}

async function read(path: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
}

/** Triggers run asynchronously in the emulator. */
async function eventually(path: string, check: (d: Record<string, unknown> | undefined) => boolean, timeoutMs = 15_000) {
  const end = Date.now() + timeoutMs;
  let last: Record<string, unknown> | undefined;
  while (Date.now() < end) {
    last = await read(path);
    if (check(last)) return last;
    await sleep(250);
  }
  return last;
}

async function seedVendorWithVenue(uid: string) {
  await seedUser(env, uid, "vendor");
  await seed(env, `vendors/${uid}`, { ...newVendorProfile({ kinds: ["venue"], published: true }), createdAt: fixedTime, updatedAt: fixedTime });
  await seed(env, `venues/v-${uid}`, { ...newVenue(uid), status: "active", createdAt: fixedTime, updatedAt: fixedTime });
}

beforeAll(async () => {
  env = await makeEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

describe("stripeWebhook", () => {
  it("refuses unsigned, wrongly signed and non-POST requests", async () => {
    const e = subEvent("customer.subscription.updated", { uid: "u", customer: "cus_x", status: "active", createdSec: 1 });
    expect((await post(e, { signed: false })).status).toBe(400);
    expect((await post(e, { secret: "whsec_wrong" })).status).toBe(400);
    expect((await fetch(FN("stripeWebhook"))).status).toBe(405);
  });

  it("an active subscription lists the vendor and its venues; cancellation unlists them", async () => {
    const uid = "vendor-sub-1";
    await seedVendorWithVenue(uid);
    const t = Math.floor(Date.now() / 1000);
    const created = await post(subEvent("customer.subscription.created", { uid, customer: "cus_1", status: "active", createdSec: t }));
    expect(created).toMatchObject({ status: 200, body: { received: true, handled: true } });
    expect(await read(`billing/${uid}`)).toMatchObject({ status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_test_1" });
    expect((await read(`billing/${uid}`))?.currentPeriodEndMs).toBe((t + 30 * 86400) * 1000);
    expect((await read(`vendors/${uid}`))?.listed).toBe(true);
    expect((await read(`venues/v-${uid}`))?.listed).toBe(true);

    await post(subEvent("customer.subscription.deleted", { uid, customer: "cus_1", status: "canceled", createdSec: t + 10 }));
    expect((await read(`billing/${uid}`))?.status).toBe("canceled");
    expect((await read(`vendors/${uid}`))?.listed).toBe(false);
    expect((await read(`venues/v-${uid}`))?.listed).toBe(false);
  });

  it("ignores an older event that arrives late, and repeats of the same event", async () => {
    const uid = "vendor-sub-2";
    await seedVendorWithVenue(uid);
    const t = Math.floor(Date.now() / 1000);
    await post(subEvent("customer.subscription.updated", { uid, customer: "cus_2", status: "canceled", createdSec: t }));
    const late = await post(subEvent("customer.subscription.updated", { uid, customer: "cus_2", status: "active", createdSec: t - 60 }));
    expect(late.body).toMatchObject({ handled: false });
    expect((await read(`billing/${uid}`))?.status).toBe("canceled");

    const again = subEvent("customer.subscription.updated", { uid, customer: "cus_2", status: "active", createdSec: t + 5, id: "evt_test_dupe" });
    expect((await post(again)).body).toMatchObject({ handled: true });
    expect((await post(again)).body).toMatchObject({ duplicate: true });
  });

  it("past_due keeps the listing during the grace period", async () => {
    const uid = "vendor-sub-3";
    await seedVendorWithVenue(uid);
    const t = Math.floor(Date.now() / 1000);
    await post(subEvent("customer.subscription.created", { uid, customer: "cus_3", status: "active", createdSec: t }));
    await post(subEvent("customer.subscription.updated", { uid, customer: "cus_3", status: "past_due", createdSec: t + 1 }));
    const b = await read(`billing/${uid}`);
    expect(b).toMatchObject({ status: "past_due" });
    expect(typeof b?.pastDueSinceMs).toBe("number");
    expect((await read(`venues/v-${uid}`))?.listed).toBe(true);
  });

  it("checkout.session.completed links the customer; later events find the vendor without metadata", async () => {
    const uid = "vendor-sub-4";
    await seedVendorWithVenue(uid);
    const t = Math.floor(Date.now() / 1000);
    await post({
      id: `evt_cs_${seq++}`,
      object: "event",
      type: "checkout.session.completed",
      created: t,
      data: { object: { id: "cs_1", object: "checkout.session", mode: "subscription", client_reference_id: uid, customer: "cus_4" } },
    });
    expect((await read(`billing/${uid}`))?.stripeCustomerId).toBe("cus_4");
    await post(subEvent("customer.subscription.created", { customer: "cus_4", status: "trialing", createdSec: t + 1 }));
    expect((await read(`billing/${uid}`))?.status).toBe("trialing");
    expect((await read(`vendors/${uid}`))?.listed).toBe(true);
  });

  it("unknown customers and other event types are acknowledged without changes", async () => {
    expect((await post(subEvent("customer.subscription.updated", { customer: "cus_nobody", status: "active", createdSec: 1 }))).body).toMatchObject({ handled: false });
    expect((await post({ id: `evt_x_${seq++}`, object: "event", type: "invoice.paid", created: 1, data: { object: { id: "in_1", object: "invoice" } } })).body).toMatchObject({
      received: true,
      handled: false,
    });
  });
});

describe("pilot invites and listing", () => {
  const until = Date.now() + 90 * 86400_000;

  it("a vendor redeems an invite once; the vendor and its venues become listed", async () => {
    const v = await signUp(`pilot-${Date.now()}@example.test`);
    await seedVendorWithVenue(v.uid);
    await seed(env, "invites/PILOTcode-0123456789ab", { pilotUntilMs: until, note: "SAMPLE", redeemedBy: null, createdAtMs: Date.now() });
    expect((await call("redeemInvite", v.idToken, { code: "short" })).error?.status).toBe("INVALID_ARGUMENT");
    expect((await call("redeemInvite", v.idToken, { code: "NOPEnope-0123456789ab" })).error?.status).toBe("NOT_FOUND");
    expect((await call("redeemInvite", v.idToken, { code: "PILOTcode-0123456789ab" })).result).toEqual({ pilotUntilMs: until });
    expect(await read(`billing/${v.uid}`)).toMatchObject({ pilotUntilMs: until, status: "none" });
    expect((await read(`vendors/${v.uid}`))?.listed).toBe(true);
    expect((await read(`venues/v-${v.uid}`))?.listed).toBe(true);
    // Redeeming your own code again is harmless; someone else can't use it.
    expect((await call("redeemInvite", v.idToken, { code: "PILOTcode-0123456789ab" })).result).toEqual({ pilotUntilMs: until });
    const other = await signUp(`pilot-other-${Date.now()}@example.test`);
    await seedUser(env, other.uid, "vendor");
    expect((await call("redeemInvite", other.idToken, { code: "PILOTcode-0123456789ab" })).error?.status).toBe("ALREADY_EXISTS");
  });

  it("expired codes and couples are refused", async () => {
    const v = await signUp(`pilot-exp-${Date.now()}@example.test`);
    await seedUser(env, v.uid, "vendor");
    await seed(env, "invites/OLDcode-0123456789abcd", { pilotUntilMs: Date.now() - 1000, redeemedBy: null });
    expect((await call("redeemInvite", v.idToken, { code: "OLDcode-0123456789abcd" })).error?.status).toBe("FAILED_PRECONDITION");
    const c = await signUp(`couple-inv-${Date.now()}@example.test`);
    await seedUser(env, c.uid, "couple");
    expect((await call("redeemInvite", c.idToken, { code: "OLDcode-0123456789abcd" })).error?.status).toBe("PERMISSION_DENIED");
  });

  it("a new venue of a vendor in good standing is listed by the trigger; others stay unlisted", async () => {
    await seedUser(env, "pilot-v", "vendor");
    await seed(env, "billing/pilot-v", { status: "none", pilotUntilMs: until });
    await seed(env, "venues/new-pilot", { ...newVenue("pilot-v"), createdAt: fixedTime, updatedAt: fixedTime });
    expect((await eventually("venues/new-pilot", (d) => d?.listed === true))?.listed).toBe(true);

    await seedUser(env, "no-plan", "vendor");
    await seed(env, "venues/new-noplan", { ...newVenue("no-plan"), createdAt: fixedTime, updatedAt: fixedTime });
    expect((await eventually("venues/new-noplan", (d) => d?.listed === false))?.listed).toBe(false);
  });

  it("the daily sweep unlists a vendor whose pilot ended", async () => {
    // The scheduler doesn't run in the emulator, so call the sweep itself with the Admin SDK (functions' own copy).
    type App = { name: string };
    const { getFirestore } = fnRequire("firebase-admin/firestore") as { getFirestore: (app: App) => unknown };
    const { initializeApp, getApps } = fnRequire("firebase-admin/app") as { initializeApp: (o: object, name: string) => App; getApps: () => App[] };
    process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
    const app = getApps().find((a) => a.name === "sweep-test") ?? initializeApp({ projectId: PROJECT_ID }, "sweep-test");
    const { sweepListings } = (await import(join(process.cwd(), "functions/lib/billing/listing.js"))) as {
      sweepListings: (db: unknown, nowMs: number) => Promise<{ checked: number }>;
    };
    await seedVendorWithVenue("ended");
    await seed(env, "billing/ended", { status: "none", pilotUntilMs: Date.now() - 1000 });
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { setDoc } = await import("firebase/firestore");
      await setDoc(doc(ctx.firestore(), "vendors/ended"), { ...newVendorProfile({ published: true }), listed: true, createdAt: fixedTime, updatedAt: fixedTime });
    });
    const res = await sweepListings(getFirestore(app), Date.now());
    expect(res.checked).toBeGreaterThanOrEqual(1);
    expect((await read("vendors/ended"))?.listed).toBe(false);
    expect((await read("venues/v-ended"))?.listed).toBe(false);
  });
});

describe("checkout and portal without Stripe keys", () => {
  it("report that billing isn't set up, and only vendors may ask", async () => {
    const v = await signUp(`nokey-${Date.now()}@example.test`);
    await seedUser(env, v.uid, "vendor");
    expect((await call("createCheckoutSession", v.idToken)).error).toMatchObject({ status: "FAILED_PRECONDITION", message: "billing-not-configured" });
    expect((await call("createPortalSession", v.idToken)).error).toMatchObject({ status: "FAILED_PRECONDITION", message: "billing-not-configured" });
    const c = await signUp(`nokey-c-${Date.now()}@example.test`);
    await seedUser(env, c.uid, "couple");
    expect((await call("createCheckoutSession", c.idToken)).error?.status).toBe("PERMISSION_DENIED");
    expect((await call("createCheckoutSession", null)).error?.status).toBe("UNAUTHENTICATED");
  });
});

import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/scheduler";
import Stripe from "stripe";
import { syncListing, sweepListings } from "./listing.js";
import { readBilling } from "./standing.js";
import { handleStripeEvent, markProcessed } from "./webhook.js";

// Set with: firebase functions:secrets:set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET).
// Empty, "demo" or "none": billing isn't set up, and only pilot access works.
export const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
/** The monthly plan's Stripe Price ID (price_...). Not secret. */
const stripePriceId = defineString("STRIPE_PRICE_ID", { default: "" });
/** Where Checkout and the Customer Portal send vendors back to, e.g. https://weddingvista.sg */
const appBaseUrl = defineString("APP_BASE_URL", { default: "http://localhost:3000" });

const REGION = "asia-southeast1";
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== "true";

function stripeClient(): Stripe | null {
  const raw = (stripeSecretKey.value() ?? "").trim();
  if (!raw || ["demo", "none"].includes(raw.toLowerCase())) return null;
  return new Stripe(raw);
}

async function requireVendor(uid: string | undefined) {
  if (!uid) throw new HttpsError("unauthenticated", "Please sign in first.");
  const profile = await getFirestore().doc(`users/${uid}`).get();
  if (profile.get("role") !== "vendor") throw new HttpsError("permission-denied", "Only vendor accounts have a plan.");
  return uid;
}

const billingUrl = (status?: string) => `${appBaseUrl.value().replace(/\/+$/, "")}/vendor/billing${status ? `?checkout=${status}` : ""}`;

/** Starts Stripe Checkout for the monthly plan. Returns the hosted page URL. */
export const createCheckoutSession = onCall({ region: REGION, enforceAppCheck, secrets: [stripeSecretKey] }, async (request) => {
  const uid = await requireVendor(request.auth?.uid);
  const stripe = stripeClient();
  const price = stripePriceId.value().trim();
  if (!stripe || !price) throw new HttpsError("failed-precondition", "billing-not-configured");
  const db = getFirestore();
  const ref = db.doc(`billing/${uid}`);
  const billing = readBilling((await ref.get()).data());
  if (billing.status === "active" || billing.status === "trialing" || billing.status === "past_due") {
    throw new HttpsError("failed-precondition", "already-subscribed");
  }
  let customer = billing.stripeCustomerId;
  if (!customer) {
    // No name or email from us: Checkout asks for what Stripe needs.
    customer = (await stripe.customers.create({ metadata: { uid } })).id;
    await ref.set({ stripeCustomerId: customer, updatedAtMs: Date.now() }, { merge: true });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: uid,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { uid } },
    success_url: billingUrl("done"),
    cancel_url: billingUrl("cancelled"),
  });
  if (!session.url) throw new HttpsError("internal", "Stripe did not return a checkout page.");
  return { url: session.url };
});

/** Opens the Stripe Customer Portal: card, invoices, cancel. */
export const createPortalSession = onCall({ region: REGION, enforceAppCheck, secrets: [stripeSecretKey] }, async (request) => {
  const uid = await requireVendor(request.auth?.uid);
  const stripe = stripeClient();
  if (!stripe) throw new HttpsError("failed-precondition", "billing-not-configured");
  const billing = readBilling((await getFirestore().doc(`billing/${uid}`).get()).data());
  if (!billing.stripeCustomerId) throw new HttpsError("failed-precondition", "no-customer");
  const session = await stripe.billingPortal.sessions.create({ customer: billing.stripeCustomerId, return_url: billingUrl() });
  return { url: session.url };
});

/**
 * Stripe webhook. Verifies the signature on the raw body, applies each event
 * once, and answers 2xx quickly so Stripe doesn't retry needlessly.
 * Point a Stripe event destination here with the events listed in the README.
 */
export const stripeWebhook = onRequest({ region: REGION, secrets: [stripeSecretKey, stripeWebhookSecret], maxInstances: 5 }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }
  const secret = (stripeWebhookSecret.value() ?? "").trim();
  const signature = req.get("stripe-signature");
  if (!secret || !signature) {
    res.status(400).send("Missing signature");
    return;
  }
  let event: Stripe.Event;
  try {
    // Signature checks need no API key; a placeholder keeps verification working when billing calls are off.
    const stripe = stripeClient() ?? new Stripe("sk_test_webhook_verification_only");
    event = stripe.webhooks.constructEvent(req.rawBody, signature, secret);
  } catch {
    res.status(400).send("Invalid signature");
    return;
  }
  const db = getFirestore();
  const nowMs = Date.now();
  try {
    if (await db.doc(`stripeEvents/${event.id}`).get().then((d) => d.exists)) {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }
    const result = await handleStripeEvent(db, event, nowMs);
    await markProcessed(db, event.id, event.type, nowMs);
    logger.info("stripe event", { id: event.id, type: event.type, handled: result.handled, uid: result.uid });
    res.status(200).json({ received: true, handled: result.handled });
  } catch (err) {
    // 500 makes Stripe retry later; nothing was marked processed.
    logger.error("stripe event failed", { id: event.id, type: event.type, err: String(err) });
    res.status(500).send("Failed");
  }
});

/** Pilot vendor invites: an invite link marks the account as a pilot, free until the invite's date. */
export const redeemInvite = onCall({ region: REGION, enforceAppCheck }, async (request) => {
  const uid = await requireVendor(request.auth?.uid);
  const code = typeof request.data?.code === "string" ? request.data.code.trim() : "";
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) throw new HttpsError("invalid-argument", "invalid-code");
  const db = getFirestore();
  const nowMs = Date.now();
  const inviteRef = db.doc(`invites/${code}`);
  const billingRef = db.doc(`billing/${uid}`);
  const pilotUntilMs = await db.runTransaction(async (tx) => {
    const [invite, billingSnap] = await Promise.all([tx.get(inviteRef), tx.get(billingRef)]);
    if (!invite.exists) throw new HttpsError("not-found", "invalid-code");
    if (invite.get("redeemedBy")) {
      if (invite.get("redeemedBy") === uid) return readBilling(billingSnap.data()).pilotUntilMs; // already yours: fine
      throw new HttpsError("already-exists", "code-used");
    }
    const until = invite.get("pilotUntilMs") as number;
    if (!(until > nowMs)) throw new HttpsError("failed-precondition", "code-expired");
    const prev = readBilling(billingSnap.data());
    const next = Math.max(prev.pilotUntilMs ?? 0, until);
    tx.update(inviteRef, { redeemedBy: uid, redeemedAtMs: nowMs });
    tx.set(billingRef, { ...prev, pilotUntilMs: next, updatedAtMs: nowMs }, { merge: true });
    return next;
  });
  await syncListing(db, uid, nowMs);
  return { pilotUntilMs };
});

/** Ends pilots and grace periods on time, even without a Stripe event. */
export const dailyListingSweep = onSchedule({ schedule: "every day 03:00", timeZone: "Asia/Singapore", region: REGION }, async () => {
  const { checked } = await sweepListings(getFirestore(), Date.now());
  logger.info("listing sweep", { checked });
});

/** A new business or venue starts listed only if the vendor is already in good standing. */
export const listingOnVendorCreated = onDocumentCreated({ document: "vendors/{uid}", region: REGION, maxInstances: 10 }, async (event) => {
  await syncListing(getFirestore(), event.params.uid, Date.now());
});
export const listingOnVenueCreated = onDocumentCreated({ document: "venues/{venueId}", region: REGION, maxInstances: 10 }, async (event) => {
  const owner = event.data?.get("ownerUid");
  if (typeof owner === "string") await syncListing(getFirestore(), owner, Date.now());
});

/** For deletion: stop charging a vendor whose account is being deleted. */
export async function cancelSubscriptionFor(subscriptionId: string | null): Promise<void> {
  if (!subscriptionId) return;
  const stripe = stripeClient();
  if (!stripe) return;
  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "resource_missing") throw err; // already gone is fine
  }
}


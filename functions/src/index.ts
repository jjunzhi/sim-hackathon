import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/https";
import { logger } from "firebase-functions";
import { setGlobalOptions } from "firebase-functions/options";
import { defineSecret } from "firebase-functions/params";
import { stripeSecretKey } from "./billing/functions.js";
import { deletionSteps } from "./deletion.js";
import { handleAssistantRequest, parseAssistantRequest } from "./assistant/assistant.js";
import { handlePlannerRequest, parsePlannerRequest } from "./assistant/planner.js";
import { handleRenderRequest, parseRequest } from "./render/request-render.js";

export { venueCapacitySummary } from "./venues/trigger.js";
export { planDecisionsCleanup } from "./assistant/cleanup.js";
export {
  createCheckoutSession,
  createPortalSession,
  dailyListingSweep,
  listingOnVendorCreated,
  listingOnVenueCreated,
  redeemInvite,
  stripeWebhook,
} from "./billing/functions.js";

// Set with: firebase functions:secrets:set GEMINI_API_KEY
// Empty, "demo" or "none" runs DEMO mode (no AI call, clearly labelled images).
const geminiApiKey = defineSecret("GEMINI_API_KEY");

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 10 });

/** The person must have signed in (or re-entered their password) this recently. */
const RECENT_LOGIN_SECONDS = 5 * 60;

// App Check cannot be attested by the local emulator, so it is enforced
// everywhere except there.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== "true";

/**
 * Self-service account deletion. Removes all Firestore data and Storage files
 * the user owns, then the Auth account. Safe to retry: every step is idempotent.
 */
// Bound to the Stripe key so a deleted vendor's subscription is cancelled, not left charging.
export const deleteAccount = onCall({ invoker: "public", enforceAppCheck, secrets: [stripeSecretKey] }, async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Please sign in first.");

  const authTime = Number(auth.token.auth_time ?? 0);
  if (Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) {
    throw new HttpsError("failed-precondition", "requires-recent-login");
  }

  const uid = auth.uid;
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const profile = await db.collection("users").doc(uid).get();
  const role = (profile.get("role") as "couple" | "vendor" | undefined) ?? null;

  for (const step of deletionSteps) {
    try {
      await step.run({ uid, role, db, bucket });
    } catch (err) {
      // Log without personal data; the uid is an opaque identifier.
      logger.error("deleteAccount step failed", { step: step.name, uid, err: String(err) });
      throw new HttpsError("internal", "We couldn't finish removing your data. Please try again.");
    }
  }

  await getAuth().deleteUser(uid);
  logger.info("deleteAccount complete", { uid, role });
  return { deleted: true };
});

/**
 * AI render of a real room decorated with only the selected, deliverable
 * items. Cached by content (see render/cache-key.ts); quota is reserved
 * before calling the model and refunded on failure.
 */
export const requestRender = onCall(
  { invoker: "public", enforceAppCheck, secrets: [geminiApiKey], timeoutSeconds: 180, memory: "1GiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in first.");
    // Family members voting on a link are anonymous: they can't spend render allowances.
    if (request.auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("permission-denied", "Please create an account to render.");
    const req = parseRequest(request.data);
    const raw = (geminiApiKey.value() ?? "").trim();
    const apiKey = raw && !["demo", "none"].includes(raw.toLowerCase()) ? raw : null;
    return handleRenderRequest(request.auth.uid, req, {
      db: getFirestore(),
      bucket: getStorage().bucket(),
      apiKey,
      now: () => new Date(),
      emulator: process.env.FUNCTIONS_EMULATOR === "true",
    });
  },
);

/**
 * Planning assistant: a chat that suggests checked changes to a couple's plan
 * (guests, room, tier, theme, items, date). Couples apply suggestions
 * themselves. Same key as renders; with no key it runs a labelled DEMO.
 */
export const planAssistant = onCall({ invoker: "public", enforceAppCheck, secrets: [geminiApiKey], timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in first.");
  if (request.auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("permission-denied", "Please create an account to use the planning assistant.");
  const profile = await getFirestore().doc(`users/${request.auth.uid}`).get();
  if (profile.get("role") !== "couple") throw new HttpsError("permission-denied", "The planning assistant is for couples' plans.");
  const req = parseAssistantRequest(request.data);
  const raw = (geminiApiKey.value() ?? "").trim();
  const apiKey = raw && !["demo", "none"].includes(raw.toLowerCase()) ? raw : null;
  return handleAssistantRequest(request.auth.uid, req, { db: getFirestore(), apiKey, now: () => new Date() });
});

/**
 * Aria as a wedding planner, before there is a plan: recommends listed venues
 * and decorators and proposes a plan to start. Open to couples and to guest
 * (anonymous) sessions, which get a smaller daily allowance. Not for vendors.
 */
export const ariaChat = onCall({ invoker: "public", enforceAppCheck, secrets: [geminiApiKey], timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please refresh the page and try again.");
  const guest = request.auth.token.firebase?.sign_in_provider === "anonymous";
  if (!guest) {
    const profile = await getFirestore().doc(`users/${request.auth.uid}`).get();
    if (profile.get("role") === "vendor") throw new HttpsError("permission-denied", "Aria plans weddings for couples.");
  }
  const req = parsePlannerRequest(request.data);
  const raw = (geminiApiKey.value() ?? "").trim();
  const apiKey = raw && !["demo", "none"].includes(raw.toLowerCase()) ? raw : null;
  return handlePlannerRequest(request.auth.uid, req, { db: getFirestore(), apiKey, now: () => new Date(), guest });
});

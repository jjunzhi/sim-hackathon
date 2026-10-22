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
import { handleRenderRequest, parseRequest } from "./render/request-render.js";

export { venueCapacitySummary } from "./venues/trigger.js";
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
export const deleteAccount = onCall({ enforceAppCheck, secrets: [stripeSecretKey] }, async (request) => {
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
  { enforceAppCheck, secrets: [geminiApiKey], timeoutSeconds: 180, memory: "1GiB" },
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

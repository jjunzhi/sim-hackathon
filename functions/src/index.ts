import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/https";
import { logger } from "firebase-functions";
import { setGlobalOptions } from "firebase-functions/options";
import { deletionSteps } from "./deletion.js";

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
export const deleteAccount = onCall({ enforceAppCheck }, async (request) => {
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

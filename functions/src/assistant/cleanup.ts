import { getFirestore } from "firebase-admin/firestore";
import { onDocumentDeleted } from "firebase-functions/firestore";

/**
 * Deleting a plan deletes its Aria decision log. Firestore keeps
 * subcollections when a parent document is deleted, so this removes them.
 */
export const planDecisionsCleanup = onDocumentDeleted({ document: "projects/{planId}", region: "asia-southeast1", maxInstances: 10 }, async (event) => {
  const db = getFirestore();
  await db.recursiveDelete(db.collection(`projects/${event.params.planId}/decisions`));
});

import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/firestore";
import { summariseSpaces } from "./summary.js";

/**
 * Keeps venues/{venueId}.capacitySummary in step with its spaces, for the
 * catalog's guest range, "fits N guests" filter and "from" price. Clients
 * can never write this field (firestore.rules).
 */
// Region set here, not via setGlobalOptions: imports run before index.ts calls it,
// and a Firestore trigger must live in the database's region.
export const venueCapacitySummary = onDocumentWritten({ document: "venues/{venueId}/spaces/{spaceId}", region: "asia-southeast1", maxInstances: 10 }, async (event) => {
  const db = getFirestore();
  const venueRef = db.doc(`venues/${event.params.venueId}`);
  const [venue, spaces] = await Promise.all([venueRef.get(), venueRef.collection("spaces").get()]);
  if (!venue.exists) return; // venue being deleted
  const summary = summariseSpaces(
    spaces.docs.map((d) => d.data() as { capacityMin: number; capacityMax: number; tiers: Record<string, { roomRentalCents: number } | undefined> }),
  );
  await venueRef.update({ capacitySummary: summary });
});

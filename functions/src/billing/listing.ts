import type { Firestore } from "firebase-admin/firestore";
import { inGoodStanding, readBilling } from "./standing.js";

/**
 * The public catalog shows a vendor's venues and items only while the vendor
 * is in good standing. `listed` is a server-only field on vendors/{uid} and on
 * each of its venues (the catalog query filters on it, and the rules check it),
 * so a vendor can never list itself from the client. Data is never deleted:
 * a lapsed vendor keeps everything, and paying again lists it again.
 *
 * Returns the value written. Writes only what changed.
 */
export async function syncListing(db: Firestore, uid: string, nowMs: number): Promise<boolean> {
  const [billing, vendor, venues] = await Promise.all([
    db.doc(`billing/${uid}`).get(),
    db.doc(`vendors/${uid}`).get(),
    db.collection("venues").where("ownerUid", "==", uid).get(),
  ]);
  const listed = inGoodStanding(readBilling(billing.data()), nowMs);
  const batch = db.batch();
  let writes = 0;
  if (vendor.exists && vendor.get("listed") !== listed) {
    batch.update(vendor.ref, { listed });
    writes++;
  }
  for (const v of venues.docs) {
    if (v.get("listed") !== listed) {
      batch.update(v.ref, { listed });
      writes++;
    }
  }
  if (writes) await batch.commit();
  return listed;
}

/** Daily: pilots that ended and grace periods that ran out. Small pilot, so a full scan is fine. */
export async function sweepListings(db: Firestore, nowMs: number): Promise<{ checked: number }> {
  const all = await db.collection("billing").get();
  for (const d of all.docs) await syncListing(db, d.id, nowMs);
  return { checked: all.size };
}

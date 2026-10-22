import type { Firestore } from "firebase-admin/firestore";
import type { getStorage } from "firebase-admin/storage";

type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

export interface DeletionContext {
  uid: string;
  role: "couple" | "vendor" | null;
  db: Firestore;
  bucket: Bucket;
}

/**
 * Everything a user owns, removed in order. Later phases register their own
 * steps here (saved renders, projects, share links, votes, leads).
 * The user's profile document goes last, after the data that references it.
 */
export const deletionSteps: Array<{ name: string; run: (ctx: DeletionContext) => Promise<void> }> = [
  {
    name: "vendor venues, spaces and photos",
    run: async ({ uid, db, bucket }) => {
      const venues = await db.collection("venues").where("ownerUid", "==", uid).get();
      for (const venue of venues.docs) {
        await bucket.deleteFiles({ prefix: `venues/${venue.id}/` });
        await db.recursiveDelete(venue.ref);
      }
    },
  },
  {
    name: "vendor business profile, inventory, packages and photos",
    run: async ({ uid, db, bucket }) => {
      await bucket.deleteFiles({ prefix: `vendors/${uid}/` });
      await db.recursiveDelete(db.collection("vendors").doc(uid));
    },
  },
  {
    // Renders hold no personal data and are shared between couples, but
    // they show this vendor's premises or products, so they go with the vendor.
    name: "renders of this vendor's rooms or items",
    run: async ({ uid, db, bucket }) => {
      const byVenue = await db.collection("renders").where("vendorUid", "==", uid).get();
      const byItems = await db.collection("renders").where("itemVendorUids", "array-contains", uid).get();
      const docs = new Map([...byVenue.docs, ...byItems.docs].map((d) => [d.id, d]));
      for (const d of docs.values()) {
        const path = d.get("path") as string | undefined;
        if (path) await bucket.file(path).delete({ ignoreNotFound: true });
        await d.ref.delete();
      }
    },
  },
  {
    // Plans hold the couple's saved-render references; the shared render
    // images themselves contain no personal data and stay in the cache.
    name: "couple plans and saved renders",
    run: async ({ uid, db }) => {
      const plans = await db.collection("projects").where("ownerUid", "==", uid).get();
      await Promise.all(plans.docs.map((d) => db.recursiveDelete(d.ref)));
    },
  },
  {
    // Visitors to a deleted link see "This project has been removed".
    name: "couple family links and all their votes",
    run: async ({ uid, db }) => {
      const shares = await db.collection("shares").where("ownerUid", "==", uid).get();
      await Promise.all(shares.docs.map((d) => db.recursiveDelete(d.ref)));
    },
  },
  {
    // Unconfirmed requests are removed from the vendor's table.
    // Confirmed ones follow OPTION B, chosen by the product owner and PENDING
    // PDPA REVIEW before launch: keep the vendor's confirmation snapshot (prices
    // and items only) but remove the couple's contact details and plan link.
    name: "couple leads (unconfirmed deleted; confirmed anonymised, option B)",
    run: async ({ uid, db }) => {
      const leads = await db.collection("leads").where("coupleUid", "==", uid).get();
      for (const d of leads.docs) {
        if (d.get("status") === "confirmed") {
          await d.ref.update({ coupleUid: null, planId: null, contact: null, renders: [], anonymised: true });
        } else {
          await d.ref.delete();
        }
      }
      const confs = await db.collection("confirmations").where("coupleUid", "==", uid).get();
      await Promise.all(confs.docs.map((d) => d.ref.update({ coupleUid: null, planId: null })));
    },
  },
  {
    // The vendor's own records: its leads and the confirmations it gave.
    name: "vendor leads and confirmations",
    run: async ({ uid, db }) => {
      const [leads, confs] = await Promise.all([
        db.collection("leads").where("vendorUid", "==", uid).get(),
        db.collection("confirmations").where("vendorUid", "==", uid).get(),
      ]);
      await Promise.all([...leads.docs, ...confs.docs].map((d) => d.ref.delete()));
    },
  },
  {
    name: "guest list",
    run: async ({ uid, db }) => {
      await db.recursiveDelete(db.collection("guestLists").doc(uid));
    },
  },
  {
    // Ritual checklist ticks and the couple's own items (Phase 6).
    name: "ritual checklists",
    run: async ({ uid, db }) => {
      await db.recursiveDelete(db.collection("checklists").doc(uid));
    },
  },
  {
    name: "render usage counters",
    run: async ({ uid, db }) => {
      const usage = await db.collection("usage").where("subject", "==", uid).get();
      await Promise.all(usage.docs.map((d) => d.ref.delete()));
    },
  },
  {
    name: "user files",
    run: async ({ uid, bucket }) => {
      await bucket.deleteFiles({ prefix: `users/${uid}/` });
    },
  },
  {
    name: "user profile",
    run: async ({ uid, db }) => {
      await db.recursiveDelete(db.collection("users").doc(uid));
    },
  },
];

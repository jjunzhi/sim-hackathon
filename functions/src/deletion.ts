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
    name: "guest list",
    run: async ({ uid, db }) => {
      await db.recursiveDelete(db.collection("guestLists").doc(uid));
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

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

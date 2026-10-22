"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFirebase } from "@/lib/firebase/client";
import type { PreparedImage } from "@/lib/images/prepare-image";
import type { Space, StoredPhoto, Venue } from "@/lib/venues/model";

export type WithId<T> = T & { id: string };

export type VenueProfileInput = Pick<
  Venue,
  | "name"
  | "address"
  | "postalCode"
  | "description"
  | "styleTags"
  | "cultureTags"
  | "wheelchairAccess"
  | "liftAccess"
  | "stepFreeEntrance"
  | "accessibleToilet"
  | "accessibleParking"
  | "menuOptions"
>;

export type SpaceInput = Pick<Space, "name" | "capacityMin" | "capacityMax" | "seatsPerTable" | "tiers" | "sortOrder">;

export async function createVenue(ownerUid: string, profile: VenueProfileInput): Promise<string> {
  const { db } = getFirebase();
  const ref = await addDoc(collection(db, "venues"), {
    ...profile,
    ownerUid,
    status: "draft",
    verified: false,
    coverPhoto: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateVenue(venueId: string, patch: Partial<Omit<Venue, "ownerUid" | "verified">>) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "venues", venueId), { ...patch, updatedAt: serverTimestamp() });
}

/** Publishing a venue also publishes the business, so its items become visible to couples. */
export async function setVenueStatus(venue: WithId<Venue>, status: Venue["status"]) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.update(doc(db, "venues", venue.id), { status, updatedAt: serverTimestamp() });
  if (status === "active") batch.update(doc(db, "vendors", venue.ownerUid), { published: true, updatedAt: serverTimestamp() });
  await batch.commit();
}

/** Published venues, for decorators choosing where they work. */
export function watchPublishedVenues(onData: (venues: WithId<Venue>[]) => void, onError: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "venues"), where("status", "==", "active"), where("listed", "==", true)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Venue) }))),
    onError,
  );
}

export function watchMyVenues(uid: string, onData: (venues: WithId<Venue>[]) => void, onError: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "venues"), where("ownerUid", "==", uid)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Venue) }))),
    onError,
  );
}

export function watchVenue(venueId: string, onData: (v: WithId<Venue> | null) => void, onError: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    doc(db, "venues", venueId),
    (snap) => onData(snap.exists() ? { id: snap.id, ...(snap.data() as Venue) } : null),
    onError,
  );
}

export function watchSpaces(venueId: string, onData: (s: WithId<Space>[]) => void, onError: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "venues", venueId, "spaces"), orderBy("sortOrder")),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Space) }))),
    onError,
  );
}

export async function createSpace(venueId: string, input: SpaceInput): Promise<string> {
  const { db } = getFirebase();
  const r = await addDoc(collection(db, "venues", venueId, "spaces"), {
    ...input,
    photo: null,
    photoVersion: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return r.id;
}

export async function updateSpace(venueId: string, spaceId: string, input: Partial<SpaceInput>) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "venues", venueId, "spaces", spaceId), { ...input, updatedAt: serverTimestamp() });
}

export async function deleteSpace(venueId: string, space: WithId<Space>) {
  const { db, storage } = getFirebase();
  await deleteDoc(doc(db, "venues", venueId, "spaces", space.id));
  if (space.photo) await deleteObject(ref(storage, space.photo.path)).catch(() => undefined);
}

export function randomId() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function uploadPrepared(path: string, image: PreparedImage, onProgress?: (fraction: number) => void): Promise<StoredPhoto> {
  const { storage } = getFirebase();
  const task = uploadBytesResumable(ref(storage, path), image.blob, {
    contentType: image.contentType,
    cacheControl: "public, max-age=31536000, immutable",
  });
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
      reject,
      () => resolve(),
    );
  });
  return { path, width: image.width, height: image.height, contentType: image.contentType };
}

/** New file each time (immutable URLs), then bump photoVersion and remove the old file. */
export async function uploadSpacePhoto(
  venueId: string,
  space: WithId<Space>,
  image: PreparedImage,
  onProgress?: (fraction: number) => void,
) {
  const { db, storage } = getFirebase();
  const path = `venues/${venueId}/spaces/${space.id}/${randomId()}.${image.extension}`;
  const photo = await uploadPrepared(path, image, onProgress);
  await updateDoc(doc(db, "venues", venueId, "spaces", space.id), {
    photo,
    photoVersion: increment(1),
    updatedAt: serverTimestamp(),
  });
  if (space.photo) await deleteObject(ref(storage, space.photo.path)).catch(() => undefined);
}

export async function uploadCoverPhoto(venue: WithId<Venue>, image: PreparedImage, onProgress?: (fraction: number) => void) {
  const { storage } = getFirebase();
  const path = `venues/${venue.id}/cover/${randomId()}.${image.extension}`;
  const photo = await uploadPrepared(path, image, onProgress);
  await updateVenue(venue.id, { coverPhoto: photo });
  if (venue.coverPhoto) await deleteObject(ref(storage, venue.coverPhoto.path)).catch(() => undefined);
}

const urlCache = new Map<string, Promise<string>>();

export function photoUrl(path: string): Promise<string> {
  let p = urlCache.get(path);
  if (!p) {
    p = getDownloadURL(ref(getFirebase().storage, path));
    urlCache.set(path, p);
  }
  return p;
}

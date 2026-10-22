"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { getFirebase } from "@/lib/firebase/client";
import type { PreparedImage } from "@/lib/images/prepare-image";
import type { InventoryItem, InventoryPackage } from "@/lib/inventory/model";
import { defaultTaxNotes } from "@/lib/legal";
import type { VendorProfile } from "@/lib/vendors/model";
import { randomId, uploadPrepared, type WithId } from "./venues";

type Timestamps = { createdAt: unknown; updatedAt: unknown };
export type ItemInput = Omit<InventoryItem, "photo">;
export type PackageInput = Omit<InventoryPackage, "photo">;
export type BusinessInput = Pick<VendorProfile, "kinds" | "businessName" | "description">;

// ---------- business profile ----------

export function watchVendor(uid: string, onData: (p: VendorProfile | null) => void, onError: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(doc(db, "vendors", uid), (snap) => onData(snap.exists() ? (snap.data() as VendorProfile) : null), onError);
}

export async function createVendor(uid: string, input: BusinessInput) {
  const { db } = getFirebase();
  const profile: VendorProfile & Timestamps = {
    ...input,
    // Defaults; vendors change these on the Business page.
    tax: { serviceChargeBps: 1000, gstBps: 900, ...defaultTaxNotes },
    servesAnyVenue: true,
    servesVenueIds: [],
    published: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "vendors", uid), profile);
}

export async function updateVendor(uid: string, patch: Partial<VendorProfile>) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "vendors", uid), { ...patch, updatedAt: serverTimestamp() });
}

// ---------- items and packages ----------

type Sub = "items" | "packages";

function watchSub<T>(uid: string, sub: Sub, onData: (rows: WithId<T>[]) => void, onError: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "vendors", uid, sub), orderBy("name")),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))),
    onError,
  );
}

export const watchItems = (uid: string, onData: (rows: WithId<InventoryItem>[]) => void, onError: (e: Error) => void) =>
  watchSub<InventoryItem>(uid, "items", onData, onError);

export const watchPackages = (uid: string, onData: (rows: WithId<InventoryPackage>[]) => void, onError: (e: Error) => void) =>
  watchSub<InventoryPackage>(uid, "packages", onData, onError);

export async function createItem(uid: string, input: ItemInput): Promise<string> {
  const { db } = getFirebase();
  const r = await addDoc(collection(db, "vendors", uid, "items"), { ...input, photo: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return r.id;
}

export async function createPackage(uid: string, input: PackageInput): Promise<string> {
  const { db } = getFirebase();
  const r = await addDoc(collection(db, "vendors", uid, "packages"), { ...input, photo: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return r.id;
}

export async function updateSubDoc(uid: string, sub: Sub, id: string, patch: Partial<ItemInput | PackageInput>) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "vendors", uid, sub, id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteSubDoc(uid: string, sub: Sub, row: WithId<{ photo: InventoryItem["photo"] }>) {
  const { db, storage } = getFirebase();
  await deleteDoc(doc(db, "vendors", uid, sub, row.id));
  if (row.photo) await deleteObject(ref(storage, row.photo.path)).catch(() => undefined);
}

/** New immutable file each time; the old one is removed after the record points at the new one. */
export async function uploadSubPhoto(
  uid: string,
  sub: Sub,
  row: WithId<{ photo: InventoryItem["photo"] }>,
  image: PreparedImage,
  onProgress?: (p: number) => void,
) {
  const { db, storage } = getFirebase();
  const path = `vendors/${uid}/${sub}/${row.id}/${randomId()}.${image.extension}`;
  const photo = await uploadPrepared(path, image, onProgress);
  await updateDoc(doc(db, "vendors", uid, sub, row.id), { photo, updatedAt: serverTimestamp() });
  if (row.photo) await deleteObject(ref(storage, row.photo.path)).catch(() => undefined);
}

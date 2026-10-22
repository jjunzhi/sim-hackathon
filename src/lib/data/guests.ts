"use client";

import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import { DEFAULT_TRIM_ORDER, type GuestParty, type TrimmableTier } from "@/lib/guests/helper";
import type { WithId } from "./venues";

export interface GuestListSettings {
  trimOrder: TrimmableTier[];
  /** Which saved plan's room and prices to compare against. */
  planId: string | null;
}

export function watchGuestSettings(uid: string, onData: (s: GuestListSettings) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    doc(db, "guestLists", uid),
    (snap) => onData({ trimOrder: (snap.get("trimOrder") as TrimmableTier[] | undefined) ?? DEFAULT_TRIM_ORDER, planId: (snap.get("planId") as string | null | undefined) ?? null }),
    () => onData({ trimOrder: DEFAULT_TRIM_ORDER, planId: null }),
  );
}

export async function saveGuestSettings(uid: string, s: GuestListSettings) {
  const { db } = getFirebase();
  await setDoc(doc(db, "guestLists", uid), { ...s, updatedAt: serverTimestamp() });
}

export function watchParties(uid: string, onData: (p: WithId<GuestParty>[]) => void, onError: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "guestLists", uid, "parties"), orderBy("label")),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as GuestParty) }))),
    onError,
  );
}

export async function addParty(uid: string, p: GuestParty) {
  const { db } = getFirebase();
  await addDoc(collection(db, "guestLists", uid, "parties"), { ...p, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateParty(uid: string, id: string, p: GuestParty) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "guestLists", uid, "parties", id), { ...p, updatedAt: serverTimestamp() });
}

export async function deleteParty(uid: string, id: string) {
  const { db } = getFirebase();
  await deleteDoc(doc(db, "guestLists", uid, "parties", id));
}

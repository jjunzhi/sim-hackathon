"use client";

import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { WithId } from "./venues";

/** checklists/{uid}: which built-in items are ticked, keyed "ritual.item". */
export interface ChecklistTicks {
  ticks: Record<string, true>;
}

/** checklists/{uid}/items/{id}: the couple's own additions. */
export interface CustomItem {
  ritualId: string;
  text: string;
  done: boolean;
}

export function watchTicks(uid: string, onData: (t: ChecklistTicks) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(doc(db, "checklists", uid), (snap) => onData({ ticks: (snap.data()?.ticks as Record<string, true> | undefined) ?? {} }));
}

export async function setTick(uid: string, key: string, on: boolean): Promise<void> {
  const { db } = getFirebase();
  // setDoc with merge creates the document on the first tick.
  await setDoc(doc(db, "checklists", uid), { ticks: { [key]: on ? true : deleteField() }, updatedAt: serverTimestamp() }, { merge: true });
}

export function watchCustomItems(uid: string, onData: (items: WithId<CustomItem>[]) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(collection(db, "checklists", uid, "items"), (snap) => {
    onData(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as CustomItem & { createdAt?: { toMillis(): number } }) }))
        .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)),
    );
  });
}

export async function addCustomItem(uid: string, ritualId: string, text: string): Promise<void> {
  const { db } = getFirebase();
  await addDoc(collection(db, "checklists", uid, "items"), { ritualId, text, done: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function setCustomDone(uid: string, id: string, done: boolean): Promise<void> {
  const { db } = getFirebase();
  await updateDoc(doc(db, "checklists", uid, "items", id), { done, updatedAt: serverTimestamp() });
}

export async function removeCustomItem(uid: string, id: string): Promise<void> {
  const { db } = getFirebase();
  await deleteDoc(doc(db, "checklists", uid, "items", id));
}

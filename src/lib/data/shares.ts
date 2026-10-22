"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import { newShareId, type Share, type ShareOption, type Vote } from "@/lib/sharing/model";
import type { WithId } from "./venues";

export type ShareRow = WithId<Share> & { createdAt?: { toDate(): Date } };

export async function createShare(ownerUid: string, title: string, options: ShareOption[]): Promise<string> {
  const { db } = getFirebase();
  const id = newShareId();
  await setDoc(doc(db, "shares", id), { ownerUid, title, status: "active", options, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return id;
}

export function watchMyShares(uid: string, onData: (s: ShareRow[]) => void, onError: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "shares"), where("ownerUid", "==", uid)),
    (snap) =>
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ShareRow)
          .sort((a, b) => (b.createdAt?.toDate().getTime() ?? 0) - (a.createdAt?.toDate().getTime() ?? 0)),
      ),
    onError,
  );
}

/** Final: the options are cleared, so nothing is left to see. */
export async function revokeShare(id: string) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "shares", id), { status: "revoked", options: [], title: "", updatedAt: serverTimestamp() });
}

export async function deleteShare(id: string) {
  const { db } = getFirebase();
  const votes = await getDocs(collection(db, "shares", id, "votes"));
  await Promise.all(votes.docs.map((v) => deleteDoc(v.ref)));
  await deleteDoc(doc(db, "shares", id));
}

export function watchVotes(shareId: string, onData: (v: WithId<Vote>[]) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    collection(db, "shares", shareId, "votes"),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Vote) }))),
    () => onData([]),
  );
}

export function shareUrl(id: string): string {
  return `${window.location.origin}/s/${id}`;
}

// ---------- family member side ----------

/** Family members don't need an account: an anonymous session is enough to vote once. */
export async function ensureVisitorSession(): Promise<string> {
  const { auth } = getFirebase();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export type ShareLookup = { kind: "removed" } | { kind: "revoked" } | { kind: "active"; share: WithId<Share> };

export async function getShare(id: string): Promise<ShareLookup> {
  const { db } = getFirebase();
  try {
    const snap = await getDoc(doc(db, "shares", id));
    if (!snap.exists()) return { kind: "removed" };
    const s = { id: snap.id, ...(snap.data() as Share) };
    return s.status === "active" ? { kind: "active", share: s } : { kind: "revoked" };
  } catch {
    return { kind: "removed" };
  }
}

export async function getMyVote(shareId: string, uid: string): Promise<Vote | null> {
  const { db } = getFirebase();
  try {
    const snap = await getDoc(doc(db, "shares", shareId, "votes", uid));
    return snap.exists() ? (snap.data() as Vote) : null;
  } catch {
    return null;
  }
}

export async function castVote(shareId: string, uid: string, vote: Vote) {
  const { db } = getFirebase();
  await setDoc(doc(db, "shares", shareId, "votes", uid), { ...vote, createdAt: serverTimestamp() });
}

"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { Plan, PlanDraft } from "@/lib/plans/model";
import type { WithId } from "./venues";

export type PlanRow = WithId<Plan> & { updatedAt?: { toDate(): Date } };

export async function createPlan(ownerUid: string, draft: PlanDraft): Promise<string> {
  const { db } = getFirebase();
  const r = await addDoc(collection(db, "projects"), { ...draft, ownerUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return r.id;
}

export async function updatePlan(id: string, patch: Partial<PlanDraft>) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "projects", id), { ...patch, updatedAt: serverTimestamp() });
}

export async function getPlan(id: string): Promise<PlanRow | null> {
  const { db } = getFirebase();
  try {
    const snap = await getDoc(doc(db, "projects", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as PlanRow) : null;
  } catch {
    return null;
  }
}

export function watchMyPlans(uid: string, onData: (plans: PlanRow[]) => void, onError: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "projects"), where("ownerUid", "==", uid)),
    (snap) =>
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PlanRow)
          .sort((a, b) => (b.updatedAt?.toDate().getTime() ?? 0) - (a.updatedAt?.toDate().getTime() ?? 0)),
      ),
    onError,
  );
}

export async function deletePlan(id: string) {
  const { db } = getFirebase();
  await deleteDoc(doc(db, "projects", id));
}

// ---- unsaved plan, kept for the trip through sign-up ----
// sessionStorage: this tab only, gone when the tab closes. Holds no personal data.
const DRAFT_KEY = "wv-studio-draft";

export function stashDraft(draft: PlanDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private mode or storage blocked: the couple just starts again after sign-up.
  }
}

/** Read without removing (React may run initialisers twice); clear once saved. */
export function peekStashedDraft(venueId: string): PlanDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as PlanDraft;
    return d.venueId === venueId ? d : null;
  } catch {
    return null;
  }
}

export function clearStashedDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // nothing to clear
  }
}

/** Plans a couple already has (for the 10-plan limit). */
export async function countMyPlans(uid: string): Promise<number> {
  const { db } = getFirebase();
  const snap = await getDocs(query(collection(db, "projects"), where("ownerUid", "==", uid)));
  return snap.size;
}

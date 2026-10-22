"use client";

import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch, type Unsubscribe } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { Estimate } from "@/lib/estimate/engine";
import { ENGINE_VERSION, type Confirmation, type Lead } from "@/lib/leads/model";
import type { WithId } from "./venues";

export type LeadRow = WithId<Lead> & { createdAtMs: number };
export type ConfirmationRow = WithId<Confirmation>;

const toLead = (id: string, d: Record<string, unknown>): LeadRow => ({
  id,
  ...(d as unknown as Lead),
  createdAtMs: (d.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now(),
});

export async function requestConfirmation(lead: Omit<Lead, "status" | "confirmationId">): Promise<string> {
  const { db } = getFirebase();
  const r = await addDoc(collection(db, "leads"), { ...lead, status: "new", confirmationId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return r.id;
}

function watchLeadsBy(field: "coupleUid" | "vendorUid", uid: string, onData: (l: LeadRow[]) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "leads"), where(field, "==", uid)),
    (snap) => onData(snap.docs.map((d) => toLead(d.id, d.data())).sort((a, b) => b.createdAtMs - a.createdAtMs)),
    () => onData([]),
  );
}

export const watchCoupleLeads = (uid: string, onData: (l: LeadRow[]) => void) => watchLeadsBy("coupleUid", uid, onData);
export const watchVendorLeads = (uid: string, onData: (l: LeadRow[]) => void) => watchLeadsBy("vendorUid", uid, onData);

export function watchConfirmationsBy(field: "coupleUid" | "vendorUid", uid: string, onData: (c: ConfirmationRow[]) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "confirmations"), where(field, "==", uid)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Confirmation) }))),
    () => onData([]),
  );
}

export async function getLead(id: string): Promise<LeadRow | null> {
  const { db } = getFirebase();
  try {
    const snap = await getDoc(doc(db, "leads", id));
    return snap.exists() ? toLead(snap.id, snap.data()) : null;
  } catch {
    return null;
  }
}

export async function getConfirmation(id: string): Promise<ConfirmationRow | null> {
  const { db } = getFirebase();
  try {
    const snap = await getDoc(doc(db, "confirmations", id));
    return snap.exists() ? { id: snap.id, ...(snap.data() as Confirmation) } : null;
  } catch {
    return null;
  }
}

/**
 * Write the immutable snapshot and mark the lead confirmed in one batch.
 * The snapshot is plain JSON (undefined fields removed) so it stores exactly.
 */
export async function confirmLead(lead: LeadRow, args: { estimate: Estimate; validUntil: Date; note: string; vendorName: string }) {
  const { db, auth } = getFirebase();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");
  const batch = writeBatch(db);
  batch.set(doc(db, "confirmations", lead.id), {
    leadId: lead.id,
    vendorUid: uid,
    coupleUid: lead.coupleUid,
    planId: lead.planId,
    vendorName: args.vendorName,
    venueName: lead.venueName,
    spaceName: lead.spaceName,
    tierKey: lead.tierKey,
    headcount: lead.headcount,
    snapshot: JSON.parse(JSON.stringify(args.estimate)),
    engineVersion: ENGINE_VERSION,
    confirmedBy: uid,
    confirmedByName: args.vendorName,
    note: args.note,
    confirmedAt: serverTimestamp(),
    validUntil: Timestamp.fromDate(args.validUntil),
  });
  batch.update(doc(db, "leads", lead.id), { status: "confirmed", confirmationId: lead.id, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function declineLead(id: string) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "leads", id), { status: "declined", updatedAt: serverTimestamp() });
}

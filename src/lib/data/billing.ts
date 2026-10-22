"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { Booking } from "@/lib/billing/commission";
import { readBilling, type BillingDoc } from "@/lib/billing/standing";
import { callableMessage } from "@/lib/firebase/callable-error";
import { getFirebase } from "@/lib/firebase/client";
import type { WithId } from "./venues";

// ---------- plan status (billing/{uid}, server-written) ----------

export function watchBilling(uid: string, onData: (b: BillingDoc) => void, onError?: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(doc(db, "billing", uid), (snap) => onData(readBilling(snap.data())), onError);
}

/** "billing-not-configured", "already-subscribed", "no-customer", or a generic failure. */
export type BillingErrorCode = "billing-not-configured" | "already-subscribed" | "no-customer" | "failed";
const codeOf = (err: unknown): BillingErrorCode => {
  const m = callableMessage(err);
  return m === "billing-not-configured" || m === "already-subscribed" || m === "no-customer" ? m : "failed";
};

/** Sends the vendor to Stripe Checkout. Resolves only on failure. */
export async function startCheckout(): Promise<BillingErrorCode> {
  try {
    const res = await httpsCallable<unknown, { url: string }>(getFirebase().functions, "createCheckoutSession")();
    window.location.assign(res.data.url);
    return "failed"; // navigating away
  } catch (err) {
    return codeOf(err);
  }
}

/** Sends the vendor to the Stripe Customer Portal. Resolves only on failure. */
export async function openPortal(): Promise<BillingErrorCode> {
  try {
    const res = await httpsCallable<unknown, { url: string }>(getFirebase().functions, "createPortalSession")();
    window.location.assign(res.data.url);
    return "failed";
  } catch (err) {
    return codeOf(err);
  }
}

// ---------- pilot invites ----------

export type InviteResult = { ok: true; pilotUntilMs: number } | { ok: false; reason: "invalid" | "used" | "expired" | "failed" };

export async function redeemInvite(code: string): Promise<InviteResult> {
  try {
    const res = await httpsCallable<{ code: string }, { pilotUntilMs: number }>(getFirebase().functions, "redeemInvite")({ code: code.trim() });
    return { ok: true, pilotUntilMs: res.data.pilotUntilMs };
  } catch (err) {
    const m = callableMessage(err);
    return { ok: false, reason: m === "invalid-code" ? "invalid" : m === "code-used" ? "used" : m === "code-expired" ? "expired" : "failed" };
  }
}

// An invite link is opened before the account exists; keep the code for this
// tab until the vendor area can redeem it (works for email and Google sign-up).
const PENDING_INVITE = "wv-pending-invite";
export function stashInvite(code: string) {
  try {
    sessionStorage.setItem(PENDING_INVITE, code);
  } catch {
    // Storage blocked: the vendor can still type the code on the Plan page.
  }
}
export function takeStashedInvite(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_INVITE);
    sessionStorage.removeItem(PENDING_INVITE);
    return v;
  } catch {
    return null;
  }
}

// ---------- bookings ----------

export type BookingRow = WithId<Booking>;
const toBooking = (id: string, d: Record<string, unknown>): BookingRow => ({ id, ...(d as unknown as Booking) });

export function watchVendorBookings(uid: string, onData: (rows: BookingRow[]) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(query(collection(db, "bookings"), where("vendorUid", "==", uid)), (snap) => onData(snap.docs.map((d) => toBooking(d.id, d.data()))));
}

export function watchCoupleBookings(uid: string, onData: (rows: BookingRow[]) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(query(collection(db, "bookings"), where("coupleUid", "==", uid)), (snap) => onData(snap.docs.map((d) => toBooking(d.id, d.data()))));
}

/** The vendor records that a confirmed lead booked. The couple is then asked to confirm. */
export async function claimBooking(lead: { id: string; vendorUid: string; coupleUid: string | null }, eventDate: string, valueCents: number | null) {
  const { db } = getFirebase();
  await setDoc(doc(db, "bookings", lead.id), {
    leadId: lead.id,
    vendorUid: lead.vendorUid,
    coupleUid: lead.coupleUid,
    eventDate,
    valueCents,
    status: "claimed",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** After a dispute, the vendor corrects the details and asks again. */
export async function correctBooking(leadId: string, eventDate: string, valueCents: number | null) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "bookings", leadId), { eventDate, valueCents, status: "claimed", updatedAt: serverTimestamp() });
}

export async function withdrawBooking(leadId: string) {
  const { db } = getFirebase();
  await deleteDoc(doc(db, "bookings", leadId));
}

export async function answerBooking(leadId: string, answer: "confirmed" | "disputed") {
  const { db } = getFirebase();
  await updateDoc(doc(db, "bookings", leadId), { status: answer, respondedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

// ---------- feedback ----------

export async function sendFeedback(uid: string, text: string, page: string) {
  const { db } = getFirebase();
  await addDoc(collection(db, "feedback"), { uid, text: text.trim().slice(0, 1000), page: page.slice(0, 200), createdAt: serverTimestamp() });
}

/** One lead's booking, if any. A query (not a document read) so "none yet" is allowed by the rules. */
export function watchLeadBooking(vendorUid: string, leadId: string, onData: (row: BookingRow | null) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(query(collection(db, "bookings"), where("vendorUid", "==", vendorUid), where("leadId", "==", leadId)), (snap) =>
    onData(snap.docs[0] ? toBooking(snap.docs[0].id, snap.docs[0].data()) : null),
  );
}

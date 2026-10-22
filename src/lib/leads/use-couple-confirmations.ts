"use client";

import { useEffect, useState } from "react";
import { watchConfirmationsBy, watchCoupleLeads, type ConfirmationRow, type LeadRow } from "@/lib/data/leads";

const NO_LEADS: LeadRow[] = [];
const NO_CONFIRMATIONS: ConfirmationRow[] = [];

type Snapshot = { uid: string; leads: LeadRow[]; confirmations: ConfirmationRow[] };

/** A couple's estimate requests and the confirmations vendors gave, kept live. Empty while signed out. */
export function useCoupleConfirmations(coupleUid: string | null) {
  const [snap, setSnap] = useState<Snapshot>({ uid: "", leads: NO_LEADS, confirmations: NO_CONFIRMATIONS });
  useEffect(() => {
    if (!coupleUid) return;
    // The first result for a new uid starts a fresh snapshot, so one couple's data never mixes with another's.
    const fresh = (s: Snapshot): Snapshot => (s.uid === coupleUid ? s : { uid: coupleUid, leads: NO_LEADS, confirmations: NO_CONFIRMATIONS });
    const subs = [
      watchCoupleLeads(coupleUid, (leads) => setSnap((s) => ({ ...fresh(s), leads }))),
      watchConfirmationsBy("coupleUid", coupleUid, (confirmations) => setSnap((s) => ({ ...fresh(s), confirmations }))),
    ];
    return () => subs.forEach((u) => u());
  }, [coupleUid]);
  const current = coupleUid !== null && snap.uid === coupleUid;
  return { leads: current ? snap.leads : NO_LEADS, confirmations: current ? snap.confirmations : NO_CONFIRMATIONS };
}

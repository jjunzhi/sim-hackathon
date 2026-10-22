"use client";

import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, type Unsubscribe } from "firebase/firestore";
import type { Settled } from "@/lib/assistant/client";
import { getFirebase } from "@/lib/firebase/client";
import type { WithId } from "./venues";

/** One entry in a plan's Aria decision log (projects/{id}/decisions). Owner-only, write-once. */
export interface Decision {
  action: Settled;
  summary: string;
  /** Plain lines describing the changes, in the couple's language at the time. */
  changes: string[];
  beforeCents: number | null;
  afterCents: number | null;
  createdAt?: { toDate(): Date } | null;
}

export const DECISION_LIMITS = { summaryMax: 400, lines: 10, lineMax: 200, shown: 50 } as const;

export async function logDecision(planId: string, d: Omit<Decision, "createdAt">): Promise<void> {
  const { db } = getFirebase();
  await addDoc(collection(db, "projects", planId, "decisions"), {
    action: d.action,
    summary: d.summary.slice(0, DECISION_LIMITS.summaryMax),
    changes: d.changes
      .map((c) => c.trim().slice(0, DECISION_LIMITS.lineMax))
      .filter(Boolean)
      .slice(0, DECISION_LIMITS.lines),
    beforeCents: d.beforeCents,
    afterCents: d.afterCents,
    createdAt: serverTimestamp(),
  });
}

export function watchDecisions(planId: string, onData: (rows: WithId<Decision>[]) => void, onError?: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "projects", planId, "decisions"), orderBy("createdAt", "desc"), limit(DECISION_LIMITS.shown)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Decision) }))),
    onError,
  );
}

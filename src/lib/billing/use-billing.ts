"use client";

import { useEffect, useState } from "react";
import { watchBilling } from "@/lib/data/billing";
import { standingOf, type BillingDoc, type Standing } from "./standing";

/** The vendor's plan status, live. `standing` uses the same rules as the catalog. */
export function useBilling(uid: string | null): { billing: BillingDoc | null; standing: Standing | null; nowMs: number } {
  const [state, setState] = useState<{ uid: string; billing: BillingDoc } | null>(null);
  // The standing changes with the clock (pilot end, grace period), so re-check each minute.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!uid) return;
    const unsub = watchBilling(uid, (billing) => setState({ uid, billing }));
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [uid]);
  const billing = state && state.uid === uid ? state.billing : null;
  return { billing, standing: billing ? standingOf(billing, nowMs) : null, nowMs };
}

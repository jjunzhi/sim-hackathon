"use client";

import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { callableCode, callableMessage } from "@/lib/firebase/callable-error";
import { getFirebase } from "@/lib/firebase/client";
import { usageDocIds } from "@/lib/render/usage";

export interface RenderRequest {
  venueId: string;
  spaceId: string;
  themeId: string;
  items: Array<{ vendorUid: string; itemId: string }>;
}

export interface RenderResult {
  key: string;
  path: string;
  cacheHit: boolean;
  demo: boolean;
  model: string;
  themeId: string;
  itemNames: string[];
  createdAt: string;
}

export class RenderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "RenderError";
  }
}

/** Calls the server; the AI key never leaves it. Errors carry a message safe to show. */
export async function requestRender(req: RenderRequest): Promise<RenderResult> {
  try {
    const call = httpsCallable<RenderRequest, RenderResult>(getFirebase().functions, "requestRender", { timeout: 180_000 });
    return (await call(req)).data;
  } catch (err) {
    const code = callableCode(err);
    const message = callableMessage(err);
    const known = ["resource-exhausted", "failed-precondition", "permission-denied", "invalid-argument", "unavailable", "not-found"];
    throw new RenderError(known.includes(code) && message ? message : "We couldn't create this render. Please try again.", code);
  }
}

/** This vendor's renders this month, and the limit (defaults when no admin override). */
export function watchVendorUsage(uid: string, onData: (v: { used: number; limit: number }) => void): Unsubscribe {
  const { db } = getFirebase();
  const { vendorMonth } = usageDocIds(uid, new Date());
  let used = 0;
  let limit = 300;
  const emit = () => onData({ used, limit });
  const a = onSnapshot(
    doc(db, "usage", vendorMonth),
    (s) => {
      used = (s.get("count") as number | undefined) ?? 0;
      emit();
    },
    () => emit(),
  );
  const b = onSnapshot(
    doc(db, "config", "renderLimits"),
    (s) => {
      const v = s.get("vendorPerMonth");
      limit = typeof v === "number" ? v : 300;
      emit();
    },
    () => emit(),
  );
  return () => {
    a();
    b();
  };
}

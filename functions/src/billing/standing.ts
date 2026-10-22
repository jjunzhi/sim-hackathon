/**
 * Who may be listed in the public catalog. Pure, so the webhook, the daily
 * sweep, the admin scripts and the vendor's billing page all agree.
 *
 * Mirrors src/lib/billing/standing.ts (the client copy shows the same answer).
 */
export type SubscriptionStatus =
  | "none"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

/** billing/{uid}: written only by the server (webhook, invites, admin scripts). */
export interface BillingDoc {
  /** Stripe subscription status, or "none" before any subscription. */
  status: SubscriptionStatus;
  /** End of free pilot access (ms since epoch), or null for none. */
  pilotUntilMs: number | null;
  /** When the subscription first went past_due in the current episode, or null. */
  pastDueSinceMs: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** End of the current paid period (ms), from the subscription item. */
  currentPeriodEndMs: number | null;
  /** True when cancellation is scheduled for the end of the period. */
  cancelAtPeriodEnd: boolean;
  /** Commission on platform-sourced bookings, basis points. Set by an admin; 0 during the pilot. */
  commissionBps: number;
  /** Event time of the last Stripe event applied, to ignore out-of-order deliveries. */
  lastEventAtMs: number | null;
}

export const PAST_DUE_GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const EMPTY_BILLING: BillingDoc = {
  status: "none",
  pilotUntilMs: null,
  pastDueSinceMs: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEndMs: null,
  cancelAtPeriodEnd: false,
  commissionBps: 0,
  lastEventAtMs: null,
};

export type Standing =
  | { kind: "pilot"; untilMs: number }
  | { kind: "active" }
  | { kind: "grace"; untilMs: number }
  | { kind: "lapsed"; reason: "pilot-ended" | "payment-failed" | "canceled" | "none" };

export function standingOf(b: BillingDoc, nowMs: number): Standing {
  if (b.status === "active" || b.status === "trialing") return { kind: "active" };
  if (b.pilotUntilMs !== null && nowMs < b.pilotUntilMs) return { kind: "pilot", untilMs: b.pilotUntilMs };
  if (b.status === "past_due") {
    const since = b.pastDueSinceMs ?? nowMs;
    const until = since + PAST_DUE_GRACE_DAYS * DAY_MS;
    if (nowMs < until) return { kind: "grace", untilMs: until };
    return { kind: "lapsed", reason: "payment-failed" };
  }
  if (b.status === "unpaid") return { kind: "lapsed", reason: "payment-failed" };
  if (b.status === "canceled" || b.status === "incomplete_expired" || b.status === "paused") return { kind: "lapsed", reason: "canceled" };
  if (b.pilotUntilMs !== null) return { kind: "lapsed", reason: "pilot-ended" };
  return { kind: "lapsed", reason: "none" };
}

export const inGoodStanding = (b: BillingDoc, nowMs: number) => standingOf(b, nowMs).kind !== "lapsed";

/** Reads a stored document defensively: missing fields fall back to EMPTY_BILLING. */
export function readBilling(data: Record<string, unknown> | undefined): BillingDoc {
  const d = data ?? {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    status: (str(d.status) as SubscriptionStatus | null) ?? "none",
    pilotUntilMs: num(d.pilotUntilMs),
    pastDueSinceMs: num(d.pastDueSinceMs),
    stripeCustomerId: str(d.stripeCustomerId),
    stripeSubscriptionId: str(d.stripeSubscriptionId),
    currentPeriodEndMs: num(d.currentPeriodEndMs),
    cancelAtPeriodEnd: d.cancelAtPeriodEnd === true,
    commissionBps: num(d.commissionBps) ?? 0,
    lastEventAtMs: num(d.lastEventAtMs),
  };
}

/**
 * Applies a Stripe subscription snapshot. Returns null when the event is older
 * than the last one applied (Stripe doesn't guarantee delivery order).
 */
export function applySubscription(
  prev: BillingDoc,
  sub: { id: string; status: string; customer: string; cancelAtPeriodEnd: boolean; currentPeriodEndMs: number | null },
  eventAtMs: number,
  nowMs: number,
): BillingDoc | null {
  if (prev.lastEventAtMs !== null && eventAtMs < prev.lastEventAtMs) return null;
  const status = (KNOWN.has(sub.status) ? sub.status : "none") as SubscriptionStatus;
  return {
    ...prev,
    status,
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodEndMs: sub.currentPeriodEndMs,
    // The grace clock starts at the first past_due and resets once paid.
    pastDueSinceMs: status === "past_due" ? (prev.status === "past_due" && prev.pastDueSinceMs !== null ? prev.pastDueSinceMs : nowMs) : null,
    lastEventAtMs: eventAtMs,
  };
}

const KNOWN = new Set<string>(["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"]);

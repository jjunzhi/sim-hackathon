import { describe, expect, it } from "vitest";
import { applySubscription, EMPTY_BILLING, inGoodStanding, PAST_DUE_GRACE_DAYS, readBilling, standingOf, type BillingDoc } from "./standing.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 22, 4);
const b = (o: Partial<BillingDoc> = {}): BillingDoc => ({ ...EMPTY_BILLING, ...o });

describe("standingOf", () => {
  it("nobody is listed without a pilot or a subscription", () => {
    expect(standingOf(b(), NOW)).toEqual({ kind: "lapsed", reason: "none" });
  });

  it("pilot until its end date, then lapsed", () => {
    expect(standingOf(b({ pilotUntilMs: NOW + DAY }), NOW)).toEqual({ kind: "pilot", untilMs: NOW + DAY });
    expect(standingOf(b({ pilotUntilMs: NOW - 1 }), NOW)).toEqual({ kind: "lapsed", reason: "pilot-ended" });
  });

  it("an active or trialing subscription wins over an ended pilot", () => {
    expect(standingOf(b({ pilotUntilMs: NOW - DAY, status: "active" }), NOW)).toEqual({ kind: "active" });
    expect(inGoodStanding(b({ status: "trialing" }), NOW)).toBe(true);
  });

  it(`past_due keeps listings for ${PAST_DUE_GRACE_DAYS} days, then lapses`, () => {
    const since = NOW - 3 * DAY;
    expect(standingOf(b({ status: "past_due", pastDueSinceMs: since }), NOW)).toEqual({ kind: "grace", untilMs: since + 7 * DAY });
    expect(standingOf(b({ status: "past_due", pastDueSinceMs: NOW - 7 * DAY }), NOW)).toEqual({ kind: "lapsed", reason: "payment-failed" });
  });

  it("a pilot still running covers a failed payment", () => {
    expect(standingOf(b({ status: "past_due", pastDueSinceMs: NOW - 30 * DAY, pilotUntilMs: NOW + DAY }), NOW).kind).toBe("pilot");
  });

  it("unpaid, canceled, paused and expired setups are lapsed", () => {
    expect(standingOf(b({ status: "unpaid" }), NOW)).toEqual({ kind: "lapsed", reason: "payment-failed" });
    for (const status of ["canceled", "paused", "incomplete_expired"] as const) expect(standingOf(b({ status }), NOW)).toEqual({ kind: "lapsed", reason: "canceled" });
  });
});

describe("applySubscription", () => {
  const sub = (status: string) => ({ id: "sub_1", status, customer: "cus_1", cancelAtPeriodEnd: false, currentPeriodEndMs: NOW + 30 * DAY });

  it("records the snapshot and the event time", () => {
    const next = applySubscription(b(), sub("active"), NOW, NOW)!;
    expect(next).toMatchObject({ status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", lastEventAtMs: NOW, pastDueSinceMs: null });
  });

  it("ignores events older than the last one applied", () => {
    const applied = applySubscription(b(), sub("canceled"), NOW, NOW)!;
    expect(applySubscription(applied, sub("active"), NOW - 1000, NOW)).toBeNull();
    expect(applySubscription(applied, sub("active"), NOW, NOW)).not.toBeNull();
  });

  it("starts the grace clock once and resets it when paid", () => {
    const first = applySubscription(b({ status: "active" }), sub("past_due"), NOW, NOW)!;
    expect(first.pastDueSinceMs).toBe(NOW);
    const again = applySubscription(first, sub("past_due"), NOW + DAY, NOW + DAY)!;
    expect(again.pastDueSinceMs).toBe(NOW);
    const paid = applySubscription(again, sub("active"), NOW + 2 * DAY, NOW + 2 * DAY)!;
    expect(paid.pastDueSinceMs).toBeNull();
  });

  it("keeps the pilot and commission", () => {
    const next = applySubscription(b({ pilotUntilMs: NOW + DAY, commissionBps: 300 }), sub("active"), NOW, NOW)!;
    expect(next).toMatchObject({ pilotUntilMs: NOW + DAY, commissionBps: 300 });
  });

  it("unknown statuses don't grant a listing", () => {
    expect(inGoodStanding(applySubscription(b(), sub("something_new"), NOW, NOW)!, NOW)).toBe(false);
  });
});

describe("readBilling", () => {
  it("fills missing or malformed fields with safe defaults", () => {
    expect(readBilling(undefined)).toEqual(EMPTY_BILLING);
    expect(readBilling({ status: "active", commissionBps: "3%" })).toMatchObject({ status: "active", commissionBps: 0 });
  });
});

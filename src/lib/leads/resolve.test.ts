import { describe, expect, it } from "vitest";
import { calculateEstimate } from "@/lib/estimate/engine";
import type { PlanEstimates } from "@/lib/plans/estimates";
import type { Confirmation, Lead } from "./model";
import { resolvePlan } from "./resolve";

const tax = { serviceChargeBps: 1000, gstBps: 900, noServiceChargeNote: "", noGstNote: "" };
const est = (price: number) => calculateEstimate({ headcount: 100, selections: [{ id: "arch", name: "Arch", kind: "item", unit: "piece", priceCents: price }], tax });
const plan = { headcount: 100, tierKey: null, spaceId: "s1", selections: { "item:venue:arch": 1 } };
const live = (price: number): PlanEstimates => ({
  vendors: [{ vendorUid: "venue", vendorName: "SAMPLE Venue", isVenue: true, estimate: est(price) }],
  combinedTotalCents: est(price).totalCents,
  combinedPerGuestCents: null,
  unavailable: [],
  errors: [],
});
const ts = (ms: number) => ({ toMillis: () => ms });
const NOW = new Date("2026-10-22T07:00:00Z");
const DAY = 86_400_000;

type LeadRow = Lead & { id: string; createdAtMs: number };
const lead = (o: Partial<LeadRow> = {}): LeadRow => ({
  id: "L1", createdAtMs: NOW.getTime() - DAY, coupleUid: "c", vendorUid: "venue", venueOwnerUid: "venue", planId: "p1", venueId: "v", venueName: "V",
  vendorName: "SAMPLE Venue", spaceId: "s1", spaceName: "S", tierKey: null, headcount: 100, selections: { "item:venue:arch": 1 }, renders: [],
  contact: { name: "Sam", reachAt: "x", eventDate: "", message: "" }, status: "confirmed", confirmationId: "L1", ...o,
});
const conf = (snapshotPrice: number, validUntilMs: number): Confirmation & { id: string } => ({
  id: "L1", leadId: "L1", vendorUid: "venue", coupleUid: "c", planId: "p1", vendorName: "SAMPLE Venue", venueName: "V", spaceName: "S", tierKey: null,
  headcount: 100, snapshot: est(snapshotPrice), engineVersion: "1", confirmedBy: "venue", confirmedByName: "SAMPLE Venue", note: "",
  confirmedAt: ts(NOW.getTime() - DAY), validUntil: ts(validUntilMs),
});

describe("resolvePlan", () => {
  it("no request: live Estimate", () => {
    const r = resolvePlan({ plan, planId: "p1", live: live(100_000), leads: [], confirmations: [], now: NOW });
    expect(r.vendors[0]!.status).toEqual({ kind: "estimate", pendingLeadId: null });
  });

  it("request sent, not yet confirmed: still an Estimate, marked pending", () => {
    const r = resolvePlan({ plan, planId: "p1", live: live(100_000), leads: [lead({ status: "new", confirmationId: null })], confirmations: [], now: NOW });
    expect(r.vendors[0]!.status).toEqual({ kind: "estimate", pendingLeadId: "L1" });
  });

  it("confirmed: shows the frozen snapshot even after the vendor raises prices", () => {
    // Confirmed at $1,000 (100,000c); the catalog now says $1,500.
    const r = resolvePlan({ plan, planId: "p1", live: live(150_000), leads: [lead()], confirmations: [conf(100_000, NOW.getTime() + 13 * DAY)], now: NOW });
    expect(r.vendors[0]!.status.kind).toBe("confirmed");
    expect(r.vendors[0]!.estimate.subtotalCents).toBe(100_000);
    expect(r.combinedTotalCents).toBe(est(100_000).totalCents);
    expect(r.confirmedCount).toBe(1);
  });

  it("expired: back to the live Estimate", () => {
    const r = resolvePlan({ plan, planId: "p1", live: live(150_000), leads: [lead()], confirmations: [conf(100_000, NOW.getTime() - 1)], now: NOW });
    expect(r.vendors[0]!.status.kind).toBe("expired");
    expect(r.vendors[0]!.estimate.subtotalCents).toBe(150_000);
  });

  it("plan changed since confirming: live Estimate with a note", () => {
    const r = resolvePlan({ plan: { ...plan, headcount: 120 }, planId: "p1", live: live(100_000), leads: [lead()], confirmations: [conf(100_000, NOW.getTime() + DAY)], now: NOW });
    expect(r.vendors[0]!.status.kind).toBe("changed");
  });

  it("uses the newest request for this plan and vendor only", () => {
    const old = lead({ id: "L0", createdAtMs: NOW.getTime() - 5 * DAY });
    const other = lead({ id: "L9", planId: "p2" });
    const r = resolvePlan({ plan, planId: "p1", live: live(100_000), leads: [old, lead({ status: "new", confirmationId: null }), other], confirmations: [conf(1, NOW.getTime() + DAY)], now: NOW });
    expect(r.vendors[0]!.status).toEqual({ kind: "estimate", pendingLeadId: "L1" });
  });
});

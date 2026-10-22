import type { Estimate } from "@/lib/estimate/engine";
import { perGuest, sumCents, type Cents } from "@/lib/money";
import type { PlanEstimates } from "@/lib/plans/estimates";
import type { Plan } from "@/lib/plans/model";
import { isExpired, planChangedSince, type Confirmation, type Lead } from "./model";

export type VendorStatus =
  /** Live price, labelled Estimate. */
  | { kind: "estimate"; pendingLeadId: string | null }
  /** Vendor-confirmed snapshot, still valid and still matching the plan. */
  | { kind: "confirmed"; validUntilMs: number; confirmedAtMs: number }
  /** A confirmation exists but has expired; show the live Estimate and offer a new request. */
  | { kind: "expired"; validUntilMs: number }
  /** Confirmed, but the couple has changed this vendor's part since. Live Estimate shown. */
  | { kind: "changed"; validUntilMs: number };

export interface ResolvedVendor {
  vendorUid: string;
  vendorName: string;
  isVenue: boolean;
  /** What to show: the snapshot when confirmed, otherwise the live estimate. */
  estimate: Estimate;
  status: VendorStatus;
}

export interface ResolvedPlan {
  vendors: ResolvedVendor[];
  combinedTotalCents: Cents;
  combinedPerGuestCents: Cents | null;
  confirmedCount: number;
}

/**
 * Combine live estimates with the couple's leads and confirmations. A
 * confirmed snapshot is never recalculated: later price changes can't touch it.
 */
export function resolvePlan(args: {
  plan: Pick<Plan, "headcount" | "tierKey" | "spaceId" | "selections">;
  planId: string;
  live: PlanEstimates;
  leads: Array<Lead & { id: string; createdAtMs: number }>;
  confirmations: Array<Confirmation & { id: string }>;
  now: Date;
}): ResolvedPlan {
  const vendors = args.live.vendors.map((v): ResolvedVendor => {
    const mine = args.leads.filter((l) => l.planId === args.planId && l.vendorUid === v.vendorUid).sort((a, b) => b.createdAtMs - a.createdAtMs);
    const latest = mine[0];
    const conf = latest?.status === "confirmed" ? args.confirmations.find((c) => c.id === latest.confirmationId) : undefined;
    if (latest && conf) {
      const validUntilMs = conf.validUntil.toMillis();
      if (isExpired(validUntilMs, args.now)) return { ...v, status: { kind: "expired", validUntilMs } };
      if (planChangedSince(latest, args.plan, v.vendorUid, v.isVenue)) return { ...v, status: { kind: "changed", validUntilMs } };
      return { ...v, estimate: conf.snapshot, status: { kind: "confirmed", validUntilMs, confirmedAtMs: conf.confirmedAt.toMillis() } };
    }
    return { ...v, status: { kind: "estimate", pendingLeadId: latest?.status === "new" ? latest.id : null } };
  });
  const combinedTotalCents = sumCents(vendors.map((v) => v.estimate.totalCents));
  return {
    vendors,
    combinedTotalCents,
    combinedPerGuestCents: perGuest(combinedTotalCents, args.plan.headcount),
    confirmedCount: vendors.filter((v) => v.status.kind === "confirmed").length,
  };
}

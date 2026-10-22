import { buildEstimateInput, type Chosen } from "@/lib/estimate/build";
import { calculateEstimate, type Estimate } from "@/lib/estimate/engine";
import type { InventoryItem, InventoryPackage } from "@/lib/inventory/model";
import { perGuest, sumCents, type Cents } from "@/lib/money";
import type { Space } from "@/lib/venues/model";
import type { VendorProfile } from "@/lib/vendors/model";
import { parseSelectionKey, type Plan } from "./model";

type Row<T> = T & { id: string };

export interface VendorCatalog {
  uid: string;
  profile: Pick<VendorProfile, "businessName" | "tax">;
  items: Row<InventoryItem>[];
  packages: Row<InventoryPackage>[];
}

export interface VendorEstimate {
  vendorUid: string;
  vendorName: string;
  isVenue: boolean;
  estimate: Estimate;
}

export interface PlanEstimates {
  vendors: VendorEstimate[];
  /** Sum of each vendor's total. Each vendor's own estimate is what it confirms. */
  combinedTotalCents: Cents;
  combinedPerGuestCents: Cents | null;
  /** Selections that are no longer offered (removed, hidden or vendor unpublished). */
  unavailable: string[];
  /** A vendor's selection that can't be priced (for example a package plus its own item). */
  errors: Array<{ vendorName: string; message: string }>;
}

/**
 * One estimate per vendor (agreed in Phase 2): the venue's covers the room
 * rental, minimum spend and its own items; each decorator's covers only its
 * items, with its own tax settings.
 */
export function buildPlanEstimates(args: {
  plan: Pick<Plan, "headcount" | "tierKey" | "selections">;
  venueOwnerUid: string;
  space: Pick<Space, "name" | "seatsPerTable" | "tiers"> | null;
  catalogs: VendorCatalog[];
}): PlanEstimates {
  const { plan, catalogs } = args;
  const byVendor = new Map<string, Chosen>();
  const unavailable: string[] = [];

  for (const [key, qty] of Object.entries(plan.selections)) {
    const sel = parseSelectionKey(key);
    const cat = sel && catalogs.find((c) => c.uid === sel.vendorUid);
    const exists =
      sel &&
      cat &&
      (sel.kind === "item" ? cat.items.some((i) => i.id === sel.id && i.active) : cat.packages.some((p) => p.id === sel.id && p.active));
    if (!sel || !exists) {
      unavailable.push(key);
      continue;
    }
    const chosen = byVendor.get(sel.vendorUid) ?? {};
    chosen[`${sel.kind}:${sel.id}`] = qty;
    byVendor.set(sel.vendorUid, chosen);
  }

  const vendors: VendorEstimate[] = [];
  const errors: PlanEstimates["errors"] = [];
  // Venue first, then decorators with something selected.
  const order = [args.venueOwnerUid, ...[...byVendor.keys()].filter((u) => u !== args.venueOwnerUid)];
  for (const uid of order) {
    const cat = catalogs.find((c) => c.uid === uid);
    if (!cat) continue;
    const isVenue = uid === args.venueOwnerUid;
    const chosen = byVendor.get(uid) ?? {};
    if (!isVenue && Object.keys(chosen).length === 0) continue;
    try {
      const input = buildEstimateInput({
        headcount: plan.headcount,
        space: isVenue ? args.space : null,
        tierKey: isVenue ? plan.tierKey : null,
        items: cat.items.filter((i) => i.active),
        packages: cat.packages.filter((p) => p.active),
        chosen,
        tax: cat.profile.tax,
      });
      // Decorators still price per table using the room's seats per table.
      if (!isVenue && args.space) input.seatsPerTable = args.space.seatsPerTable;
      vendors.push({ vendorUid: uid, vendorName: cat.profile.businessName, isVenue, estimate: calculateEstimate(input) });
    } catch (err) {
      errors.push({ vendorName: cat.profile.businessName, message: (err as Error).message });
    }
  }

  const combinedTotalCents = sumCents(vendors.map((v) => v.estimate.totalCents));
  return {
    vendors,
    combinedTotalCents,
    combinedPerGuestCents: perGuest(combinedTotalCents, plan.headcount),
    unavailable,
    errors,
  };
}

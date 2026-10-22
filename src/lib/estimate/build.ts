import type { InventoryItem, InventoryPackage } from "@/lib/inventory/model";
import type { Space, TaxSettings, Tier } from "@/lib/venues/model";
import type { EstimateInput, EstimateSelection } from "./engine";

export type TierKey = "standard" | "peak" | "offPeak";

export const TIER_LABELS: Record<TierKey, string> = { standard: "", peak: "Peak", offPeak: "Off-Peak" };

/** The tiers a space offers, in display order. */
export function tierKeys(space: Pick<Space, "tiers">): TierKey[] {
  return "peak" in space.tiers ? ["peak", "offPeak"] : ["standard"];
}

export function tierOf(space: Pick<Space, "tiers">, key: TierKey): Tier | null {
  const t = space.tiers as Partial<Record<TierKey, Tier>>;
  return t[key] ?? null;
}

/** Selected rows, keyed "item:<id>" or "package:<id>", with a quantity (pieces only). */
export type Chosen = Record<string, number>;

export function buildEstimateInput(args: {
  headcount: number;
  space: (Pick<Space, "name" | "seatsPerTable" | "tiers">) | null;
  tierKey: TierKey | null;
  items: Array<InventoryItem & { id: string }>;
  packages: Array<InventoryPackage & { id: string }>;
  chosen: Chosen;
  tax: TaxSettings;
}): EstimateInput {
  const { space, tierKey } = args;
  const tier = space && tierKey ? tierOf(space, tierKey) : null;
  const tierLabel = tierKey ? TIER_LABELS[tierKey] : "";

  const selections: EstimateSelection[] = [];
  for (const i of args.items) {
    const q = args.chosen[`item:${i.id}`];
    if (q === undefined) continue;
    selections.push({ id: i.id, name: i.name, kind: "item", unit: i.unit, priceCents: i.priceCents, category: i.category, quantity: i.unit === "piece" ? q : undefined });
  }
  for (const p of args.packages) {
    const q = args.chosen[`package:${p.id}`];
    if (q === undefined) continue;
    selections.push({ id: p.id, name: p.name, kind: "package", unit: p.unit, priceCents: p.priceCents, includesItemIds: p.itemIds, quantity: p.unit === "piece" ? q : undefined });
  }

  return {
    headcount: args.headcount,
    seatsPerTable: space?.seatsPerTable ?? 10,
    rental: space && tier ? { label: `Room rental: ${space.name}${tierLabel ? ` (${tierLabel})` : ""}`, amountCents: tier.roomRentalCents } : null,
    minimumSpendCents: tier?.minimumSpendCents ?? null,
    selections,
    tax: args.tax,
  };
}

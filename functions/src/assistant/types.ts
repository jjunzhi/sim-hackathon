/**
 * Assistant types and the Apply step, with no imports, so the browser can use
 * exactly the same code as the server (src/lib/assistant re-exports it).
 */
export type TierKey = "standard" | "peak" | "offPeak";

/** The parts of a plan the assistant reads and may change. */
export interface PlanSnapshot {
  headcount: number;
  spaceId: string | null;
  tierKey: TierKey | null;
  themeId: string;
  weddingDate: string | null;
  /** selectionKey -> quantity (see src/lib/plans/model.ts). */
  selections: Record<string, number>;
}

export interface ContextSpace {
  id: string;
  name: string;
  capacityMin: number;
  capacityMax: number;
  seatsPerTable: number;
  tiers: Partial<Record<TierKey, { roomRentalCents: number; minimumSpendCents: number | null }>>;
}

export interface ContextOption {
  /** The selection key the plan uses: "item:<vendorUid>:<id>" or "package:<vendorUid>:<id>". */
  key: string;
  vendorName: string;
  name: string;
  category: string;
  unit: "piece" | "table" | "guest";
  priceCents: number;
  dietaryTags: string[];
  /** Packages: the item keys they include. */
  includes: string[];
}

export interface VenueContext {
  venueId: string;
  venueName: string;
  spaces: ContextSpace[];
  options: ContextOption[];
}

export type Change =
  | { kind: "headcount"; value: number }
  | { kind: "space"; spaceId: string; tierKey: TierKey | null }
  | { kind: "tier"; tierKey: TierKey }
  | { kind: "theme"; themeId: string }
  | { kind: "date"; value: string | null }
  | { kind: "add"; key: string; quantity: number }
  | { kind: "remove"; key: string };

export interface Proposal {
  summary: string;
  changes: Change[];
  /** Short, plain notes on suggestions that couldn't be used. Logged, not shown verbatim. */
  dropped: string[];
}

/** Applies checked changes to a plan, exactly as the Studio's Apply button does. */
export function applyChanges(plan: PlanSnapshot, changes: Change[], ctx: VenueContext): PlanSnapshot {
  const next: PlanSnapshot = { ...plan, selections: { ...plan.selections } };
  const byKey = new Map(ctx.options.map((o) => [o.key, o]));
  for (const c of changes) {
    switch (c.kind) {
      case "headcount":
        next.headcount = c.value;
        break;
      case "space":
        next.spaceId = c.spaceId;
        next.tierKey = c.tierKey;
        break;
      case "tier":
        next.tierKey = c.tierKey;
        break;
      case "theme":
        next.themeId = c.themeId;
        break;
      case "date":
        next.weddingDate = c.value;
        break;
      case "remove":
        delete next.selections[c.key];
        break;
      case "add": {
        next.selections[c.key] = c.quantity;
        // A package replaces the separate items it includes, as in the Studio picker.
        for (const inc of byKey.get(c.key)?.includes ?? []) delete next.selections[inc];
        break;
      }
    }
  }
  return next;
}

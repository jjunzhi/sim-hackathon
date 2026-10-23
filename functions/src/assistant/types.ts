/**
 * Assistant (Aria) types and the Apply step, with no imports, so the browser
 * can use exactly the same code as the server (src/lib/assistant re-exports it).
 */
export type TierKey = "standard" | "peak" | "offPeak";

/** Same values as CULTURE_TAGS and DIET_TAGS in src/lib (a unit test keeps them equal). */
export const BRIEF_TRADITIONS = ["Chinese", "Malay", "Indian", "Peranakan", "Western", "Fusion", "Halal-friendly"] as const;
export const BRIEF_DIET_TAGS = ["halal", "vegetarian", "vegan", "no-beef", "no-pork"] as const;

export const BRIEF_LIMITS = { styleMax: 200, notesMax: 500, timelineEntries: 15, timelineLabelMax: 120, budgetMaxCents: 1_000_000_000 } as const;

/**
 * The couple's planning brief. Guests, date and budget live on the plan
 * itself; the brief holds the rest. Free text is the couple's own words and
 * is only ever passed to the model as data.
 */
export interface Brief {
  style: string;
  traditions: string[];
  dietaryTags: string[];
  stepFree: boolean;
  notes: string;
}

export const EMPTY_BRIEF: Brief = { style: "", traditions: [], dietaryTags: [], stepFree: false, notes: "" };

/** One line of the day-of timeline. "HH:MM", 24-hour, Singapore time. */
export interface TimelineEntry {
  time: string;
  label: string;
}

/** The parts of a plan Aria reads and may change. */
export interface PlanSnapshot {
  headcount: number;
  spaceId: string | null;
  tierKey: TierKey | null;
  themeId: string;
  weddingDate: string | null;
  /** selectionKey -> quantity (see src/lib/plans/model.ts). */
  selections: Record<string, number>;
  budgetCents: number | null;
  brief: Brief | null;
  timeline: TimelineEntry[];
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

/** A listed venue Aria may put on a shortlist. All vendor-declared. */
export interface ContextVenue {
  id: string;
  name: string;
  styleTags: string[];
  cultureTags: string[];
  menuOptions: string[];
  stepFree: boolean;
  /** One range per room. */
  ranges: Array<{ min: number; max: number }>;
  fromRentalCents: number | null;
}

export interface VenueContext {
  venueId: string;
  venueName: string;
  spaces: ContextSpace[];
  options: ContextOption[];
  /** Other listed venues, for shortlists. Optional so callers that only apply changes can omit it. */
  venues?: ContextVenue[];
}

export type Change =
  | { kind: "headcount"; value: number }
  | { kind: "space"; spaceId: string; tierKey: TierKey | null }
  | { kind: "tier"; tierKey: TierKey }
  | { kind: "theme"; themeId: string }
  | { kind: "date"; value: string | null }
  | { kind: "add"; key: string; quantity: number }
  | { kind: "remove"; key: string }
  | { kind: "budget"; cents: number }
  | { kind: "brief"; brief: Brief }
  | { kind: "timeline"; entries: TimelineEntry[] };

export interface Proposal {
  /** "Option A" and so on when Aria offers several paths; empty for a single suggestion. */
  label: string;
  summary: string;
  changes: Change[];
  /** Short, plain notes on suggestions that couldn't be used. Logged, not shown verbatim. */
  dropped: string[];
}

export interface ShortlistEntry {
  venueId: string;
  venueName: string;
  reason: string;
}

/** A plan Aria suggests starting. Checked; the couple taps "Start planning here". */
export interface PlanStart {
  summary: string;
  venueId: string;
  venueName: string;
  spaceId: string | null;
  tierKey: TierKey | null;
  headcount: number | null;
  themeId: string | null;
  weddingDate: string | null;
  budgetCents: number | null;
  brief: Brief | null;
  selections: Record<string, number>;
}

export interface VendorPick {
  vendorUid: string;
  vendorName: string;
  reason: string;
}

export interface PlannerResult {
  reply: string;
  shortlist: ShortlistEntry[];
  vendors: VendorPick[];
  plans: PlanStart[];
  demo: boolean;
  remainingToday: number;
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
      case "budget":
        next.budgetCents = c.cents;
        break;
      case "brief":
        next.brief = { ...c.brief, traditions: [...c.brief.traditions], dietaryTags: [...c.brief.dietaryTags] };
        break;
      case "timeline":
        next.timeline = c.entries.map((e) => ({ ...e }));
        break;
    }
  }
  return next;
}

/**
 * Guest list helper. The couple tags every party themselves; nothing here
 * scores or rates people. Only a label, a tier and seat counts are stored.
 */
export const TIERS = ["must", "extended", "close", "casual"] as const;
export type GuestTier = (typeof TIERS)[number];

/** Dictionary key for each tier's label; translate in the component with t(). */
export const TIER_LABEL_KEYS = {
  must: "guests.tierMust",
  extended: "guests.tierExtended",
  close: "guests.tierClose",
  casual: "guests.tierCasual",
} as const satisfies Record<GuestTier, string>;

/** "Must invite" is never suggested for trimming. */
export type TrimmableTier = Exclude<GuestTier, "must">;
export const DEFAULT_TRIM_ORDER: TrimmableTier[] = ["casual", "close", "extended"];

export const GUEST_LIMITS = { labelMax: 80, seatsMax: 30, plusOnesMax: 10, parties: 400 } as const;

export interface GuestParty {
  label: string;
  tier: GuestTier;
  /** People invited in this party, not counting plus-ones. */
  seats: number;
  plusOnes: number;
}

export const partySeats = (p: Pick<GuestParty, "seats" | "plusOnes">) => p.seats + p.plusOnes;

export interface GuestSummary {
  totalSeats: number;
  byTier: Record<GuestTier, number>;
  /** Seats left before the room's maximum; negative when over. null without a room. */
  remaining: number | null;
  over: number;
  /** Tiers to trim, in the couple's order, until within capacity. Empty when within. */
  trimSuggestion: Array<{ tier: TrimmableTier; seats: number }>;
  /** True when trimming every trimmable tier still isn't enough. */
  trimNotEnough: boolean;
}

export function summariseGuests(parties: GuestParty[], capacityMax: number | null, trimOrder: TrimmableTier[] = DEFAULT_TRIM_ORDER): GuestSummary {
  const byTier: Record<GuestTier, number> = { must: 0, extended: 0, close: 0, casual: 0 };
  for (const p of parties) byTier[p.tier] += partySeats(p);
  const totalSeats = TIERS.reduce((n, t) => n + byTier[t], 0);
  const remaining = capacityMax === null ? null : capacityMax - totalSeats;
  const over = remaining !== null && remaining < 0 ? -remaining : 0;

  const trimSuggestion: GuestSummary["trimSuggestion"] = [];
  let toCut = over;
  for (const tier of trimOrder) {
    if (toCut <= 0) break;
    if (byTier[tier] === 0) continue;
    trimSuggestion.push({ tier, seats: byTier[tier] });
    toCut -= byTier[tier];
  }
  return { totalSeats, byTier, remaining, over, trimSuggestion, trimNotEnough: toCut > 0 };
}

/** Dictionary keys for validation messages; the page translates them with the matching GUEST_LIMITS value as {max}. */
export type GuestFieldError = "guests.errLabelMissing" | "guests.errLabelLong" | "guests.errSeats" | "guests.errPlusOnes" | "guests.errTier";

export function validateParty(p: GuestParty): Partial<Record<keyof GuestParty, GuestFieldError>> {
  const e: Partial<Record<keyof GuestParty, GuestFieldError>> = {};
  const label = p.label.trim();
  if (!label) e.label = "guests.errLabelMissing";
  else if (label.length > GUEST_LIMITS.labelMax) e.label = "guests.errLabelLong";
  if (!Number.isSafeInteger(p.seats) || p.seats < 1 || p.seats > GUEST_LIMITS.seatsMax) e.seats = "guests.errSeats";
  if (!Number.isSafeInteger(p.plusOnes) || p.plusOnes < 0 || p.plusOnes > GUEST_LIMITS.plusOnesMax) e.plusOnes = "guests.errPlusOnes";
  if (!TIERS.includes(p.tier)) e.tier = "guests.errTier";
  return e;
}

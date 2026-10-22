/**
 * Guest list helper. The couple tags every party themselves; nothing here
 * scores or rates people. Only a label, a tier and seat counts are stored.
 */
export const TIERS = ["must", "extended", "close", "casual"] as const;
export type GuestTier = (typeof TIERS)[number];

export const TIER_LABELS: Record<GuestTier, string> = {
  must: "Must invite",
  extended: "Extended family",
  close: "Close friends",
  casual: "Casual",
};

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

export function validateParty(p: GuestParty): Partial<Record<keyof GuestParty, string>> {
  const e: Partial<Record<keyof GuestParty, string>> = {};
  const label = p.label.trim();
  if (!label) e.label = "Add a label, for example \"Auntie Mei's family\".";
  else if (label.length > GUEST_LIMITS.labelMax) e.label = `Keep it under ${GUEST_LIMITS.labelMax} characters.`;
  if (!Number.isSafeInteger(p.seats) || p.seats < 1 || p.seats > GUEST_LIMITS.seatsMax) e.seats = `Enter 1 to ${GUEST_LIMITS.seatsMax}.`;
  if (!Number.isSafeInteger(p.plusOnes) || p.plusOnes < 0 || p.plusOnes > GUEST_LIMITS.plusOnesMax) e.plusOnes = `Enter 0 to ${GUEST_LIMITS.plusOnesMax}.`;
  if (!TIERS.includes(p.tier)) e.tier = "Choose a tier.";
  return e;
}

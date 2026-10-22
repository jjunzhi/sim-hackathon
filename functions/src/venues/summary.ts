/** Mirrors CapacitySummary in src/lib/venues/catalog.ts. */
export interface CapacitySummary {
  min: number;
  max: number;
  /** One range per space, so "fits 150 guests" checks a single room. (Maps, not pairs: Firestore can't store nested arrays.) */
  ranges: Array<{ min: number; max: number }>;
  spaceCount: number;
  /** Cheapest room rental across spaces and tiers, for "from" prices. */
  fromRentalCents: number | null;
}

export function summariseSpaces(
  spaces: Array<{ capacityMin: number; capacityMax: number; tiers: Record<string, { roomRentalCents: number } | undefined> }>,
): CapacitySummary | null {
  if (spaces.length === 0) return null;
  const ranges = spaces.map((s) => ({ min: s.capacityMin, max: s.capacityMax }));
  const rentals = spaces.flatMap((s) => Object.values(s.tiers).flatMap((t) => (t ? [t.roomRentalCents] : [])));
  return {
    min: Math.min(...ranges.map((r) => r.min)),
    max: Math.max(...ranges.map((r) => r.max)),
    ranges,
    spaceCount: spaces.length,
    fromRentalCents: rentals.length ? Math.min(...rentals) : null,
  };
}

import type { Venue } from "./model";

/** Written by the server (venueCapacitySummary trigger) whenever a space changes. */
export type { CapacitySummary } from "../../../functions/src/venues/summary";
import type { CapacitySummary } from "../../../functions/src/venues/summary";

export type CatalogVenue = Venue & { id: string; capacitySummary?: CapacitySummary | null };

export interface CatalogFilters {
  guests: number | null;
  wheelchair: boolean;
  lift: boolean;
  styles: string[];
  cultures: string[];
}

export const NO_FILTERS: CatalogFilters = { guests: null, wheelchair: false, lift: false, styles: [], cultures: [] };

/** A venue matches when one of its rooms fits the guests and it has every chosen tag. */
export function matchesFilters(v: CatalogVenue, f: CatalogFilters): boolean {
  if (f.wheelchair && !v.wheelchairAccess) return false;
  if (f.lift && !v.liftAccess) return false;
  if (f.styles.some((s) => !v.styleTags.includes(s))) return false;
  if (f.cultures.some((c) => !v.cultureTags.includes(c))) return false;
  if (f.guests !== null) {
    const ranges = v.capacitySummary?.ranges ?? [];
    if (!ranges.some((r) => f.guests! >= r.min && f.guests! <= r.max)) return false;
  }
  return true;
}

export const activeFilterCount = (f: CatalogFilters) =>
  (f.guests !== null ? 1 : 0) + (f.wheelchair ? 1 : 0) + (f.lift ? 1 : 0) + f.styles.length + f.cultures.length;

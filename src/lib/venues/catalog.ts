import type { Venue } from "./model";

/** Written by the server (venueCapacitySummary trigger) whenever a space changes. */
export type { CapacitySummary } from "../../../functions/src/venues/summary";
import type { CapacitySummary } from "../../../functions/src/venues/summary";

export type CatalogVenue = Venue & { id: string; capacitySummary?: CapacitySummary | null };

export interface CatalogFilters {
  guests: number | null;
  wheelchair: boolean;
  lift: boolean;
  /** Phase 6 access fields, vendor-declared. */
  stepFree: boolean;
  toilet: boolean;
  parking: boolean;
  /** Dietary ids the venue's menus must cover (all of them). */
  menus: string[];
  styles: string[];
  cultures: string[];
}

export const NO_FILTERS: CatalogFilters = {
  guests: null,
  wheelchair: false,
  lift: false,
  stepFree: false,
  toilet: false,
  parking: false,
  menus: [],
  styles: [],
  cultures: [],
};

/** A venue matches when one of its rooms fits the guests and it has every chosen tag. */
export function matchesFilters(v: CatalogVenue, f: CatalogFilters): boolean {
  if (f.wheelchair && !v.wheelchairAccess) return false;
  if (f.lift && !v.liftAccess) return false;
  // Venues saved before Phase 6 have no access or menu fields: treat them as "not listed".
  if (f.stepFree && !v.stepFreeEntrance) return false;
  if (f.toilet && !v.accessibleToilet) return false;
  if (f.parking && !v.accessibleParking) return false;
  if (f.menus.some((m) => !(v.menuOptions ?? []).includes(m))) return false;
  if (f.styles.some((s) => !v.styleTags.includes(s))) return false;
  if (f.cultures.some((c) => !v.cultureTags.includes(c))) return false;
  if (f.guests !== null) {
    const ranges = v.capacitySummary?.ranges ?? [];
    if (!ranges.some((r) => f.guests! >= r.min && f.guests! <= r.max)) return false;
  }
  return true;
}

export const activeFilterCount = (f: CatalogFilters) =>
  (f.guests !== null ? 1 : 0) +
  (f.wheelchair ? 1 : 0) +
  (f.lift ? 1 : 0) +
  (f.stepFree ? 1 : 0) +
  (f.toilet ? 1 : 0) +
  (f.parking ? 1 : 0) +
  f.menus.length +
  f.styles.length +
  f.cultures.length;

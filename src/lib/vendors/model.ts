import type { TaxSettings } from "@/lib/venues/model";

export type VendorKind = "venue" | "decorator";

export const VENDOR_LIMITS = {
  businessNameMax: 120,
  descriptionMax: 2000,
  servedVenuesMax: 50,
} as const;

/**
 * vendors/{uid}: one business per vendor account. Tax settings live here
 * because GST registration belongs to the business, and they apply to all of
 * its venues, items and packages. Mirrors firestore.rules.
 */
export interface VendorProfile {
  kinds: VendorKind[];
  businessName: string;
  description: string;
  tax: TaxSettings;
  /** Decorators: work at any published venue... */
  servesAnyVenue: boolean;
  /** ...or only these venue ids. */
  servesVenueIds: string[];
  /** Couples can see the business's active items once published. */
  published: boolean;
}

export function validateBusinessProfile(p: Pick<VendorProfile, "kinds" | "businessName" | "description" | "servesAnyVenue" | "servesVenueIds">) {
  const e: Partial<Record<string, string>> = {};
  if (p.kinds.length === 0) e.kinds = "Choose at least one: venue or decorator.";
  const name = p.businessName.trim();
  if (!name) e.businessName = "Add your business name.";
  else if (name.length > VENDOR_LIMITS.businessNameMax) e.businessName = `Keep the name under ${VENDOR_LIMITS.businessNameMax} characters.`;
  if (p.description.length > VENDOR_LIMITS.descriptionMax) e.description = `Keep the description under ${VENDOR_LIMITS.descriptionMax} characters.`;
  if (p.servesVenueIds.length > VENDOR_LIMITS.servedVenuesMax) e.servesVenueIds = `Choose up to ${VENDOR_LIMITS.servedVenuesMax} venues.`;
  return e;
}

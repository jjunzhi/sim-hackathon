/**
 * Dietary and access vocabulary (Phase 6). Stored values are these ids;
 * display goes through the dictionaries (diet.* and access.* keys).
 * Everything here is the vendor's own statement; the UI says so.
 */
export const DIET_TAGS = ["halal", "vegetarian", "vegan", "no-beef", "no-pork"] as const;
export type DietTag = (typeof DIET_TAGS)[number];

export const DIET_KEYS = {
  halal: "diet.halal",
  vegetarian: "diet.vegetarian",
  vegan: "diet.vegan",
  "no-beef": "diet.noBeef",
  "no-pork": "diet.noPork",
} as const satisfies Record<DietTag, string>;

export const ACCESS_FIELDS = ["wheelchairAccess", "liftAccess", "stepFreeEntrance", "accessibleToilet", "accessibleParking"] as const;
export type AccessField = (typeof ACCESS_FIELDS)[number];

export const ACCESS_KEYS = {
  wheelchairAccess: "access.wheelchair",
  liftAccess: "access.lift",
  stepFreeEntrance: "access.stepFree",
  accessibleToilet: "access.toilet",
  accessibleParking: "access.parking",
} as const satisfies Record<AccessField, string>;

export const isDietTag = (v: unknown): v is DietTag => typeof v === "string" && (DIET_TAGS as readonly string[]).includes(v);

/** Public halal register, for anyone who wants to check a vendor's statement. */
export const MUIS_HALAL_SEARCH_URL = "https://halal.muis.gov.sg/halal/establishments";

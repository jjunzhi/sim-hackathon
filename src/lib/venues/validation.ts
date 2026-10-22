import { LIMITS, type Space, type Tier, type Venue } from "./model";

/** Field -> friendly message. Empty object means valid. */
export type Errors = Partial<Record<string, string>>;

const isWhole = (n: number) => Number.isSafeInteger(n);

export function validateVenueProfile(v: Pick<Venue, "name" | "address" | "postalCode" | "description" | "styleTags" | "cultureTags" | "menuOptions">): Errors {
  const e: Errors = {};
  const name = v.name.trim();
  if (!name) e.name = "Add the venue's name.";
  else if (name.length > LIMITS.nameMax) e.name = `Keep the name under ${LIMITS.nameMax} characters.`;
  if (v.address.length > LIMITS.addressMax) e.address = `Keep the address under ${LIMITS.addressMax} characters.`;
  if (v.postalCode && !/^\d{6}$/.test(v.postalCode)) e.postalCode = "Singapore postal codes have 6 digits.";
  if (v.description.length > LIMITS.descriptionMax)
    e.description = `Keep the description under ${LIMITS.descriptionMax} characters.`;
  if (v.styleTags.length > LIMITS.tagsMax || v.cultureTags.length > LIMITS.tagsMax)
    e.tags = `Choose up to ${LIMITS.tagsMax} tags.`;
  return e;
}

function validateTier(t: Tier, label: string, e: Errors, key: string) {
  if (!isWhole(t.roomRentalCents) || t.roomRentalCents < 0 || t.roomRentalCents > LIMITS.moneyMaxCents)
    e[`${key}.roomRentalCents`] = `Enter the ${label} room rental.`;
  if (
    t.minimumSpendCents !== null &&
    (!isWhole(t.minimumSpendCents) || t.minimumSpendCents < 0 || t.minimumSpendCents > LIMITS.moneyMaxCents)
  )
    e[`${key}.minimumSpendCents`] = `Enter a valid ${label} minimum spend, or leave it empty.`;
}

export function validateSpace(s: Pick<Space, "name" | "capacityMin" | "capacityMax" | "seatsPerTable" | "tiers">): Errors {
  const e: Errors = {};
  const name = s.name.trim();
  if (!name) e.name = "Name this space, for example \"Grand Ballroom\".";
  else if (name.length > LIMITS.nameMax) e.name = `Keep the name under ${LIMITS.nameMax} characters.`;

  const minOk = isWhole(s.capacityMin) && s.capacityMin >= LIMITS.capacityMin && s.capacityMin <= LIMITS.capacityMax;
  const maxOk = isWhole(s.capacityMax) && s.capacityMax >= LIMITS.capacityMin && s.capacityMax <= LIMITS.capacityMax;
  if (!minOk) e.capacityMin = `Enter a whole number from ${LIMITS.capacityMin} to ${LIMITS.capacityMax}.`;
  if (!maxOk) e.capacityMax = `Enter a whole number from ${LIMITS.capacityMin} to ${LIMITS.capacityMax}.`;
  if (minOk && maxOk && s.capacityMin > s.capacityMax)
    e.capacityMax = "The maximum must be at least the minimum.";

  if (!isWhole(s.seatsPerTable) || s.seatsPerTable < 1 || s.seatsPerTable > LIMITS.seatsPerTableMax)
    e.seatsPerTable = `Enter seats per table from 1 to ${LIMITS.seatsPerTableMax}.`;

  if ("peak" in s.tiers) {
    validateTier(s.tiers.peak, "Peak", e, "peak");
    validateTier(s.tiers.offPeak, "Off-Peak", e, "offPeak");
  } else {
    validateTier(s.tiers.standard, "", e, "standard");
  }
  return e;
}

export const hasErrors = (e: Errors) => Object.keys(e).length > 0;

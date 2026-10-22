import { describe, expect, it } from "vitest";
import { activeFilterCount, matchesFilters, NO_FILTERS, type CatalogVenue } from "./catalog";

const venue = (o: Partial<CatalogVenue> = {}): CatalogVenue => ({
  id: "v",
  ownerUid: "o",
  status: "active",
  verified: false,
  name: "SAMPLE",
  address: "",
  postalCode: "",
  description: "",
  styleTags: ["Garden"],
  cultureTags: ["Malay", "Chinese"],
  wheelchairAccess: true,
  liftAccess: false,
  stepFreeEntrance: true,
  accessibleToilet: false,
  accessibleParking: false,
  menuOptions: ["halal", "vegetarian"],
  coverPhoto: null,
  capacitySummary: {
    min: 30,
    max: 300,
    ranges: [
      { min: 30, max: 80 },
      { min: 200, max: 300 },
    ],
    spaceCount: 2,
    fromRentalCents: 300_000,
  },
  ...o,
});

describe("matchesFilters", () => {
  it("no filters matches everything", () => {
    expect(matchesFilters(venue(), NO_FILTERS)).toBe(true);
  });

  it("guests must fit one room, not just the overall range", () => {
    expect(matchesFilters(venue(), { ...NO_FILTERS, guests: 60 })).toBe(true);
    expect(matchesFilters(venue(), { ...NO_FILTERS, guests: 150 })).toBe(false);
    expect(matchesFilters(venue(), { ...NO_FILTERS, guests: 300 })).toBe(true);
    expect(matchesFilters(venue({ capacitySummary: null }), { ...NO_FILTERS, guests: 50 })).toBe(false);
  });

  it("access and every chosen tag must match", () => {
    expect(matchesFilters(venue(), { ...NO_FILTERS, wheelchair: true })).toBe(true);
    expect(matchesFilters(venue(), { ...NO_FILTERS, lift: true })).toBe(false);
    expect(matchesFilters(venue(), { ...NO_FILTERS, cultures: ["Malay", "Chinese"] })).toBe(true);
    expect(matchesFilters(venue(), { ...NO_FILTERS, cultures: ["Malay", "Indian"] })).toBe(false);
    expect(matchesFilters(venue(), { ...NO_FILTERS, styles: ["Rooftop"] })).toBe(false);
  });

  it("Phase 6 access fields and menus are vendor statements; missing fields count as not listed", () => {
    expect(matchesFilters(venue(), { ...NO_FILTERS, stepFree: true })).toBe(true);
    expect(matchesFilters(venue(), { ...NO_FILTERS, toilet: true })).toBe(false);
    expect(matchesFilters(venue(), { ...NO_FILTERS, menus: ["halal"] })).toBe(true);
    expect(matchesFilters(venue(), { ...NO_FILTERS, menus: ["halal", "vegan"] })).toBe(false);
    const legacy = venue({ stepFreeEntrance: undefined, menuOptions: undefined } as Partial<CatalogVenue>);
    expect(matchesFilters(legacy, { ...NO_FILTERS, stepFree: true })).toBe(false);
    expect(matchesFilters(legacy, { ...NO_FILTERS, menus: ["halal"] })).toBe(false);
    expect(matchesFilters(legacy, NO_FILTERS)).toBe(true);
  });

  it("counts active filters", () => {
    expect(activeFilterCount({ ...NO_FILTERS, guests: 100, lift: true, styles: ["Garden"] })).toBe(3);
    expect(activeFilterCount({ ...NO_FILTERS, stepFree: true, parking: true, menus: ["halal", "vegan"] })).toBe(4);
  });
});

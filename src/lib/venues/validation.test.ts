import { describe, expect, it } from "vitest";
import { hasErrors, validateSpace, validateVenueProfile } from "./validation";

const space = {
  name: "Grand Ballroom",
  capacityMin: 80,
  capacityMax: 250,
  seatsPerTable: 10,
  tiers: { standard: { roomRentalCents: 800_000, minimumSpendCents: null } },
};

describe("validateSpace", () => {
  it("accepts a valid single-price space", () => {
    expect(validateSpace(space)).toEqual({});
  });

  it("accepts Peak and Off-Peak tiers with their own minimum spend", () => {
    const e = validateSpace({
      ...space,
      tiers: {
        peak: { roomRentalCents: 1_200_000, minimumSpendCents: 5_000_000 },
        offPeak: { roomRentalCents: 600_000, minimumSpendCents: null },
      },
    });
    expect(hasErrors(e)).toBe(false);
  });

  it("allows min equal to max", () => {
    expect(validateSpace({ ...space, capacityMin: 100, capacityMax: 100 })).toEqual({});
  });

  it("rejects min above max", () => {
    expect(validateSpace({ ...space, capacityMin: 300, capacityMax: 200 }).capacityMax).toMatch(/at least the minimum/);
  });

  it("rejects zero, fractional and oversized capacities", () => {
    expect(validateSpace({ ...space, capacityMin: 0 }).capacityMin).toBeDefined();
    expect(validateSpace({ ...space, capacityMax: 99.5 }).capacityMax).toBeDefined();
    expect(validateSpace({ ...space, capacityMax: 5001 }).capacityMax).toBeDefined();
  });

  it("rejects fractional cents and negative prices", () => {
    const e = validateSpace({
      ...space,
      tiers: { peak: { roomRentalCents: 10.5, minimumSpendCents: -1 }, offPeak: { roomRentalCents: 0, minimumSpendCents: null } },
    });
    expect(e["peak.roomRentalCents"]).toBeDefined();
    expect(e["peak.minimumSpendCents"]).toBeDefined();
    expect(e["offPeak.roomRentalCents"]).toBeUndefined();
  });

  it("requires a name and sensible seats per table", () => {
    const e = validateSpace({ ...space, name: "  ", seatsPerTable: 0 });
    expect(e.name).toBeDefined();
    expect(e.seatsPerTable).toBeDefined();
  });
});

describe("validateVenueProfile", () => {
  const venue = { name: "SAMPLE Hall", address: "1 Example Road", postalCode: "", description: "", styleTags: [], cultureTags: [], menuOptions: [] };

  it("accepts a minimal venue", () => {
    expect(validateVenueProfile(venue)).toEqual({});
  });

  it("checks the postal code format", () => {
    expect(validateVenueProfile({ ...venue, postalCode: "12345" }).postalCode).toBeDefined();
    expect(validateVenueProfile({ ...venue, postalCode: "018956" })).toEqual({});
  });

  it("requires a name", () => {
    expect(validateVenueProfile({ ...venue, name: "" }).name).toBeDefined();
  });
});

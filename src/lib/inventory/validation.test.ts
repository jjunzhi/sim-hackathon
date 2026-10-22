import { describe, expect, it } from "vitest";
import { validateBusinessProfile } from "@/lib/vendors/model";
import { validateItem, validatePackage } from "./validation";

describe("validateItem", () => {
  const ok = { name: "SAMPLE Floral arch", priceCents: 120_000, description: "" };

  it("accepts a valid item, including a free one", () => {
    expect(validateItem(ok)).toEqual({});
    expect(validateItem({ ...ok, priceCents: 0 })).toEqual({});
  });

  it("rejects missing names and bad prices", () => {
    expect(validateItem({ ...ok, name: "  " }).name).toBeDefined();
    expect(validateItem({ ...ok, priceCents: Number.NaN }).priceCents).toBeDefined();
    expect(validateItem({ ...ok, priceCents: -1 }).priceCents).toBeDefined();
    expect(validateItem({ ...ok, priceCents: 10.5 }).priceCents).toBeDefined();
  });
});

describe("validatePackage", () => {
  const ok = { name: "SAMPLE Garden package", priceCents: 25_000, description: "", itemIds: ["a", "b"] };

  it("accepts a valid package", () => {
    expect(validatePackage(ok)).toEqual({});
  });

  it("needs at least one included item, and at most 30", () => {
    expect(validatePackage({ ...ok, itemIds: [] }).itemIds).toBeDefined();
    expect(validatePackage({ ...ok, itemIds: Array.from({ length: 31 }, (_, i) => `i${i}`) }).itemIds).toBeDefined();
  });
});

describe("validateBusinessProfile", () => {
  const ok = { kinds: ["decorator" as const], businessName: "SAMPLE Blooms", description: "", servesAnyVenue: true, servesVenueIds: [] };

  it("accepts a decorator", () => {
    expect(validateBusinessProfile(ok)).toEqual({});
  });

  it("needs a kind and a name", () => {
    expect(validateBusinessProfile({ ...ok, kinds: [] }).kinds).toBeDefined();
    expect(validateBusinessProfile({ ...ok, businessName: "" }).businessName).toBeDefined();
  });
});

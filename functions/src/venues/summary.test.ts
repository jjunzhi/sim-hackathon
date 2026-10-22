import { describe, expect, it } from "vitest";
import { summariseSpaces } from "./summary.js";

describe("summariseSpaces", () => {
  it("summarises ranges and the cheapest rental", () => {
    expect(
      summariseSpaces([
        { capacityMin: 80, capacityMax: 250, tiers: { peak: { roomRentalCents: 1_200_000 }, offPeak: { roomRentalCents: 650_000 } } },
        { capacityMin: 30, capacityMax: 60, tiers: { standard: { roomRentalCents: 300_000 } } },
      ]),
    ).toEqual({
      min: 30,
      max: 250,
      ranges: [
        { min: 80, max: 250 },
        { min: 30, max: 60 },
      ],
      spaceCount: 2,
      fromRentalCents: 300_000,
    });
  });

  it("no spaces: no summary", () => {
    expect(summariseSpaces([])).toBeNull();
  });
});

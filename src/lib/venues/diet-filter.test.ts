import { describe, expect, it } from "vitest";
import { matchesDiet } from "./diet-filter";

describe("matchesDiet", () => {
  const halal = { category: "Food and drink", dietaryTags: ["halal", "no-pork"] };
  const veg = { category: "Food and drink", dietaryTags: ["vegetarian", "no-beef", "no-pork"] };
  const untagged = { category: "Food and drink" };
  const arch = { category: "Florals", dietaryTags: [] };

  it("no filter shows everything", () => {
    for (const i of [halal, veg, untagged, arch]) expect(matchesDiet(i, [])).toBe(true);
  });

  it("food must carry every chosen tag; untagged food is hidden by any filter", () => {
    expect(matchesDiet(halal, ["halal"])).toBe(true);
    expect(matchesDiet(veg, ["halal"])).toBe(false);
    expect(matchesDiet(veg, ["no-pork", "no-beef"])).toBe(true);
    expect(matchesDiet(halal, ["no-pork", "no-beef"])).toBe(false);
    expect(matchesDiet(untagged, ["vegetarian"])).toBe(false);
  });

  it("decor is never hidden", () => {
    expect(matchesDiet(arch, ["halal", "vegan"])).toBe(true);
  });
});

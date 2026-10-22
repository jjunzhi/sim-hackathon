import { describe, expect, it } from "vitest";
import { checkCapacity, clampHeadcount, sliderRange, tablesLine } from "./capacity";

const room = { min: 80, max: 250 };

describe("checkCapacity", () => {
  it("is within capacity at both boundaries", () => {
    expect(checkCapacity(80, room).status).toBe("within");
    expect(checkCapacity(250, room).status).toBe("within");
    expect(checkCapacity(185, room)).toEqual({ status: "within", tables: 19, remaining: 65 });
  });

  it("warns above the maximum", () => {
    expect(checkCapacity(251, room)).toEqual({ status: "over", tables: 26, remaining: -1 });
  });

  it("warns below the minimum", () => {
    expect(checkCapacity(79, room).status).toBe("under");
  });

  it("rejects an invalid range", () => {
    expect(() => checkCapacity(100, { min: 300, max: 200 })).toThrow(RangeError);
  });
});

describe("sliderRange and clampHeadcount", () => {
  it("runs from half the minimum to 30% above the maximum", () => {
    expect(sliderRange({ min: 80, max: 250 })).toEqual({ min: 40, max: 325 });
    expect(sliderRange({ min: 1, max: 10 })).toEqual({ min: 1, max: 13 });
    expect(sliderRange({ min: 75, max: 101 })).toEqual({ min: 37, max: 132 });
  });

  it("keeps a headcount inside the new room's slider", () => {
    expect(clampHeadcount(500, { min: 80, max: 250 })).toBe(325);
    expect(clampHeadcount(5, { min: 80, max: 250 })).toBe(40);
    expect(clampHeadcount(185, { min: 80, max: 250 })).toBe(185);
  });
});

describe("tablesLine", () => {
  it("matches the spec example", () => {
    expect(tablesLine(185)).toBe("185 guests = 19 tables of 10");
  });

  it("uses singular words", () => {
    expect(tablesLine(1)).toBe("1 guest = 1 table of 10");
  });
});

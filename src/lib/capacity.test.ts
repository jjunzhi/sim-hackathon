import { describe, expect, it } from "vitest";
import { checkCapacity, tablesLine } from "./capacity";

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

describe("tablesLine", () => {
  it("matches the spec example", () => {
    expect(tablesLine(185)).toBe("185 guests = 19 tables of 10");
  });

  it("uses singular words", () => {
    expect(tablesLine(1)).toBe("1 guest = 1 table of 10");
  });
});

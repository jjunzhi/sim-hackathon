import { describe, expect, it } from "vitest";
import {
  MoneyError,
  applyBps,
  centsToInput,
  divideRoundHalfUp,
  formatBps,
  formatSGD,
  multiplyCents,
  parseDollarsToCents,
  perGuest,
  sumCents,
  tablesForHeadcount,
} from "./money";

describe("applyBps", () => {
  it("computes plain percentages", () => {
    expect(applyBps(10_000, 1000)).toBe(1000); // 10% of $100
    expect(applyBps(10_000, 900)).toBe(900); // 9% of $100
  });

  it("returns 0 at 0 bps and for a 0 amount", () => {
    expect(applyBps(123_456, 0)).toBe(0);
    expect(applyBps(0, 900)).toBe(0);
  });

  it("rounds exactly-half up", () => {
    // 5 cents x 10% = 0.5 cents -> 1
    expect(applyBps(5, 1000)).toBe(1);
    // 15 cents x 10% = 1.5 -> 2
    expect(applyBps(15, 1000)).toBe(2);
    // 50 cents x 9% = 4.5 -> 5
    expect(applyBps(50, 900)).toBe(5);
  });

  it("rounds just-below-half down", () => {
    // 4 cents x 10% = 0.4 -> 0
    expect(applyBps(4, 1000)).toBe(0);
    // 49 cents x 9% = 4.41 -> 4
    expect(applyBps(49, 900)).toBe(4);
  });

  it("rounds negatives half away from zero (refunds and credits)", () => {
    expect(applyBps(-5, 1000)).toBe(-1);
    expect(applyBps(-4, 1000)).toBe(0);
  });

  it("handles 100%", () => {
    expect(applyBps(98_765, 10_000)).toBe(98_765);
  });

  it("stays exact for large totals where amount x bps exceeds 2^53", () => {
    // $9 trillion in cents x 9% would overflow plain float multiplication precision
    const big = 900_000_000_000_000; // 9e14 cents
    expect(applyBps(big, 900)).toBe(81_000_000_000_000);
    expect(applyBps(900_000_000_000_005, 1000)).toBe(90_000_000_000_001); // .5 -> up
  });

  it("rejects fractional cents and bad rates", () => {
    expect(() => applyBps(10.5, 900)).toThrow(MoneyError);
    expect(() => applyBps(100, 9.5)).toThrow(MoneyError);
    expect(() => applyBps(100, -1)).toThrow(MoneyError);
    expect(() => applyBps(100, 10_001)).toThrow(MoneyError);
    expect(() => applyBps(Number.NaN, 900)).toThrow(MoneyError);
  });
});

describe("chained service charge then GST (spec order)", () => {
  it("rounds at each step", () => {
    const subtotal = 1_234_567; // $12,345.67
    const service = applyBps(subtotal, 1000); // 123,456.7 -> 123,457
    expect(service).toBe(123_457);
    const gst = applyBps(subtotal + service, 900); // 1,358,024 x 9% = 122,222.16 -> 122,222
    expect(gst).toBe(122_222);
    expect(subtotal + service + gst).toBe(1_480_246);
  });
});

describe("divideRoundHalfUp and perGuest", () => {
  it("rounds per-guest half up", () => {
    expect(divideRoundHalfUp(1000, 3)).toBe(333); // 333.33
    expect(divideRoundHalfUp(1001, 2)).toBe(501); // 500.5
    expect(divideRoundHalfUp(1000, 6)).toBe(167); // 166.67
  });

  it("returns null per-guest for zero guests", () => {
    expect(perGuest(100_000, 0)).toBeNull();
    expect(perGuest(1_480_246, 185)).toBe(8001); // 8001.33
  });

  it("rejects a zero denominator and bad headcounts", () => {
    expect(() => divideRoundHalfUp(100, 0)).toThrow(MoneyError);
    expect(() => perGuest(100, -1)).toThrow(MoneyError);
    expect(() => perGuest(100, 1.5)).toThrow(MoneyError);
  });
});

describe("multiplyCents and sumCents", () => {
  it("multiplies by integer quantities", () => {
    expect(multiplyCents(8_800, 19)).toBe(167_200);
    expect(multiplyCents(8_800, 0)).toBe(0);
  });

  it("rejects fractional or negative quantities", () => {
    expect(() => multiplyCents(100, 1.5)).toThrow(MoneyError);
    expect(() => multiplyCents(100, -1)).toThrow(MoneyError);
  });

  it("sums, including an empty list", () => {
    expect(sumCents([])).toBe(0);
    expect(sumCents([1, 2, 3])).toBe(6);
  });

  it("throws instead of losing precision", () => {
    expect(() => multiplyCents(Number.MAX_SAFE_INTEGER, 2)).toThrow(MoneyError);
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow(MoneyError);
  });
});

describe("tablesForHeadcount", () => {
  it.each([
    [0, 0],
    [1, 1],
    [9, 1],
    [10, 1],
    [11, 2],
    [185, 19],
    [200, 20],
  ])("%i guests -> %i tables of 10", (guests, tables) => {
    expect(tablesForHeadcount(guests)).toBe(tables);
  });

  it("supports other table sizes", () => {
    expect(tablesForHeadcount(185, 12)).toBe(16);
  });

  it("rejects invalid input", () => {
    expect(() => tablesForHeadcount(-1)).toThrow(MoneyError);
    expect(() => tablesForHeadcount(10.5)).toThrow(MoneyError);
    expect(() => tablesForHeadcount(10, 0)).toThrow(MoneyError);
  });
});

describe("parseDollarsToCents", () => {
  it.each([
    ["0", 0],
    ["80", 8000],
    ["$80", 8000],
    ["S$1,234.5", 123_450],
    ["0.05", 5],
    ["12.", 1200],
    [" 7.99 ", 799],
  ])("%s -> %i", (input, cents) => {
    expect(parseDollarsToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "-5", "1.234", "1e3", "1.2.3"])("rejects %s", (input) => {
    expect(parseDollarsToCents(input)).toBeNull();
  });
});

describe("centsToInput", () => {
  it("round-trips with parseDollarsToCents", () => {
    for (const c of [0, 5, 99, 100, 800_000, 123_456_789]) {
      expect(parseDollarsToCents(centsToInput(c))).toBe(c);
    }
  });

  it("is empty for no value", () => {
    expect(centsToInput(null)).toBe("");
    expect(centsToInput(5)).toBe("0.05");
  });
});

describe("formatting (UI only)", () => {
  it("formats SGD", () => {
    expect(formatSGD(123_456)).toBe("$1,234.56");
    expect(formatSGD(0)).toBe("$0.00");
    expect(formatSGD(123_450, { showCents: false })).toBe("$1,235");
  });

  it("formats basis points", () => {
    expect(formatBps(900)).toBe("9%");
    expect(formatBps(1000)).toBe("10%");
    expect(formatBps(825)).toBe("8.25%");
    expect(formatBps(850)).toBe("8.5%");
    expect(formatBps(0)).toBe("0%");
  });
});

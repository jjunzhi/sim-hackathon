import { describe, expect, it } from "vitest";
import { calculateEstimate, EstimateError, minimumSpendBasis, type EstimateInput, type EstimateSelection } from "./engine";

// Figures match docs/estimate-examples.md, worked by hand.
const arch: EstimateSelection = { id: "arch", name: "Floral arch", kind: "item", unit: "piece", priceCents: 120_000, category: "Florals" };
const centrepiece: EstimateSelection = { id: "cp", name: "Table centrepiece", kind: "item", unit: "table", priceCents: 8_800, category: "Table decor" };
const sash: EstimateSelection = { id: "sash", name: "Chair sash", kind: "item", unit: "guest", priceCents: 350, category: "Draping" };

const standardTax = { serviceChargeBps: 1000, gstBps: 900, noServiceChargeNote: "No service charge", noGstNote: "Prices not subject to GST" };
const noTax = { ...standardTax, serviceChargeBps: 0, gstBps: 0 };

const exampleA: EstimateInput = {
  headcount: 185,
  rental: { label: "Room rental (Peak)", amountCents: 1_200_000 },
  minimumSpendCents: null,
  selections: [arch, centrepiece, sash],
  tax: standardTax,
};

describe("A. Peak, 185 guests, standard taxes", () => {
  const e = calculateEstimate(exampleA);

  it("prices each unit type correctly", () => {
    expect(e.tables).toBe(19);
    expect(e.lines.map((l) => [l.label, l.amountCents])).toEqual([
      ["Room rental (Peak)", 1_200_000],
      ["Floral arch", 120_000],
      ["Table centrepiece", 167_200],
      ["Chair sash", 64_750],
    ]);
    expect(e.lines.filter((l) => l.kind !== "rental").map((l) => ("count" in l ? l.count : 0))).toEqual([1, 19, 185]);
  });

  it("matches the hand calculation", () => {
    expect(e.subtotalCents).toBe(1_551_950);
    expect(e.minimumSpendShortfall).toBeNull();
    expect(e.serviceCharge).toEqual({ rateBps: 1000, amountCents: 155_195 });
    expect(e.gst).toEqual({ rateBps: 900, amountCents: 153_643 });
    expect(e.totalCents).toBe(1_860_788);
    expect(e.perGuestCents).toBe(10_058);
    expect(e.notes).toEqual([]);
  });
});

describe("B. Minimum spend shortfall", () => {
  const e = calculateEstimate({ ...exampleA, minimumSpendCents: 4_500_050 });

  it("shows the shortfall as its own line instead of raising the subtotal", () => {
    expect(e.subtotalCents).toBe(1_551_950);
    expect(e.minimumSpendShortfall).toEqual({ minimumCents: 4_500_050, basisCents: 1_551_950, shortfallCents: 2_948_100 });
    expect(e.chargeableCents).toBe(4_500_050);
  });

  it("applies service charge and GST to the minimum", () => {
    expect(e.serviceCharge?.amountCents).toBe(450_005);
    expect(e.gst?.amountCents).toBe(445_505);
    expect(e.totalCents).toBe(5_395_560);
    expect(e.perGuestCents).toBe(29_165);
  });
});

describe("C. Off-Peak tier", () => {
  it("uses the Off-Peak rental", () => {
    const e = calculateEstimate({ ...exampleA, rental: { label: "Room rental (Off-Peak)", amountCents: 650_000 } });
    expect(e.subtotalCents).toBe(1_001_950);
    expect(e.serviceCharge?.amountCents).toBe(100_195);
    expect(e.gst?.amountCents).toBe(99_193);
    expect(e.totalCents).toBe(1_201_338);
    expect(e.perGuestCents).toBe(6_494);
  });
});

describe("D. No service charge and not GST-registered", () => {
  const e = calculateEstimate({
    headcount: 11,
    rental: { label: "Room rental", amountCents: 650_000 },
    selections: [{ ...arch, quantity: 3 }, centrepiece, sash],
    tax: noTax,
  });

  it("hides both lines and shows the vendor's notes", () => {
    expect(e.tables).toBe(2);
    expect(e.subtotalCents).toBe(1_031_450);
    expect(e.serviceCharge).toBeNull();
    expect(e.gst).toBeNull();
    expect(e.notes).toEqual(["No service charge", "Prices not subject to GST"]);
    expect(e.totalCents).toBe(1_031_450);
    expect(e.perGuestCents).toBe(93_768);
  });

  it("omits empty notes", () => {
    const quiet = calculateEstimate({ headcount: 1, selections: [arch], tax: { ...noTax, noServiceChargeNote: "  ", noGstNote: "" } });
    expect(quiet.notes).toEqual([]);
  });
});

describe("E. Half-cent rounding at each step", () => {
  const item = (price: number): EstimateSelection => ({ id: "x", name: "X", kind: "item", unit: "piece", priceCents: price });

  it("rounds service charge up from .5, then GST separately", () => {
    const e = calculateEstimate({ headcount: 1, selections: [item(5)], tax: standardTax });
    expect(e.serviceCharge?.amountCents).toBe(1); // 0.5 -> 1
    expect(e.gst?.amountCents).toBe(1); // 0.54 -> 1
    expect(e.totalCents).toBe(7);
  });

  it("rounds per guest half-up", () => {
    const e = calculateEstimate({ headcount: 4, selections: [item(1005)], tax: standardTax });
    expect(e.serviceCharge?.amountCents).toBe(101); // 100.5
    expect(e.gst?.amountCents).toBe(100); // 99.54
    expect(e.totalCents).toBe(1206);
    expect(e.perGuestCents).toBe(302); // 301.5
  });
});

describe("F and G. Minimum spend boundaries", () => {
  it("F: exactly meeting the minimum shows no shortfall", () => {
    const e = calculateEstimate({
      headcount: 100,
      rental: { label: "Rental", amountCents: 1_000_000 },
      minimumSpendCents: 1_000_000,
      selections: [],
      tax: standardTax,
    });
    expect(e.minimumSpendShortfall).toBeNull();
    expect(e.totalCents).toBe(1_199_000);
    expect(e.perGuestCents).toBe(11_990);
  });

  it("G: shortfall with no service charge but GST", () => {
    const e = calculateEstimate({
      headcount: 50,
      rental: { label: "Rental", amountCents: 500_000 },
      minimumSpendCents: 800_000,
      selections: [{ id: "f", name: "Canapés", kind: "item", unit: "guest", priceCents: 2_000, category: "Food and drink" }],
      tax: { ...standardTax, serviceChargeBps: 0 },
    });
    expect(e.subtotalCents).toBe(600_000);
    expect(e.minimumSpendShortfall?.shortfallCents).toBe(200_000);
    expect(e.serviceCharge).toBeNull();
    expect(e.notes).toEqual(["No service charge"]);
    expect(e.gst?.amountCents).toBe(72_000);
    expect(e.totalCents).toBe(872_000);
    expect(e.perGuestCents).toBe(17_440);
  });

  it("above the minimum shows no shortfall", () => {
    const e = calculateEstimate({ ...exampleA, minimumSpendCents: 1_000_000 });
    expect(e.minimumSpendShortfall).toBeNull();
    expect(e.totalCents).toBe(1_860_788);
  });

  it("a minimum of 0 never creates a shortfall", () => {
    expect(calculateEstimate({ ...exampleA, minimumSpendCents: 0 }).minimumSpendShortfall).toBeNull();
  });

  it("the basis is all pre-tax lines (single place to change)", () => {
    const e = calculateEstimate(exampleA);
    expect(minimumSpendBasis(e.lines)).toBe(e.subtotalCents);
  });
});

describe("I. Decorator only", () => {
  it("matches the hand calculation", () => {
    const e = calculateEstimate({ headcount: 185, selections: [arch, centrepiece, sash], tax: standardTax });
    expect(e.subtotalCents).toBe(351_950);
    expect(e.serviceCharge?.amountCents).toBe(35_195);
    expect(e.gst?.amountCents).toBe(34_843);
    expect(e.totalCents).toBe(421_988);
    expect(e.perGuestCents).toBe(2_281);
  });

  it("with the package instead of the centrepiece", () => {
    const pkg: EstimateSelection = { id: "p1", name: "Garden package", kind: "package", unit: "table", priceCents: 25_000, includesItemIds: ["cp"] };
    const e = calculateEstimate({ headcount: 185, selections: [arch, pkg, sash], tax: standardTax });
    expect(e.subtotalCents).toBe(659_750);
    expect(e.serviceCharge?.amountCents).toBe(65_975);
    expect(e.gst?.amountCents).toBe(65_315);
    expect(e.totalCents).toBe(791_040);
    expect(e.perGuestCents).toBe(4_276);
  });
});

describe("H. Edge cases", () => {
  it("0 guests: per-table and per-guest are 0 and there is no per-guest price", () => {
    const e = calculateEstimate({ ...exampleA, headcount: 0 });
    expect(e.tables).toBe(0);
    expect(e.lines.find((l) => l.label === "Table centrepiece")?.amountCents).toBe(0);
    expect(e.lines.find((l) => l.label === "Chair sash")?.amountCents).toBe(0);
    expect(e.perGuestCents).toBeNull();
  });

  it("uses the space's seats per table", () => {
    const e = calculateEstimate({ ...exampleA, seatsPerTable: 12 });
    expect(e.tables).toBe(16);
    expect(e.lines.find((l) => l.label === "Table centrepiece")?.amountCents).toBe(8_800 * 16);
  });

  it("a package is one line priced by its own unit", () => {
    const pkg: EstimateSelection = { id: "p1", name: "Garden package", kind: "package", unit: "table", priceCents: 25_000, includesItemIds: ["cp"] };
    const e = calculateEstimate({ headcount: 185, selections: [pkg, sash], tax: noTax });
    expect(e.lines[0]).toMatchObject({ kind: "package", count: 19, amountCents: 475_000 });
    expect(e.subtotalCents).toBe(475_000 + 64_750);
  });

  it("refuses a package together with an item it already includes", () => {
    const pkg: EstimateSelection = { id: "p1", name: "Garden package", kind: "package", unit: "table", priceCents: 25_000, includesItemIds: ["cp"] };
    expect(() => calculateEstimate({ headcount: 10, selections: [pkg, centrepiece], tax: noTax })).toThrow(EstimateError);
  });

  it("refuses duplicates, bad quantities and bad inputs", () => {
    expect(() => calculateEstimate({ headcount: 10, selections: [arch, arch], tax: noTax })).toThrow(EstimateError);
    expect(() => calculateEstimate({ headcount: 10, selections: [{ ...arch, quantity: 0 }], tax: noTax })).toThrow(EstimateError);
    expect(() => calculateEstimate({ headcount: 10, selections: [{ ...arch, quantity: 1.5 }], tax: noTax })).toThrow(EstimateError);
    expect(() => calculateEstimate({ headcount: -1, selections: [], tax: noTax })).toThrow(EstimateError);
    expect(() => calculateEstimate({ headcount: 10, selections: [{ ...arch, priceCents: 10.5 }], tax: noTax })).toThrow();
    expect(() => calculateEstimate({ headcount: 10, selections: [], tax: { ...noTax, gstBps: 850.5 } })).toThrow();
  });

  it("an empty decorator estimate is zero", () => {
    const e = calculateEstimate({ headcount: 100, selections: [], tax: standardTax });
    expect(e.totalCents).toBe(0);
    expect(e.perGuestCents).toBe(0);
  });
});

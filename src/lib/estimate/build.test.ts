import { describe, expect, it } from "vitest";
import type { InventoryItem, InventoryPackage } from "@/lib/inventory/model";
import { buildEstimateInput, tierKeys } from "./build";
import { calculateEstimate } from "./engine";

const tax = { serviceChargeBps: 1000, gstBps: 900, noServiceChargeNote: "", noGstNote: "" };
const space = {
  name: "SAMPLE Ballroom",
  seatsPerTable: 10,
  tiers: {
    peak: { roomRentalCents: 1_200_000, minimumSpendCents: 4_500_050 },
    offPeak: { roomRentalCents: 650_000, minimumSpendCents: null },
  },
};
const item = (id: string, unit: InventoryItem["unit"], priceCents: number) =>
  ({ id, name: id, category: "Florals", unit, priceCents, description: "", photo: null, active: true }) as InventoryItem & { id: string };
const items = [item("arch", "piece", 120_000), item("cp", "table", 8_800), item("sash", "guest", 350)];
const pkg = { id: "p", name: "Pkg", unit: "table", priceCents: 25_000, description: "", itemIds: ["cp"], photo: null, active: true } as InventoryPackage & { id: string };

describe("buildEstimateInput", () => {
  it("lists tiers in order", () => {
    expect(tierKeys(space)).toEqual(["peak", "offPeak"]);
    expect(tierKeys({ tiers: { standard: { roomRentalCents: 1, minimumSpendCents: null } } })).toEqual(["standard"]);
  });

  it("reproduces worked example B from the chosen tier", () => {
    const input = buildEstimateInput({
      headcount: 185,
      space,
      tierKey: "peak",
      items,
      packages: [],
      chosen: { "item:arch": 1, "item:cp": 1, "item:sash": 1 },
      tax,
    });
    expect(input.rental).toEqual({ label: "Room rental: SAMPLE Ballroom (Peak)", amountCents: 1_200_000 });
    expect(input.minimumSpendCents).toBe(4_500_050);
    expect(calculateEstimate(input).totalCents).toBe(5_395_560);
  });

  it("Off-Peak has no minimum spend here", () => {
    const input = buildEstimateInput({ headcount: 185, space, tierKey: "offPeak", items, packages: [], chosen: {}, tax });
    expect(input.minimumSpendCents).toBeNull();
    expect(input.rental?.amountCents).toBe(650_000);
  });

  it("decor only: no rental and no minimum", () => {
    const input = buildEstimateInput({ headcount: 50, space: null, tierKey: null, items, packages: [pkg], chosen: { "package:p": 1, "item:sash": 1 }, tax });
    expect(input.rental).toBeNull();
    expect(input.minimumSpendCents).toBeNull();
    expect(input.selections.map((s) => s.id)).toEqual(["sash", "p"]);
  });

  it("quantity applies to per-piece selections only", () => {
    const input = buildEstimateInput({ headcount: 50, space: null, tierKey: null, items, packages: [], chosen: { "item:arch": 3, "item:cp": 5 }, tax });
    expect(input.selections.find((s) => s.id === "arch")?.quantity).toBe(3);
    expect(input.selections.find((s) => s.id === "cp")?.quantity).toBeUndefined();
  });
});

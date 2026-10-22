import { describe, expect, it } from "vitest";
import type { InventoryItem, InventoryPackage } from "@/lib/inventory/model";
import { buildPlanEstimates, type VendorCatalog } from "./estimates";
import { parseSelectionKey, selectionKey } from "./model";

const tax = { serviceChargeBps: 1000, gstBps: 900, noServiceChargeNote: "", noGstNote: "" };
const item = (id: string, unit: InventoryItem["unit"], priceCents: number, active = true) =>
  ({ id, name: id, category: "Florals", unit, priceCents, description: "", photo: null, active }) as InventoryItem & { id: string };
const space = {
  name: "Ballroom",
  seatsPerTable: 10,
  tiers: { peak: { roomRentalCents: 1_200_000, minimumSpendCents: 4_500_050 }, offPeak: { roomRentalCents: 650_000, minimumSpendCents: null } },
};

const venue: VendorCatalog = { uid: "venue", profile: { businessName: "SAMPLE Venue", tax }, items: [item("arch", "piece", 120_000), item("cp", "table", 8_800), item("sash", "guest", 350)], packages: [] };
const deco: VendorCatalog = {
  uid: "deco",
  profile: { businessName: "SAMPLE Deco", tax: { ...tax, serviceChargeBps: 0, gstBps: 0 } },
  items: [item("lanterns", "table", 4_500), item("gone", "piece", 1, false)],
  packages: [{ id: "pk", name: "Pk", unit: "table", priceCents: 10_000, description: "", itemIds: ["lanterns"], photo: null, active: true } as InventoryPackage & { id: string }],
};

describe("selection keys", () => {
  it("round-trip and reject malformed keys", () => {
    expect(parseSelectionKey(selectionKey("item", "u1", "i1"))).toEqual({ kind: "item", vendorUid: "u1", id: "i1" });
    expect(parseSelectionKey("item:u1")).toBeNull();
    expect(parseSelectionKey("thing:u1:i1")).toBeNull();
    expect(parseSelectionKey("item:u1:i1:x")).toBeNull();
  });
});

describe("buildPlanEstimates", () => {
  it("venue only reproduces worked example B (Peak, minimum spend)", () => {
    const r = buildPlanEstimates({
      plan: { headcount: 185, tierKey: "peak", selections: { "item:venue:arch": 1, "item:venue:cp": 1, "item:venue:sash": 1 } },
      venueOwnerUid: "venue",
      space,
      catalogs: [venue, deco],
    });
    expect(r.vendors).toHaveLength(1);
    expect(r.vendors[0]!.estimate.totalCents).toBe(5_395_560);
    expect(r.combinedTotalCents).toBe(5_395_560);
  });

  it("adds a decorator's own estimate with its own tax, and sums the totals", () => {
    const r = buildPlanEstimates({
      plan: { headcount: 185, tierKey: "offPeak", selections: { "item:venue:arch": 1, "item:deco:lanterns": 1 } },
      venueOwnerUid: "venue",
      space,
      catalogs: [venue, deco],
    });
    expect(r.vendors.map((v) => v.vendorName)).toEqual(["SAMPLE Venue", "SAMPLE Deco"]);
    // Venue: 650,000 + 120,000 = 770,000; +10% = 77,000; GST 9% of 847,000 = 76,230; total 923,230.
    expect(r.vendors[0]!.estimate.totalCents).toBe(923_230);
    // Decorator, no service charge or GST: 4,500 x 19 tables = 85,500.
    expect(r.vendors[1]!.estimate.totalCents).toBe(85_500);
    expect(r.vendors[1]!.estimate.lines.some((l) => l.kind === "rental")).toBe(false);
    expect(r.combinedTotalCents).toBe(1_008_730);
    // 1,008,730 / 185 = 5,452.59 -> 5,453
    expect(r.combinedPerGuestCents).toBe(5_453);
  });

  it("drops selections that are hidden, removed or from unknown vendors, and says so", () => {
    const r = buildPlanEstimates({
      plan: { headcount: 100, tierKey: "offPeak", selections: { "item:deco:gone": 1, "item:deco:nope": 1, "item:stranger:x": 1, "bad-key": 1 } },
      venueOwnerUid: "venue",
      space,
      catalogs: [venue, deco],
    });
    expect(r.unavailable.sort()).toEqual(["bad-key", "item:deco:gone", "item:deco:nope", "item:stranger:x"]);
    expect(r.vendors).toHaveLength(1);
  });

  it("reports an unpriceable selection instead of crashing", () => {
    const r = buildPlanEstimates({
      plan: { headcount: 100, tierKey: "offPeak", selections: { "package:deco:pk": 1, "item:deco:lanterns": 1 } },
      venueOwnerUid: "venue",
      space,
      catalogs: [venue, deco],
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.vendorName).toBe("SAMPLE Deco");
  });

  it("no guests: no per-guest price", () => {
    const r = buildPlanEstimates({ plan: { headcount: 0, tierKey: "offPeak", selections: {} }, venueOwnerUid: "venue", space, catalogs: [venue] });
    expect(r.combinedPerGuestCents).toBeNull();
  });
});

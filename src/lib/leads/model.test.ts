import { describe, expect, it } from "vitest";
import { isExpired, planChangedSince, selectionsForVendor, sgDateInput, validUntilFrom } from "./model";

describe("selectionsForVendor", () => {
  it("keeps only that vendor's items and packages", () => {
    const sel = { "item:venue:arch": 1, "package:venue:p": 1, "item:deco:lanterns": 2, junk: 1 };
    expect(selectionsForVendor(sel, "venue")).toEqual({ "item:venue:arch": 1, "package:venue:p": 1 });
    expect(selectionsForVendor(sel, "deco")).toEqual({ "item:deco:lanterns": 2 });
  });
});

describe("validity", () => {
  it("defaults to the end of the 14th day in Singapore", () => {
    // 22 Oct 2026, 15:00 SGT
    const v = validUntilFrom(new Date("2026-10-22T07:00:00Z"), 14);
    expect(v.toISOString()).toBe("2026-11-05T15:59:59.999Z"); // 5 Nov 23:59:59.999 SGT
    expect(sgDateInput(v)).toBe("2026-11-05");
  });

  it("uses the Singapore date even late at night UTC", () => {
    // 22 Oct 2026, 23:30 UTC is already 23 Oct in Singapore
    expect(sgDateInput(validUntilFrom(new Date("2026-10-22T23:30:00Z"), 1))).toBe("2026-10-24");
  });

  it("expires after the last moment of the day", () => {
    const v = validUntilFrom(new Date("2026-10-22T07:00:00Z"), 14).getTime();
    expect(isExpired(v, new Date("2026-11-05T15:59:59.000Z"))).toBe(false);
    expect(isExpired(v, new Date("2026-11-05T16:00:00.000Z"))).toBe(true);
  });
});

describe("planChangedSince", () => {
  const lead = { headcount: 185, tierKey: "peak" as const, spaceId: "s1", selections: { "item:venue:arch": 1 } };
  const plan = { ...lead, selections: { "item:venue:arch": 1, "item:deco:lanterns": 1 } };

  it("ignores other vendors' changes", () => {
    expect(planChangedSince(lead, plan, "venue", true)).toBe(false);
  });

  it("notices guests, quantity, tier or room changes", () => {
    expect(planChangedSince(lead, { ...plan, headcount: 200 }, "venue", true)).toBe(true);
    expect(planChangedSince(lead, { ...plan, selections: { "item:venue:arch": 2 } }, "venue", true)).toBe(true);
    expect(planChangedSince(lead, { ...plan, tierKey: "offPeak" }, "venue", true)).toBe(true);
    expect(planChangedSince(lead, { ...plan, tierKey: "offPeak" }, "deco", false)).toBe(true); // selections differ for deco
  });
});

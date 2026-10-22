import { describe, expect, it } from "vitest";
import { demoReply } from "./demo.js";
import { venueDataBlock, systemInstruction } from "./prompt.js";
import { applyChanges, validateProposal, type PlanSnapshot, type VenueContext } from "./proposal.js";
import { parseAssistantRequest, resolveAssistantLimits } from "./assistant.js";

const ctx: VenueContext = {
  venueId: "v",
  venueName: "SAMPLE Garden Pavilion",
  spaces: [
    { id: "glass", name: "SAMPLE Glasshouse Ballroom", capacityMin: 80, capacityMax: 250, seatsPerTable: 10, tiers: { peak: { roomRentalCents: 1_200_000, minimumSpendCents: 4_500_050 }, offPeak: { roomRentalCents: 650_000, minimumSpendCents: null } } },
    { id: "terrace", name: "SAMPLE Orchid Terrace", capacityMin: 30, capacityMax: 80, seatsPerTable: 10, tiers: { standard: { roomRentalCents: 300_000, minimumSpendCents: null } } },
  ],
  options: [
    { key: "item:o:arch", vendorName: "SAMPLE Co", name: "SAMPLE Floral arch", category: "Florals", unit: "piece", priceCents: 120_000, dietaryTags: [], includes: [] },
    { key: "item:o:halal", vendorName: "SAMPLE Co", name: "SAMPLE Halal banquet menu", category: "Food and drink", unit: "guest", priceCents: 16_800, dietaryTags: ["halal"], includes: [] },
    { key: "item:d:lanterns", vendorName: "SAMPLE Deco", name: "SAMPLE Lantern set", category: "Lighting", unit: "table", priceCents: 4_500, dietaryTags: [], includes: [] },
    { key: "package:d:garden", vendorName: "SAMPLE Deco", name: "SAMPLE Garden romance (package)", category: "Package", unit: "table", priceCents: 12_000, dietaryTags: [], includes: ["item:d:lanterns"] },
  ],
};
const plan: PlanSnapshot = { headcount: 185, spaceId: "glass", tierKey: "peak", themeId: "peranakan", weddingDate: null, selections: { "item:o:arch": 1, "item:d:lanterns": 1 } };

describe("validateProposal", () => {
  it("keeps only real rooms, tiers, themes and choices", () => {
    const p = validateProposal(
      {
        summary: "Move to the terrace with a smaller list.",
        headcount: 70,
        spaceId: "terrace",
        tierKey: "peak",
        themeId: "modern-botanical",
        weddingDate: "2027-05-22",
        add: [{ ref: "item:o:halal" }, { ref: "item:x:invented" }],
        remove: ["item:o:arch", "item:o:not-chosen"],
      },
      ctx,
      plan,
    );
    expect(p.summary).toBe("Move to the terrace with a smaller list.");
    expect(p.changes).toEqual([
      // Peak isn't offered on the terrace, so its only tier is used.
      { kind: "space", spaceId: "terrace", tierKey: "standard" },
      { kind: "headcount", value: 70 },
      { kind: "theme", themeId: "modern-botanical" },
      { kind: "date", value: "2027-05-22" },
      { kind: "remove", key: "item:o:arch" },
      { kind: "add", key: "item:o:halal", quantity: 1 },
    ]);
    expect(p.dropped).toEqual(["remove item:o:not-chosen", "add item:x:invented"]);
  });

  it("drops impossible values instead of fixing them", () => {
    const p = validateProposal({ summary: "x", headcount: -5, tierKey: "standard", themeId: "space-opera", weddingDate: "2027-02-30", spaceId: "ballroom-9" }, ctx, plan);
    expect(p.changes).toEqual([]);
    expect(p.dropped.length).toBe(4);
  });

  it("per-piece items keep a quantity; per-table and per-guest are always 1", () => {
    const p = validateProposal({ summary: "x", add: [{ ref: "item:o:arch", quantity: 3 }, { ref: "item:o:halal", quantity: 50 }] }, ctx, plan);
    expect(p.changes).toEqual([
      { kind: "add", key: "item:o:arch", quantity: 3 },
      { kind: "add", key: "item:o:halal", quantity: 1 },
    ]);
  });

  it("nothing to change gives no changes", () => {
    expect(validateProposal({ summary: "Looks good.", headcount: 185, themeId: "peranakan" }, ctx, plan).changes).toEqual([]);
  });
});

describe("applyChanges", () => {
  it("applies like the Studio: a package replaces the items it includes", () => {
    const next = applyChanges(plan, [{ kind: "add", key: "package:d:garden", quantity: 1 }, { kind: "headcount", value: 120 }], ctx);
    expect(next.selections).toEqual({ "item:o:arch": 1, "package:d:garden": 1 });
    expect(next.headcount).toBe(120);
    expect(plan.headcount).toBe(185); // the original is untouched
  });
});

describe("prompt", () => {
  it("fences vendor text as data and lists exact keys and prices", () => {
    const block = venueDataBlock(ctx, plan, 5_481_060);
    expect(block).toContain("<VENUE DATA>");
    expect(block).toContain("item:o:halal | SAMPLE Co | SAMPLE Halal banquet menu | Food and drink | S$168.00 per guest | halal");
    expect(block).toContain("glass | SAMPLE Glasshouse Ballroom | 80-250 | 10 | peak: rental S$12000.00, minimum spend S$45000.50; offPeak: rental S$6500.00");
    expect(block).toContain("Current estimated total across vendors: S$54810.60");
    expect(systemInstruction("ta")).toContain("Tamil");
    expect(systemInstruction("xx")).toContain("English");
  });
});

describe("demo mode", () => {
  it("understands guests, theme names and add/remove by item name", () => {
    const r = demoReply("Let's do 150 guests, Modern Botanical, add the floral arch and remove the lantern set", ctx, plan);
    expect(r.text.startsWith("DEMO")).toBe(true);
    const p = validateProposal(r.args, ctx, plan);
    expect(p.changes).toEqual(expect.arrayContaining([{ kind: "headcount", value: 150 }, { kind: "theme", themeId: "modern-botanical" }, { kind: "remove", key: "item:d:lanterns" }]));
  });

  it("says what it understands otherwise", () => {
    expect(demoReply("what's the weather", ctx, plan)).toMatchObject({ args: null });
  });
});

describe("request parsing and limits", () => {
  const base = { venueId: "v", plan: { ...plan }, messages: [{ role: "user", text: "Hi" }], locale: "ms", estimateTotalCents: 100 };
  it("accepts a normal request", () => {
    expect(parseAssistantRequest(base)).toMatchObject({ venueId: "v", locale: "ms", estimateTotalCents: 100 });
  });
  it("refuses oversized or malformed conversations", () => {
    expect(() => parseAssistantRequest({ ...base, messages: [] })).toThrow();
    expect(() => parseAssistantRequest({ ...base, messages: [{ role: "user", text: "x".repeat(2001) }] })).toThrow();
    expect(() => parseAssistantRequest({ ...base, messages: [{ role: "user", text: "a" }, { role: "model", text: "b" }] })).toThrow();
    expect(() => parseAssistantRequest({ ...base, messages: Array.from({ length: 13 }, () => ({ role: "user", text: "a" })) })).toThrow();
    expect(() => parseAssistantRequest({ ...base, plan: { ...plan, headcount: 9999 } })).toThrow();
  });
  it("unknown locale falls back to English; limits take admin overrides", () => {
    expect(parseAssistantRequest({ ...base, locale: "fr" }).locale).toBe("en");
    expect(resolveAssistantLimits({ userPerDay: 5 })).toEqual({ userPerDay: 5, globalPerDay: 3000 });
    expect(resolveAssistantLimits({ userPerDay: "lots" }).userPerDay).toBe(30);
  });
});

import { describe, expect, it } from "vitest";
import { checkPlannerCalls, listingsBlock, parsePlannerRequest, plannerDemo, plannerInstruction, validatePlanStart, type PlannerContext } from "./planner.js";

const ctx: PlannerContext = {
  venues: [
    {
      id: "garden",
      name: "SAMPLE Garden Pavilion",
      area: "Botanic Gardens area, Singapore",
      ownerUid: "o1",
      styleTags: ["Garden", "Ballroom"],
      cultureTags: ["Chinese", "Malay"],
      menuOptions: ["halal", "vegetarian"],
      stepFree: true,
      wheelchair: true,
      rooms: [
        { id: "glass", name: "SAMPLE Glasshouse", capacityMin: 80, capacityMax: 250, tiers: { peak: { roomRentalCents: 1_200_000, minimumSpendCents: null }, offPeak: { roomRentalCents: 650_000, minimumSpendCents: null } } },
        { id: "terrace", name: "SAMPLE Terrace", capacityMin: 30, capacityMax: 80, tiers: { standard: { roomRentalCents: 300_000, minimumSpendCents: null } } },
      ],
      items: [{ key: "item:o1:halal", name: "SAMPLE Halal menu", category: "Food and drink", unit: "guest", priceCents: 16_800, dietaryTags: ["halal"] }],
    },
    {
      id: "loft",
      name: "SAMPLE Rooftop Loft",
      area: "CBD, Singapore",
      ownerUid: "o2",
      styleTags: ["Rooftop"],
      cultureTags: ["Western"],
      menuOptions: [],
      stepFree: false,
      wheelchair: false,
      rooms: [{ id: "deck", name: "SAMPLE Deck", capacityMin: 20, capacityMax: 60, tiers: { standard: { roomRentalCents: 200_000, minimumSpendCents: null } } }],
      items: [],
    },
  ],
  vendors: [
    { uid: "d1", name: "SAMPLE Pelamin Artistry", description: "SAMPLE decorator. Pelamin daises and Malay wedding styling.", servesAnyVenue: true, servesVenueIds: [], items: [{ key: "item:d1:pelamin", name: "Pelamin dais", category: "Backdrops", unit: "piece", priceCents: 380_000, dietaryTags: [] }] },
    { uid: "d2", name: "SAMPLE Loft Lights", description: "Lighting for the loft only.", servesAnyVenue: false, servesVenueIds: ["loft"], items: [{ key: "item:d2:bulbs", name: "Bulbs", category: "Lighting", unit: "piece", priceCents: 10_000, dietaryTags: [] }] },
  ],
};

describe("validatePlanStart", () => {
  it("keeps a real venue, room, tier, theme, date, budget, brief and items", () => {
    const p = validatePlanStart(
      {
        summary: "A lovely garden day.",
        venueId: "garden",
        spaceId: "glass",
        tierKey: "offPeak",
        headcount: 150,
        themeId: "malay-pelamin",
        weddingDate: "2027-05-22",
        budget: 45000,
        traditions: ["Malay"],
        dietaryTags: ["halal"],
        items: [{ ref: "item:o1:halal" }, { ref: "item:d1:pelamin", quantity: 2 }, { ref: "item:d2:bulbs" }, { ref: "item:x:invented" }],
      },
      ctx,
    );
    expect(p).toEqual({
      summary: "A lovely garden day.",
      venueId: "garden",
      venueName: "SAMPLE Garden Pavilion",
      spaceId: "glass",
      tierKey: "offPeak",
      headcount: 150,
      themeId: "malay-pelamin",
      weddingDate: "2027-05-22",
      budgetCents: 4_500_000,
      brief: { style: "", traditions: ["Malay"], dietaryTags: ["halal"], stepFree: false, notes: "" },
      // The loft-only decorator and the invented item are dropped.
      selections: { "item:o1:halal": 1, "item:d1:pelamin": 2 },
    });
  });

  it("unknown venue: nothing to start", () => {
    expect(validatePlanStart({ venueId: "invented", summary: "x" }, ctx)).toBeNull();
  });

  it("an unknown room becomes one that fits the guests; bad values are left out", () => {
    const p = validatePlanStart({ venueId: "garden", spaceId: "ballroom-9", headcount: 50, tierKey: "peak", themeId: "space-opera", weddingDate: "2027-02-30", budget: -5 }, ctx)!;
    expect(p).toMatchObject({ spaceId: "terrace", tierKey: "standard", headcount: 50, themeId: null, weddingDate: null, budgetCents: null, brief: null, selections: {} });
  });
});

describe("checkPlannerCalls", () => {
  it("keeps only listed venues and decorators, and at most two plans", () => {
    const r = checkPlannerCalls(
      [
        { name: "shortlist_venues", args: { venues: [{ venueId: "garden", reason: "Fits 150 with halal menus" }, { venueId: "nope", reason: "x" }, { venueId: "garden", reason: "again" }] } },
        { name: "recommend_vendors", args: { vendors: [{ vendorUid: "d1", reason: "Malay styling" }, { vendorUid: "ghost", reason: "x" }] } },
        { name: "start_plan", args: { venueId: "garden" } },
        { name: "start_plan", args: { venueId: "loft" } },
        { name: "start_plan", args: { venueId: "garden" } },
        { name: "start_plan", args: { venueId: "invented" } },
        { name: "book_venue", args: { venueId: "garden" } },
      ],
      ctx,
    );
    expect(r.shortlist).toEqual([{ venueId: "garden", venueName: "SAMPLE Garden Pavilion", reason: "Fits 150 with halal menus" }]);
    expect(r.vendors).toEqual([{ vendorUid: "d1", vendorName: "SAMPLE Pelamin Artistry", reason: "Malay styling" }]);
    expect(r.plans.map((p) => p.venueId)).toEqual(["garden", "loft"]);
  });
});

describe("planner prompt", () => {
  it("is friendly and never books or takes payment", () => {
    const s = plannerInstruction("en");
    expect(s).toContain("friendly AI wedding planner");
    expect(s).toContain("warm, upbeat and encouraging");
    expect(s).toContain("never say a plan has been created, booked or paid");
    expect(s).toContain("takes no payments or deposits");
    expect(plannerInstruction("zh")).toContain("Simplified Chinese");
  });

  it("lists venues with rooms and items, and decorators with where they work; no street addresses", () => {
    const b = listingsBlock(ctx);
    expect(b).toContain("garden | SAMPLE Garden Pavilion | Botanic Gardens area, Singapore | Garden, Ballroom | Chinese, Malay | halal, vegetarian | wheelchair, step-free");
    expect(b).toContain("room glass | SAMPLE Glasshouse | 80-250 guests | peak rental S$12000.00; offPeak rental S$6500.00");
    expect(b).toContain("item item:o1:halal | SAMPLE Halal menu | Food and drink | S$168.00 per guest | halal");
    expect(b).toContain("d2 | SAMPLE Loft Lights | loft |");
  });
});

describe("planner DEMO", () => {
  it("greets warmly when it knows nothing yet", () => {
    const r = plannerDemo([{ role: "user", text: "hello!" }], ctx);
    expect(r.text).toMatch(/^DEMO Aria: Congratulations/);
    expect(r.calls).toEqual([]);
  });

  it("filters real listings by guests, food and traditions, and offers a plan to start", () => {
    const r = plannerDemo([{ role: "user", text: "A Malay garden wedding for 150 guests with halal food, budget $45,000" }], ctx);
    const out = checkPlannerCalls(r.calls, ctx);
    expect(out.shortlist.map((v) => v.venueId)).toEqual(["garden"]);
    expect(out.vendors.map((v) => v.vendorUid)).toEqual(["d1"]);
    expect(out.plans[0]).toMatchObject({ venueId: "garden", spaceId: "glass", headcount: 150, themeId: "malay-pelamin", budgetCents: 4_500_000, selections: { "item:o1:halal": 1 } });
    expect(r.text.startsWith("DEMO Aria:")).toBe(true);
  });

  it("adds up details across messages", () => {
    const r = plannerDemo(
      [
        { role: "user", text: "We'd love a rooftop" },
        { role: "model", text: "How many guests?" },
        { role: "user", text: "About 40 guests" },
      ],
      ctx,
    );
    expect(checkPlannerCalls(r.calls, ctx).shortlist[0]?.venueId).toBe("loft");
  });

  it("says so kindly when nothing fits", () => {
    expect(plannerDemo([{ role: "user", text: "2000 guests" }], ctx)).toMatchObject({ calls: [] });
  });
});

describe("planner request", () => {
  it("accepts a conversation and refuses malformed ones", () => {
    expect(parsePlannerRequest({ messages: [{ role: "user", text: "Hi" }], locale: "ta" })).toEqual({ messages: [{ role: "user", text: "Hi" }], locale: "ta" });
    expect(parsePlannerRequest({ messages: [{ role: "user", text: "Hi" }], locale: "fr" }).locale).toBe("en");
    expect(() => parsePlannerRequest({ messages: [] })).toThrow();
    expect(() => parsePlannerRequest({ messages: [{ role: "model", text: "Hi" }] })).toThrow();
    expect(() => parsePlannerRequest({ messages: [{ role: "user", text: "x".repeat(2001) }] })).toThrow();
  });
});

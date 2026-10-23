import { describe, expect, it } from "vitest";
import { demoReply } from "./demo.js";
import { venueDataBlock, systemInstruction, type PlanFacts } from "./prompt.js";
import { applyChanges, cleanTimeline, mergeBrief, validateProposal, validateShortlist, type PlanSnapshot, type VenueContext } from "./proposal.js";
import { checkCalls, parseAssistantRequest, resolveAssistantLimits } from "./assistant.js";

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
  venues: [
    { id: "big", name: "SAMPLE Grand Hall", styleTags: ["Ballroom"], cultureTags: ["Chinese"], menuOptions: ["halal"], stepFree: true, ranges: [{ min: 150, max: 600 }], fromRentalCents: 900_000 },
    { id: "small", name: "SAMPLE Shophouse", styleTags: ["Heritage"], cultureTags: ["Peranakan"], menuOptions: [], stepFree: false, ranges: [{ min: 10, max: 60 }], fromRentalCents: 150_000 },
  ],
};
const plan: PlanSnapshot = {
  headcount: 185,
  spaceId: "glass",
  tierKey: "peak",
  themeId: "peranakan",
  weddingDate: null,
  selections: { "item:o:arch": 1, "item:d:lanterns": 1 },
  budgetCents: null,
  brief: null,
  timeline: [],
};
const facts: PlanFacts = { estimateTotalCents: 5_481_060, guests: null, unavailable: [] };

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

  it("budget: whole dollars become integer cents; nonsense is dropped", () => {
    expect(validateProposal({ summary: "x", budget: 45000 }, ctx, plan).changes).toEqual([{ kind: "budget", cents: 4_500_000 }]);
    for (const bad of [0, -100, 12.5, "lots", 20_000_000]) {
      const p = validateProposal({ summary: "x", budget: bad }, ctx, plan);
      expect(p.changes, String(bad)).toEqual([]);
      expect(p.dropped.length).toBe(1);
    }
    // Same as now: no change.
    expect(validateProposal({ summary: "x", budget: 45000 }, ctx, { ...plan, budgetCents: 4_500_000 }).changes).toEqual([]);
  });

  it("keeps the option label, trimmed", () => {
    expect(validateProposal({ label: "  Option A  ", summary: "x", headcount: 150 }, ctx, plan).label).toBe("Option A");
  });

  it("a timeline is checked, sorted and capped", () => {
    const p = validateProposal(
      {
        summary: "x",
        timeline: [
          { time: "13:00", label: "Lunch" },
          { time: "11:00", label: "Ceremony" },
          { time: "25:00", label: "Never" },
          { time: "12:00", label: "" },
        ],
      },
      ctx,
      plan,
    );
    expect(p.changes).toEqual([
      {
        kind: "timeline",
        entries: [
          { time: "11:00", label: "Ceremony" },
          { time: "13:00", label: "Lunch" },
        ],
      },
    ]);
    expect(p.dropped).toEqual(["timeline 25:00", "timeline 12:00"]);
    expect(cleanTimeline(Array.from({ length: 30 }, (_, i) => ({ time: `0${i % 10}:00`, label: `L${i}` })), []).length).toBe(15);
  });
});

describe("brief", () => {
  it("merges suggested fields into the current brief, keeping only known tags", () => {
    const dropped: string[] = [];
    const b = mergeBrief({ style: "garden", traditions: ["Chinese"], dietaryTags: [], stepFree: false, notes: "" }, { traditions: ["Malay", "Klingon"], dietaryTags: ["halal", "halal"], stepFree: true }, dropped);
    expect(b).toEqual({ style: "garden", traditions: ["Malay"], dietaryTags: ["halal"], stepFree: true, notes: "" });
    expect(dropped).toEqual(["tradition Klingon"]);
  });

  it("no brief fields, or no real change, gives no brief change", () => {
    expect(mergeBrief(null, { summary: "x" }, [])).toBeNull();
    const current = { style: "garden", traditions: [], dietaryTags: [], stepFree: false, notes: "" };
    expect(mergeBrief(current, { style: "garden" }, [])).toBeNull();
  });

  it("caps free text", () => {
    const b = mergeBrief(null, { style: "x".repeat(500), notes: "y".repeat(900) }, []);
    expect(b?.style.length).toBe(200);
    expect(b?.notes.length).toBe(500);
  });

  it("appears as a change the couple approves", () => {
    const p = validateProposal({ summary: "Noted.", dietaryTags: ["vegetarian"] }, ctx, plan);
    expect(p.changes).toEqual([{ kind: "brief", brief: { style: "", traditions: [], dietaryTags: ["vegetarian"], stepFree: false, notes: "" } }]);
  });
});

describe("shortlist", () => {
  it("keeps only listed venues, once each, at most 8", () => {
    const s = validateShortlist({ venues: [{ venueId: "big", reason: "Fits 185 guests" }, { venueId: "invented", reason: "x" }, { venueId: "big", reason: "again" }] }, ctx);
    expect(s).toEqual([{ venueId: "big", venueName: "SAMPLE Grand Hall", reason: "Fits 185 guests" }]);
    const many: VenueContext = { ...ctx, venues: Array.from({ length: 12 }, (_, i) => ({ ...ctx.venues![0]!, id: `v${i}` })) };
    expect(validateShortlist({ venues: many.venues!.map((v) => ({ venueId: v.id, reason: "" })) }, many).length).toBe(8);
  });
});

describe("checkCalls", () => {
  it("up to three labelled options; a single suggestion has no label", () => {
    const calls = [
      { name: "propose_plan_changes", args: { label: "Option A", summary: "a", headcount: 150 } },
      { name: "propose_plan_changes", args: { label: "Option B", summary: "b", tierKey: "offPeak" } },
      { name: "propose_plan_changes", args: { label: "Option C", summary: "c", headcount: 9999 } },
      { name: "propose_plan_changes", args: { label: "Option D", summary: "d", headcount: 100 } },
      { name: "shortlist_venues", args: { venues: [{ venueId: "big", reason: "r" }] } },
      { name: "delete_everything", args: {} },
    ];
    const r = checkCalls(calls, ctx, plan);
    // C has nothing valid and D is past the limit of three calls.
    expect(r.proposals.map((p) => p.label)).toEqual(["Option A", "Option B"]);
    expect(r.shortlist.map((s) => s.venueId)).toEqual(["big"]);
    expect(r.offerRequest).toBe(false);
    expect(checkCalls([calls[0]!], ctx, plan).proposals[0]!.label).toBe("");
    expect(checkCalls([{ name: "offer_confirmation_request", args: {} }], ctx, plan).offerRequest).toBe(true);
  });
});

describe("applyChanges", () => {
  it("applies like the Studio: a package replaces the items it includes", () => {
    const next = applyChanges(plan, [{ kind: "add", key: "package:d:garden", quantity: 1 }, { kind: "headcount", value: 120 }], ctx);
    expect(next.selections).toEqual({ "item:o:arch": 1, "package:d:garden": 1 });
    expect(next.headcount).toBe(120);
    expect(plan.headcount).toBe(185); // the original is untouched
  });

  it("sets budget, brief and timeline", () => {
    const brief = { style: "garden", traditions: ["Malay"], dietaryTags: ["halal"], stepFree: true, notes: "" };
    const next = applyChanges(
      plan,
      [
        { kind: "budget", cents: 4_000_000 },
        { kind: "brief", brief },
        { kind: "timeline", entries: [{ time: "11:00", label: "Ceremony" }] },
      ],
      ctx,
    );
    expect(next).toMatchObject({ budgetCents: 4_000_000, brief, timeline: [{ time: "11:00", label: "Ceremony" }] });
    brief.traditions.push("Chinese");
    expect(next.brief!.traditions).toEqual(["Malay"]); // copied, not shared
  });
});

describe("prompt", () => {
  it("fences vendor text as data and lists exact keys and prices", () => {
    const block = venueDataBlock(ctx, plan, facts);
    expect(block).toContain("<VENUE DATA>");
    expect(block).toContain("item:o:halal | SAMPLE Co | SAMPLE Halal banquet menu | Food and drink | S$168.00 per guest | halal");
    expect(block).toContain("glass | SAMPLE Glasshouse Ballroom | 80-250 | 10 | peak: rental S$12000.00, minimum spend S$45000.50; offPeak: rental S$6500.00");
    expect(block).toContain("Current estimated total across vendors: S$54810.60");
    expect(block).toContain("<OTHER VENUES>");
    expect(block).toContain("big | SAMPLE Grand Hall | Ballroom | Chinese | halal | yes | 150-600 | S$9000.00");
    expect(block).toContain("Budget: not set");
    expect(block).toContain("Brief: not filled in yet");
    expect(systemInstruction("ta")).toContain("Tamil");
    expect(systemInstruction("xx")).toContain("English");
  });

  it("flags over budget, over capacity and unavailable vendors; guests are counts only", () => {
    const block = venueDataBlock(ctx, { ...plan, budgetCents: 5_000_000, headcount: 260 }, {
      estimateTotalCents: 5_481_060,
      guests: { total: 270, byTier: { must: 100, extended: 80, close: 60, casual: 30 } },
      unavailable: ["SAMPLE Deco"],
    });
    expect(block).toContain("OVER BUDGET by S$4810.60");
    expect(block).toContain("OVER ROOM CAPACITY by 10 guests");
    expect(block).toContain("GUEST LIST OVER ROOM CAPACITY by 20 seats");
    expect(block).toContain("must invite 100, extended family 80, close friends 60, others 30");
    expect(block).toContain("UNAVAILABLE ON THE WEDDING DATE: SAMPLE Deco");
  });

  it("tells the model the couple decides and guests are never ranked", () => {
    const s = systemInstruction("en");
    expect(s).toContain("Aria");
    expect(s).toContain("Never suggest removing particular people");
    expect(s).toContain("takes no payments or deposits");
    expect(s).toContain("Never say a change has been made, booked, sent or paid");
  });
});

describe("demo mode", () => {
  it("understands guests, theme names and add/remove by item name", () => {
    const r = demoReply("Let's do 150 guests, Modern Botanical, add the floral arch and remove the lantern set", ctx, plan, facts);
    expect(r.text.startsWith("DEMO")).toBe(true);
    const p = validateProposal(r.calls[0]!.args, ctx, plan);
    expect(p.changes).toEqual(expect.arrayContaining([{ kind: "headcount", value: 150 }, { kind: "theme", themeId: "modern-botanical" }, { kind: "remove", key: "item:d:lanterns" }]));
  });

  it("budget, food, traditions and a DEMO timeline go into one suggestion", () => {
    const r = demoReply("Budget $45,000, halal food, Malay traditions, and a timeline please", ctx, plan, facts);
    const p = checkCalls(r.calls, ctx, plan).proposals[0]!;
    expect(p.changes).toEqual(
      expect.arrayContaining([
        { kind: "budget", cents: 4_500_000 },
        { kind: "brief", brief: { style: "", traditions: ["Malay"], dietaryTags: ["halal"], stepFree: false, notes: "" } },
      ]),
    );
    const timeline = p.changes.find((c) => c.kind === "timeline");
    expect(timeline && timeline.kind === "timeline" && timeline.entries.every((e) => e.label.startsWith("DEMO"))).toBe(true);
  });

  it("over budget: labelled options, nothing applied", () => {
    const r = demoReply("We're over budget, what are my options?", ctx, plan, facts);
    const out = checkCalls(r.calls, ctx, plan);
    expect(out.proposals.map((p) => p.label)).toEqual(["Option A", "Option B", "Option C"]);
    expect(out.proposals[0]!.changes).toEqual([{ kind: "remove", key: "item:o:arch" }]);
    expect(out.proposals[1]!.changes).toEqual([{ kind: "tier", tierKey: "offPeak" }]);
  });

  it("too many guests: a bigger room or venue, never removing people", () => {
    const r = demoReply("too many guests", ctx, { ...plan, spaceId: "terrace", tierKey: "standard", headcount: 100 }, facts);
    const out = checkCalls(r.calls, ctx, { ...plan, spaceId: "terrace", tierKey: "standard", headcount: 100 });
    expect(out.proposals[0]!.changes[0]).toMatchObject({ kind: "space", spaceId: "glass" });
    expect(out.proposals[1]!.changes).toEqual([{ kind: "headcount", value: 80 }]);
    expect(r.text).toContain("never suggest removing particular guests");
  });

  it("other venues and confirm prices", () => {
    expect(checkCalls(demoReply("show me other venues", ctx, plan, facts).calls, ctx, plan).shortlist.map((s) => s.venueId)).toEqual(["big"]);
    expect(checkCalls(demoReply("can vendors confirm prices?", ctx, plan, facts).calls, ctx, plan).offerRequest).toBe(true);
  });

  it("says what it understands otherwise", () => {
    expect(demoReply("what's the weather", ctx, plan, facts)).toMatchObject({ calls: [] });
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
  it("cleans budget, brief and timeline from the client", () => {
    const r = parseAssistantRequest({
      ...base,
      plan: { ...plan, budgetCents: 12.5, brief: { style: 7, traditions: ["Malay", "x"], dietaryTags: ["vegan"], stepFree: "yes", notes: "n" }, timeline: [{ time: "9:00", label: "x" }, { time: "10:00", label: "Arrive" }] },
    });
    expect(r.plan.budgetCents).toBeNull();
    expect(r.plan.brief).toEqual({ style: "", traditions: ["Malay"], dietaryTags: ["vegan"], stepFree: false, notes: "n" });
    expect(r.plan.timeline).toEqual([{ time: "10:00", label: "Arrive" }]);
    // Plans saved before Aria have none of these fields.
    const old: Record<string, unknown> = { ...plan };
    for (const k of ["budgetCents", "brief", "timeline"]) delete old[k];
    expect(parseAssistantRequest({ ...base, plan: old }).plan).toMatchObject({ budgetCents: null, brief: null, timeline: [] });
  });
  it("unknown locale falls back to English; limits take admin overrides", () => {
    expect(parseAssistantRequest({ ...base, locale: "fr" }).locale).toBe("en");
    expect(resolveAssistantLimits({ userPerDay: 5 })).toEqual({ userPerDay: 5, guestPerDay: 10, globalPerDay: 3000 });
    expect(resolveAssistantLimits({ userPerDay: "lots" }).userPerDay).toBe(30);
  });
});

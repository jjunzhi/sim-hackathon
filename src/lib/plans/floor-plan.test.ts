import { describe, expect, it } from "vitest";
import { featuresFrom, layoutFloorPlan, PLAN_H, PLAN_W, type Box } from "./floor-plan";

const none = { stageItem: null, arch: false, buffet: false, dessert: false, solemnisation: false };
const inside = (b: Box) => b.x >= 0 && b.y >= 0 && b.x + b.w <= PLAN_W && b.y + b.h <= PLAN_H;
const hits = (t: { cx: number; cy: number; r: number }, b: Box | null) => !!b && t.cx + t.r > b.x && t.cx - t.r < b.x + b.w && t.cy + t.r > b.y && t.cy - t.r < b.y + b.h;

describe("featuresFrom", () => {
  it("reads the stage piece, arch, buffet, dessert and solemnisation table from chosen items", () => {
    const f = featuresFrom([
      { name: "Pelamin dais", category: "Backdrops and stage" },
      { name: "Floral arch", category: "Florals" },
      { name: "Nasi minyak buffet", category: "Food and drink" },
      { name: "Kuih dessert table", category: "Food and drink" },
      { name: "Solemnisation table styling", category: "Table decor" },
    ]);
    expect(f).toEqual({ stageItem: "Pelamin dais", arch: true, buffet: true, dessert: true, solemnisation: true });
  });

  it("a set menu is not a buffet; 'archway lights' is not an arch", () => {
    expect(featuresFrom([{ name: "Chef's set dinner", category: "Food and drink" }, { name: "Archway lights", category: "Lighting" }])).toEqual(none);
  });
});

describe("layoutFloorPlan", () => {
  it("one table per table of guests, numbered from the stage", () => {
    const p = layoutFloorPlan({ headcount: 150, seatsPerTable: 10, features: none });
    expect(p.tableCount).toBe(15);
    expect(p.tables.map((t) => t.n)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(p.notDrawn).toBe(0);
    // Table 1 is no further from the stage than the last table.
    expect(p.tables[0]!.cy).toBeLessThanOrEqual(p.tables.at(-1)!.cy);
  });

  it("tables stay inside the room and off the stage, dance floor, buffet and solemnisation table", () => {
    const p = layoutFloorPlan({ headcount: 300, seatsPerTable: 10, features: { ...none, buffet: true, dessert: true, solemnisation: true } });
    for (const t of p.tables) {
      expect(t.cx - t.r).toBeGreaterThan(12);
      expect(t.cx + t.r).toBeLessThan(PLAN_W - 12);
      expect(t.cy + t.r).toBeLessThan(PLAN_H - 22);
      for (const b of [p.stage, p.danceFloor, p.buffet, p.dessert, p.solemnisation]) expect(hits(t, b)).toBe(false);
    }
    for (const b of [p.stage, p.danceFloor!, p.buffet!, p.dessert!, p.solemnisation!, p.entrance]) expect(inside(b)).toBe(true);
  });

  it("a large wedding shrinks the tables to fit them all", () => {
    const small = layoutFloorPlan({ headcount: 100, seatsPerTable: 10, features: none });
    const large = layoutFloorPlan({ headcount: 525, seatsPerTable: 10, features: none });
    expect(large.tableCount).toBe(53);
    expect(large.tables).toHaveLength(53);
    expect(large.tables[0]!.r).toBeLessThan(small.tables[0]!.r);
  });

  it("a very large wedding says how many tables didn't fit, never drops them silently", () => {
    const p = layoutFloorPlan({ headcount: 5000, seatsPerTable: 10, features: none });
    expect(p.tableCount).toBe(500);
    expect(p.tables.length + p.notDrawn).toBe(500);
    expect(p.notDrawn).toBeGreaterThan(0);
  });

  it("a small dinner has no dance floor", () => {
    const p = layoutFloorPlan({ headcount: 24, seatsPerTable: 12, features: none });
    expect(p.tableCount).toBe(2);
    expect(p.danceFloor).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { cleanRows } from "@/components/studio/aria-timeline";
import { parseBudget } from "@/components/studio/aria-brief";
import { DIET_TAGS } from "@/lib/venues/inclusion";
import { CULTURE_TAGS } from "@/lib/venues/model";
import { BRIEF_DIET_TAGS, BRIEF_TRADITIONS } from "../../../functions/src/assistant/types";
import { detectAlerts } from "./alerts";
import { adjustChanges, editableNumber, type Change } from "./client";

const base = { budgetCents: null, estimateCents: 3_000_000, headcount: 120, capacityMax: 150, guestSeats: null, unavailableVendors: [] };

describe("Aria alerts", () => {
  it("nothing to say when the plan fits", () => {
    expect(detectAlerts(base)).toEqual([]);
    expect(detectAlerts({ ...base, budgetCents: 3_000_000 })).toEqual([]); // exactly on budget is fine
  });

  it("over budget, by how much", () => {
    expect(detectAlerts({ ...base, budgetCents: 2_500_000 })).toEqual([{ kind: "overBudget", overCents: 500_000 }]);
  });

  it("over capacity, from the plan or the guest list, whichever is further over", () => {
    expect(detectAlerts({ ...base, headcount: 160 })).toEqual([{ kind: "overCapacity", over: 10, source: "plan" }]);
    expect(detectAlerts({ ...base, guestSeats: 175 })).toEqual([{ kind: "overCapacity", over: 25, source: "guests" }]);
    expect(detectAlerts({ ...base, headcount: 170, guestSeats: 160 })).toEqual([{ kind: "overCapacity", over: 20, source: "plan" }]);
    expect(detectAlerts({ ...base, headcount: 999, capacityMax: null })).toEqual([]); // no room chosen
  });

  it("vendors unavailable on the date, each named once", () => {
    expect(detectAlerts({ ...base, unavailableVendors: ["A", "B", "A"] })).toEqual([{ kind: "dateUnavailable", vendors: ["A", "B"] }]);
  });
});

describe("Adjust", () => {
  const changes: Change[] = [
    { kind: "headcount", value: 150 },
    { kind: "add", key: "item:v:arch", quantity: 2 },
    { kind: "add", key: "item:v:menu", quantity: 1 },
    { kind: "budget", cents: 4_000_000 },
    { kind: "theme", themeId: "peranakan" },
  ];
  const perPiece = (k: string) => k === "item:v:arch";

  it("only guests, per-piece quantities and the budget are editable", () => {
    expect(changes.map((c) => editableNumber(c, perPiece))).toEqual([150, 2, null, 40_000, null]);
  });

  it("unticked changes are left out; edited numbers are used within bounds", () => {
    const out = adjustChanges(changes, [true, true, false, true, false], { 0: 140, 1: 5, 3: 38_000 });
    expect(out).toEqual([
      { kind: "headcount", value: 140 },
      { kind: "add", key: "item:v:arch", quantity: 5 },
      { kind: "budget", cents: 3_800_000 },
    ]);
  });

  it("out-of-range edits keep Aria's value", () => {
    expect(adjustChanges(changes, [true, true, true, true, true], { 0: 0, 1: 5000, 3: -1 })).toEqual(changes);
  });
});

describe("brief and timeline forms", () => {
  it("budget: whole dollars, commas and S$ allowed; empty clears it", () => {
    expect(parseBudget("45,000")).toBe(4_500_000);
    expect(parseBudget(" $45000 ")).toBe(4_500_000);
    expect(parseBudget("")).toBeNull();
    for (const bad of ["45k", "12.50", "0", "-5", "99999999"]) expect(parseBudget(bad), bad).toBeUndefined();
  });

  it("timeline rows: blank rows dropped, half-filled rows refused, sorted", () => {
    expect(
      cleanRows([
        { time: "13:00", label: "Lunch" },
        { time: "", label: "" },
        { time: "11:00", label: " Ceremony " },
      ]),
    ).toEqual([
      { time: "11:00", label: "Ceremony" },
      { time: "13:00", label: "Lunch" },
    ]);
    expect(cleanRows([{ time: "11:00", label: "" }])).toBeNull();
    expect(cleanRows([{ time: "", label: "Something" }])).toBeNull();
  });

  it("the server's tag lists match the app's", () => {
    expect([...BRIEF_TRADITIONS]).toEqual([...CULTURE_TAGS]);
    expect([...BRIEF_DIET_TAGS]).toEqual([...DIET_TAGS]);
  });
});

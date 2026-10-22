import { describe, expect, it } from "vitest";
import { summariseGuests, validateParty, type GuestParty } from "./helper";

const party = (tier: GuestParty["tier"], seats: number, plusOnes = 0): GuestParty => ({ label: "x", tier, seats, plusOnes });

const list = [party("must", 60, 4), party("extended", 50), party("close", 30, 10), party("casual", 20, 6)];
// must 64, extended 50, close 40, casual 26 = 180

describe("summariseGuests", () => {
  it("counts seats including plus-ones, by tier", () => {
    const s = summariseGuests(list, 250);
    expect(s.byTier).toEqual({ must: 64, extended: 50, close: 40, casual: 26 });
    expect(s.totalSeats).toBe(180);
    expect(s.remaining).toBe(70);
    expect(s.over).toBe(0);
    expect(s.trimSuggestion).toEqual([]);
  });

  it("over by 14: trimming Casual alone is enough", () => {
    const s = summariseGuests(list, 166);
    expect(s.over).toBe(14);
    expect(s.trimSuggestion).toEqual([{ tier: "casual", seats: 26 }]);
    expect(s.trimNotEnough).toBe(false);
  });

  it("over by more than Casual: continues in the couple's order", () => {
    expect(summariseGuests(list, 120).trimSuggestion).toEqual([
      { tier: "casual", seats: 26 },
      { tier: "close", seats: 40 },
    ]);
    expect(summariseGuests(list, 120, ["extended", "casual", "close"]).trimSuggestion).toEqual([{ tier: "extended", seats: 50 }, { tier: "casual", seats: 26 }]);
  });

  it("never suggests Must invite, and says when trimming isn't enough", () => {
    const s = summariseGuests(list, 50);
    expect(s.trimSuggestion.map((t) => t.tier)).toEqual(["casual", "close", "extended"]);
    expect(s.trimNotEnough).toBe(true);
  });

  it("skips empty tiers and works without a room", () => {
    expect(summariseGuests([party("must", 10), party("close", 10)], 15).trimSuggestion).toEqual([{ tier: "close", seats: 10 }]);
    expect(summariseGuests(list, null)).toMatchObject({ remaining: null, over: 0, trimSuggestion: [] });
  });

  it("exactly at capacity is within", () => {
    expect(summariseGuests(list, 180)).toMatchObject({ remaining: 0, over: 0 });
  });
});

describe("validateParty", () => {
  it("accepts a normal party and rejects bad counts", () => {
    expect(validateParty({ label: "Auntie Mei's family", tier: "extended", seats: 4, plusOnes: 0 })).toEqual({});
    expect(validateParty({ label: " ", tier: "must", seats: 0, plusOnes: -1 })).toMatchObject({ label: expect.any(String), seats: expect.any(String), plusOnes: expect.any(String) });
  });
});

import { describe, expect, it } from "vitest";
import { computeResults, newShareId } from "./model";

describe("newShareId", () => {
  it("is 22 url-safe characters from 16 random bytes", () => {
    const id = newShareId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newShareId()).not.toBe(id);
  });

  it("encodes all 128 bits", () => {
    expect(newShareId(() => new Uint8Array(16).fill(255))).toBe("_____________________w");
  });
});

describe("computeResults", () => {
  it("no votes yet", () => {
    expect(computeResults([], 3)).toMatchObject({ total: 0, leaders: [], summary: "none" });
  });

  it("strong agreement at 70% or more", () => {
    const r = computeResults([0, 0, 0, 0, 0, 0, 0, 1, 2, 2].map((optionIndex) => ({ optionIndex })), 3);
    expect(r.options.map((o) => [o.count, o.pct])).toEqual([[7, 70], [1, 10], [2, 20]]);
    expect(r).toMatchObject({ total: 10, leaders: [0], summary: "agree" });
  });

  it("split when the leader has less than 70%", () => {
    expect(computeResults([0, 0, 1].map((optionIndex) => ({ optionIndex })), 2).summary).toBe("split");
  });

  it("a tie is split, with both leaders", () => {
    expect(computeResults([0, 1].map((optionIndex) => ({ optionIndex })), 2)).toMatchObject({ leaders: [0, 1], summary: "split" });
  });

  it("percentages always add to 100", () => {
    const r = computeResults([0, 1, 2].map((optionIndex) => ({ optionIndex })), 3);
    expect(r.options.map((o) => o.pct)).toEqual([34, 33, 33]);
    expect(r.options.reduce((a, o) => a + o.pct, 0)).toBe(100);
  });

  it("ignores votes for options that don't exist", () => {
    expect(computeResults([{ optionIndex: 5 }, { optionIndex: -1 }, { optionIndex: 0 }], 2).total).toBe(1);
  });
});

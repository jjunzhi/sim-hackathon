import { describe, expect, it } from "vitest";
import { counterIds } from "../../../functions/src/render/quota";
import { THEMES } from "../../../functions/src/render/themes";
import { THEME_OPTIONS } from "./themes";
import { usageDocIds } from "./usage";

describe("usage ids", () => {
  it("client and server name the same counter documents, around midnight in Singapore", () => {
    for (const t of ["2026-10-22T15:59:00Z", "2026-10-22T16:00:00Z", "2026-12-31T16:30:00Z"]) {
      const s = counterIds("u1", "u1", new Date(t));
      const c = usageDocIds("u1", new Date(t));
      expect([c.userDay, c.userMonth, c.vendorMonth]).toEqual([s.userDay, s.userMonth, s.vendorMonth]);
    }
  });
});

describe("theme lists", () => {
  it("client and server offer the same themes with the same labels", () => {
    expect(THEME_OPTIONS.map((t) => [t.value, t.label])).toEqual(THEMES.map((t) => [t.id, t.label]));
  });
});

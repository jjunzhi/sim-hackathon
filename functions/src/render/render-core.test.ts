import { describe, expect, it } from "vitest";
import { photoRevision, renderCacheKey, type RenderKeyParts } from "./cache-key.js";
import { buildPrompt, nearestAspectRatio } from "./prompt.js";
import { counterIds, DEFAULT_LIMITS, firstExceeded, periodKeys, resolveLimits } from "./quota.js";
import { THEMES, themeById } from "./themes.js";

const base: RenderKeyParts = {
  spaceId: "venue1/space1",
  spacePhotoVersion: 2,
  themeId: "peranakan",
  itemIds: ["v/a@r1", "v/b@r1"],
  promptTemplateVersion: "v1",
  modelName: "gemini-nano-banana-2.1",
};

describe("renderCacheKey", () => {
  it("is a SHA-256 hex digest and stable", () => {
    expect(renderCacheKey(base)).toMatch(/^[0-9a-f]{64}$/);
    expect(renderCacheKey(base)).toBe(renderCacheKey({ ...base }));
  });

  it("ignores item order", () => {
    expect(renderCacheKey({ ...base, itemIds: ["v/b@r1", "v/a@r1"] })).toBe(renderCacheKey(base));
  });

  it.each([
    ["space", { spaceId: "venue1/space2" }],
    ["space photo version", { spacePhotoVersion: 3 }],
    ["theme", { themeId: "chinese" }],
    ["items", { itemIds: ["v/a@r1"] }],
    ["an item photo", { itemIds: ["v/a@r2", "v/b@r1"] }],
    ["prompt template", { promptTemplateVersion: "v2" }],
    ["model", { modelName: "gemini-3-pro-image" }],
  ])("changes when the %s changes", (_, change) => {
    expect(renderCacheKey({ ...base, ...change })).not.toBe(renderCacheKey(base));
  });

  it("does not confuse item boundaries", () => {
    expect(renderCacheKey({ ...base, itemIds: ["ab", "c"] })).not.toBe(renderCacheKey({ ...base, itemIds: ["a", "bc"] }));
  });

  it("photoRevision takes the upload id", () => {
    expect(photoRevision("vendors/u/items/i/3f9a77.webp")).toBe("3f9a77");
  });
});

describe("quota", () => {
  it("uses Singapore days: 23:30 UTC is already the next day", () => {
    expect(periodKeys(new Date("2026-10-22T15:59:00Z"))).toEqual({ day: "2026-10-22", month: "2026-10" });
    expect(periodKeys(new Date("2026-10-22T16:00:00Z"))).toEqual({ day: "2026-10-23", month: "2026-10" });
    expect(periodKeys(new Date("2026-10-31T16:30:00Z"))).toEqual({ day: "2026-11-01", month: "2026-11" });
  });

  it("builds counter ids without personal data beyond the opaque uid", () => {
    expect(counterIds("u1", "v1", new Date("2026-10-22T02:00:00Z"))).toEqual({
      userDay: "user_u1_2026-10-22",
      userMonth: "user_u1_2026-10",
      vendorMonth: "vendor_v1_2026-10",
      globalDay: "global_2026-10-22",
    });
  });

  it("blocks exactly at each limit", () => {
    const zero = { userDay: 0, userMonth: 0, vendorMonth: 0, globalDay: 0 };
    expect(firstExceeded(zero, DEFAULT_LIMITS)).toBeNull();
    expect(firstExceeded({ ...zero, userDay: 9 }, DEFAULT_LIMITS)).toBeNull();
    expect(firstExceeded({ ...zero, userDay: 10 }, DEFAULT_LIMITS)).toBe("userPerDay");
    expect(firstExceeded({ ...zero, userMonth: 40 }, DEFAULT_LIMITS)).toBe("userPerMonth");
    expect(firstExceeded({ ...zero, vendorMonth: 300 }, DEFAULT_LIMITS)).toBe("vendorPerMonth");
    expect(firstExceeded({ ...zero, globalDay: 200 }, DEFAULT_LIMITS)).toBe("globalPerDay");
  });

  it("an admin override replaces only valid values", () => {
    expect(resolveLimits({ userPerDay: 2, vendorPerMonth: -5, globalPerDay: 1.5 })).toEqual({ ...DEFAULT_LIMITS, userPerDay: 2 });
    expect(resolveLimits(undefined)).toEqual(DEFAULT_LIMITS);
  });
});

describe("prompt", () => {
  it("lists only the selected items and refers to their reference images", () => {
    const p = buildPrompt(themeById("peranakan")!, [{ name: "Floral arch", category: "Florals", unit: "per piece", description: "" }]);
    expect(p).toContain("ONLY the decor items listed");
    expect(p).toContain("1. Floral arch (Florals, priced per piece) - reference image 2");
    expect(p).toContain("Do not add people");
  });

  it("picks the closest aspect ratio", () => {
    expect(nearestAspectRatio(2048, 1536)).toBe("4:3");
    expect(nearestAspectRatio(1536, 2048)).toBe("3:4");
    expect(nearestAspectRatio(2048, 1152)).toBe("16:9");
    expect(nearestAspectRatio(1000, 1000)).toBe("1:1");
  });

  it("every theme needs community review", () => {
    expect(THEMES.every((x) => x.needsCommunityReview)).toBe(true);
  });
});

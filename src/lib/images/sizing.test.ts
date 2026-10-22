import { describe, expect, it } from "vitest";
import { fitWithin, looksLikeHeic } from "./sizing";

describe("fitWithin", () => {
  it("leaves small images alone", () => {
    expect(fitWithin(1600, 1200)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(2048, 1000)).toEqual({ width: 2048, height: 1000 });
  });

  it("scales landscape and portrait by the long side", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });

  it("handles extreme panoramas without collapsing to zero", () => {
    expect(fitWithin(20000, 5)).toEqual({ width: 2048, height: 1 });
  });

  it("rejects empty images", () => {
    expect(() => fitWithin(0, 100)).toThrow(RangeError);
  });
});

describe("looksLikeHeic", () => {
  it.each([
    [{ name: "IMG_0001.HEIC", type: "" }, true],
    [{ name: "photo.heif", type: "" }, true],
    [{ name: "x", type: "image/heic" }, true],
    [{ name: "photo.jpg", type: "image/jpeg" }, false],
  ])("%o -> %s", (file, expected) => {
    expect(looksLikeHeic(file)).toBe(expected);
  });
});

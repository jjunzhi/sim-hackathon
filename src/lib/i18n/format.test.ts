import { describe, expect, it } from "vitest";
import { formatDate, interpolate, lookup, pluralCategory } from "./format";

describe("interpolate", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(interpolate("Hello {name}, {n} left", { name: "Mei", n: 3 })).toBe("Hello Mei, 3 left");
    expect(interpolate("{missing}", { other: 1 })).toBe("{missing}");
    expect(interpolate("plain")).toBe("plain");
  });
});

describe("lookup", () => {
  const en = { "g.saved_one": "{count} saved render", "g.saved_other": "{count} saved renders", plain: "Plain", only: "English only" };
  const zh = { "g.saved_other": "{count} 张已保存效果图", plain: "纯文本" };

  it("chooses the plural form by Intl.PluralRules", () => {
    expect(lookup(en, en, "en-SG", "g.saved", { count: 1 })).toBe("1 saved render");
    expect(lookup(en, en, "en-SG", "g.saved", { count: 2 })).toBe("2 saved renders");
    expect(lookup(en, en, "en-SG", "g.saved", { count: 0 })).toBe("0 saved renders");
  });

  it("languages without plural forms only need _other", () => {
    expect(pluralCategory("zh-Hans-SG", 1)).toBe("other");
    expect(lookup(zh, en, "zh-Hans-SG", "g.saved", { count: 1 })).toBe("1 张已保存效果图");
  });

  it("falls back to English, then to the key", () => {
    expect(lookup(zh, en, "zh-Hans-SG", "only")).toBe("English only");
    expect(lookup(zh, en, "zh-Hans-SG", "nope")).toBe("nope");
  });

  it("Tamil and Malay plural categories exist", () => {
    expect(pluralCategory("ta-SG", 1)).toBe("one");
    expect(pluralCategory("ta-SG", 5)).toBe("other");
    expect(pluralCategory("ms-SG", 5)).toBe("other");
  });
});

describe("formatDate", () => {
  it("formats in Singapore time in the reader's language", () => {
    const ms = Date.UTC(2026, 10, 5, 15, 59, 59); // 23:59:59 SGT on 5 Nov
    expect(formatDate("en-SG", ms)).toBe("5 Nov 2026");
    expect(formatDate("zh-Hans-SG", ms)).toContain("2026");
    expect(formatDate("ms-SG", ms)).toContain("2026");
    expect(formatDate("ta-SG", ms)).toContain("2026");
  });
});

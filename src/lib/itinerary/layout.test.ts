import { describe, expect, it } from "vitest";
import { ITINERARY_SIZE, layoutItinerary, PALETTES, styleForTheme, wrapText, type ItineraryInput, type Measure } from "./layout";

/** WCAG 2 contrast ratio of two #RRGGBB colours. */
function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// A predictable stand-in for canvas measureText: each character is 0.55 of the font size wide.
const measure: Measure = (text, font) => [...text].length * Number(/(\d+)px/.exec(font)![1]) * 0.55;

const base: ItineraryInput = {
  title: "Mei & Arjun's Wedding",
  subtitle: "Wedding day itinerary",
  place: "Garden Pavilion · Glasshouse Ballroom",
  date: "Saturday, 22 May 2027",
  entries: [
    { time: "11:00", label: "Guests arrive, welcome drinks on the terrace" },
    { time: "12:00", label: "Ceremony" },
    { time: "13:00", label: "Lunch reception" },
  ],
  footer: "Times may change on the day.",
  style: "classic",
  fonts: { display: "Display", sans: "Sans" },
};
const texts = (input: ItineraryInput) => layoutItinerary(input, measure).ops.flatMap((o) => (o.kind === "text" ? [o.text] : []));

describe("wrapText", () => {
  it("wraps on words and keeps every word", () => {
    const lines = wrapText("Guests arrive, welcome drinks on the terrace", "10px X", 120, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("Guests arrive, welcome drinks on the terrace");
    expect(lines.every((l) => measure(l, "10px X") <= 120)).toBe(true);
  });

  it("breaks a long run without spaces (Chinese) by characters", () => {
    const lines = wrapText("宾客抵达欢迎饮品在露台上举行婚礼仪式开始", "10px X", 30, measure);
    expect(lines.join("")).toBe("宾客抵达欢迎饮品在露台上举行婚礼仪式开始");
    expect(lines.every((l) => measure(l, "10px X") <= 30)).toBe(true);
  });
});

describe("layoutItinerary", () => {
  it("puts every approved time and line on the image, word for word", () => {
    const all = texts(base);
    for (const e of base.entries) expect(all).toContain(e.time);
    expect(all.join(" ")).toContain("Guests arrive, welcome drinks on the terrace".split(" ").slice(0, 3).join(" "));
    expect(all).toContain("Mei & Arjun's Wedding");
    expect(all).toContain("WEDDING DAY ITINERARY");
    expect(all).toContain("Saturday, 22 May 2027");
    expect(all).toContain("Times may change on the day.");
  });

  it("leaves out the date line when there is no date", () => {
    expect(texts({ ...base, date: "" })).not.toContain("");
  });

  it("15 long lines still fit, with smaller text, inside the image", () => {
    const long = Array.from({ length: 15 }, (_, i) => ({ time: `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`, label: "Guests gather for photographs with family and friends in the garden".slice(0, 40 + (i % 3) * 10) }));
    const short = layoutItinerary(base, measure);
    const full = layoutItinerary({ ...base, entries: long }, measure);
    expect(full.fits).toBe(true);
    expect(full.entrySize).toBeLessThan(short.entrySize);
    expect(full.entrySize).toBeGreaterThanOrEqual(20);
    for (const op of full.ops) {
      if (op.kind !== "text") continue;
      expect(op.y).toBeLessThanOrEqual(ITINERARY_SIZE.height - 70);
      expect(op.y).toBeGreaterThan(0);
    }
    expect(texts({ ...base, entries: long }).filter((x) => /^\d\d:\d\d$/.test(x))).toHaveLength(15);
  });

  it("says when even the smallest text can't fit, instead of cutting lines silently", () => {
    const huge = Array.from({ length: 15 }, () => ({ time: "10:00", label: "x ".repeat(60).trim() }));
    expect(layoutItinerary({ ...base, entries: huge }, measure).fits).toBe(false);
  });

  it("a long heading wraps to at most two lines", () => {
    const title = "A very long heading that goes on and on about the happy couple and their families";
    const lines = layoutItinerary({ ...base, title }, measure).ops.filter((o) => o.kind === "text" && o.font.includes("72px"));
    expect(lines.length).toBe(2);
  });
});

describe("styles", () => {
  it("follow the theme", () => {
    expect(styleForTheme("chinese")).toBe("festive");
    expect(styleForTheme("fusion-chinese-malay")).toBe("festive");
    expect(styleForTheme("modern-botanical")).toBe("botanical");
    expect(styleForTheme("peranakan")).toBe("classic");
  });

  it("every text colour meets WCAG AA (4.5:1) on its panel", () => {
    for (const [name, p] of Object.entries(PALETTES)) {
      for (const colour of [p.ink, p.muted, p.accent]) expect(contrastRatio(colour, p.panel), `${name} ${colour}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

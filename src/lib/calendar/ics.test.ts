import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine, isIsoDate, nextDay } from "./ics";

describe("ics", () => {
  it("validates dates and finds the next day across month and year ends", () => {
    expect(isIsoDate("2026-11-05")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-11-5")).toBe(false);
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });

  it("escapes TEXT values", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds long lines at 75 octets, counting multi-byte characters by bytes", () => {
    const ascii = "X".repeat(100);
    const folded = foldLine(`SUMMARY:${ascii}`);
    const parts = folded.split("\r\n");
    expect(parts[0]).toHaveLength(75);
    expect(parts[1]!.startsWith(" ")).toBe(true);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    const tamil = "தமிழ்".repeat(20); // 3 bytes per code point
    for (const p of foldLine(`SUMMARY:${tamil}`).split("\r\n")) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
  });

  it("builds an all-day event with the required properties", () => {
    const ics = buildIcs({
      uid: "plan-abc@weddingvista",
      date: "2026-11-05",
      summary: "Wedding: SAMPLE Garden Pavilion plan",
      location: "SAMPLE Garden Pavilion, 1 Sample Garden Road, Singapore",
      now: new Date(Date.UTC(2026, 9, 22, 1, 2, 3)),
    });
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("UID:plan-abc@weddingvista");
    expect(lines).toContain("DTSTAMP:20261022T010203Z");
    expect(lines).toContain("DTSTART;VALUE=DATE:20261105");
    expect(lines).toContain("DTEND;VALUE=DATE:20261106");
    expect(lines).toContain("LOCATION:SAMPLE Garden Pavilion\\, 1 Sample Garden Road\\, Singapore");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(() => buildIcs({ uid: "x", date: "bad", summary: "s" })).toThrow();
  });
});

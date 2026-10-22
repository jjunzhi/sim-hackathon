import { describe, expect, it } from "vitest";
import { monthlyStatements, type Booking } from "./commission";

const b = (o: Partial<Booking>): Booking => ({ leadId: "L", vendorUid: "v", coupleUid: "c", eventDate: "2027-05-22", valueCents: 1_000_000, status: "confirmed", ...o });

describe("monthlyStatements", () => {
  it("counts only bookings the couple confirmed", () => {
    const s = monthlyStatements([b({ leadId: "a" }), b({ leadId: "b", status: "claimed" }), b({ leadId: "c", status: "disputed" })], 300);
    expect(s).toHaveLength(1);
    expect(s[0]!.lines.map((l) => l.leadId)).toEqual(["a"]);
  });

  it("works out commission per line, half-up, then sums", () => {
    // 3% of $54,810.60 = $1,644.318 -> $1,644.32; 3% of $855.50 = $25.665 -> $25.67
    const s = monthlyStatements([b({ leadId: "a", valueCents: 5_481_060 }), b({ leadId: "b", valueCents: 85_550, eventDate: "2027-05-01" })], 300);
    expect(s[0]).toMatchObject({ month: "2027-05", bookedValueCents: 5_566_610, commissionCents: 164_432 + 2_567, withoutValue: 0 });
    expect(s[0]!.lines.map((l) => l.leadId)).toEqual(["b", "a"]);
  });

  it("0% during the pilot: nothing owed", () => {
    expect(monthlyStatements([b({})], 0)[0]!.commissionCents).toBe(0);
  });

  it("bookings without a value are listed but not charged", () => {
    const s = monthlyStatements([b({ leadId: "a", valueCents: null }), b({ leadId: "b", valueCents: 10_000 })], 500);
    expect(s[0]).toMatchObject({ bookedValueCents: 10_000, commissionCents: 500, withoutValue: 1 });
    expect(s[0]!.lines.find((l) => l.leadId === "a")!.commissionCents).toBeNull();
  });

  it("groups by event month, newest first", () => {
    const s = monthlyStatements([b({ leadId: "a", eventDate: "2027-05-22" }), b({ leadId: "b", eventDate: "2027-07-03" }), b({ leadId: "c", eventDate: "2027-05-29" })], 100);
    expect(s.map((m) => m.month)).toEqual(["2027-07", "2027-05"]);
  });
});

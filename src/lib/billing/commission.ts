import { applyBps, sumCents, type Bps, type Cents } from "@/lib/money";

/** bookings/{leadId}. Mirrors firestore.rules. */
export type BookingStatus = "claimed" | "confirmed" | "disputed";

export interface Booking {
  leadId: string;
  vendorUid: string;
  /** null once the couple deleted their account (option B). */
  coupleUid: string | null;
  /** YYYY-MM-DD */
  eventDate: string;
  /** Optional: the booked value the vendor reports, in cents. */
  valueCents: Cents | null;
  status: BookingStatus;
}

export interface StatementLine {
  leadId: string;
  eventDate: string;
  valueCents: Cents | null;
  /** null when the vendor gave no value: nothing to compute. */
  commissionCents: Cents | null;
}

export interface MonthStatement {
  /** YYYY-MM of the confirmed booking's event date. */
  month: string;
  lines: StatementLine[];
  bookedValueCents: Cents;
  commissionCents: Cents;
  /** Confirmed bookings without a value: counted, not charged. */
  withoutValue: number;
}

/**
 * Monthly statement of platform-sourced bookings. Only bookings the couple
 * confirmed count; claimed and disputed ones are left out. Commission is
 * worked out per line (half-up to the cent, as everywhere else), then summed.
 * During the pilot the rate is 0 and nothing is charged.
 */
export function monthlyStatements(bookings: readonly Booking[], rate: Bps): MonthStatement[] {
  const byMonth = new Map<string, StatementLine[]>();
  for (const b of bookings) {
    if (b.status !== "confirmed") continue;
    const month = b.eventDate.slice(0, 7);
    const line: StatementLine = {
      leadId: b.leadId,
      eventDate: b.eventDate,
      valueCents: b.valueCents,
      commissionCents: b.valueCents === null ? null : applyBps(b.valueCents, rate),
    };
    byMonth.set(month, [...(byMonth.get(month) ?? []), line]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, lines]) => {
      const sorted = [...lines].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
      const valued = sorted.filter((l) => l.valueCents !== null);
      return {
        month,
        lines: sorted,
        bookedValueCents: sumCents(valued.map((l) => l.valueCents!)),
        commissionCents: sumCents(valued.map((l) => l.commissionCents!)),
        withoutValue: sorted.length - valued.length,
      };
    });
}

/**
 * What Aria notices about a plan without being asked: the estimate is over
 * the couple's budget, the plan or guest list is over the room's capacity,
 * or a vendor in the plan has marked the wedding date unavailable. Alerts
 * only describe; changing anything is always a separate, approved step.
 */
export type AriaAlert =
  | { kind: "overBudget"; overCents: number }
  | { kind: "overCapacity"; over: number; source: "plan" | "guests" }
  | { kind: "dateUnavailable"; vendors: string[] };

export function detectAlerts(input: {
  budgetCents: number | null;
  estimateCents: number | null;
  headcount: number;
  capacityMax: number | null;
  /** Seats on the couple's guest list, or null without one. */
  guestSeats: number | null;
  /** Names of the plan's vendors who blocked the wedding date. */
  unavailableVendors: string[];
}): AriaAlert[] {
  const out: AriaAlert[] = [];
  if (input.budgetCents !== null && input.estimateCents !== null && input.estimateCents > input.budgetCents) {
    out.push({ kind: "overBudget", overCents: input.estimateCents - input.budgetCents });
  }
  if (input.capacityMax !== null) {
    // The bigger of the two shortfalls; the plan's own count first when equal.
    const planOver = input.headcount - input.capacityMax;
    const guestOver = input.guestSeats !== null ? input.guestSeats - input.capacityMax : 0;
    if (planOver > 0 || guestOver > 0) out.push(guestOver > planOver ? { kind: "overCapacity", over: guestOver, source: "guests" } : { kind: "overCapacity", over: planOver, source: "plan" });
  }
  if (input.unavailableVendors.length) out.push({ kind: "dateUnavailable", vendors: [...new Set(input.unavailableVendors)] });
  return out;
}

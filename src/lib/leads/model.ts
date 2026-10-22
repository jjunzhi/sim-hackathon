import type { TierKey } from "@/lib/estimate/build";
import type { Estimate } from "@/lib/estimate/engine";
import { parseSelectionKey, type Plan } from "@/lib/plans/model";

/** leads/{id}: a couple asks one vendor to confirm its part of a plan. */
export interface Lead {
  coupleUid: string | null;
  vendorUid: string;
  venueOwnerUid: string;
  planId: string | null;
  venueId: string;
  venueName: string;
  vendorName: string;
  spaceId: string | null;
  spaceName: string;
  tierKey: TierKey | null;
  headcount: number;
  /** Only this vendor's selections, as requested. */
  selections: Record<string, number>;
  renders: Array<{ key: string; path: string; themeId: string; aspect: string }>;
  /** What the couple chose to share. null after the couple deletes their account. */
  contact: LeadContact | null;
  status: "new" | "confirmed" | "declined";
  confirmationId: string | null;
}

export interface LeadContact {
  name: string;
  /** Email or phone, as the couple typed it. */
  reachAt: string;
  eventDate: string;
  message: string;
}

export const LEAD_LIMITS = { nameMax: 80, reachAtMax: 120, eventDateMax: 20, messageMax: 1000 } as const;

/** confirmations/{leadId}: immutable once written (rules refuse any change). */
export interface Confirmation {
  leadId: string;
  vendorUid: string;
  coupleUid: string | null;
  planId: string | null;
  vendorName: string;
  venueName: string;
  spaceName: string;
  tierKey: TierKey | null;
  headcount: number;
  /** Every line, rate and total exactly as confirmed. */
  snapshot: Estimate;
  engineVersion: string;
  /** Vendor uid; rules require it to be the writer. */
  confirmedBy: string;
  confirmedByName: string;
  note: string;
  /** Server time of confirmation. */
  confirmedAt: { toMillis(): number };
  validUntil: { toMillis(): number };
}

export const ENGINE_VERSION = "1";
export const VALIDITY = { defaultDays: 14, minDays: 1, maxDays: 90 } as const;

/** The selections in a plan that belong to one vendor. */
export function selectionsForVendor(selections: Plan["selections"], vendorUid: string): Record<string, number> {
  return Object.fromEntries(Object.entries(selections).filter(([k]) => parseSelectionKey(k)?.vendorUid === vendorUid));
}

/** End of the day (23:59:59.999 Singapore time) `days` from `now`. */
export function validUntilFrom(now: Date, days: number): Date {
  const sgDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date(now.getTime() + days * 86_400_000));
  // Singapore is UTC+8 all year (no daylight saving).
  return new Date(`${sgDate}T23:59:59.999+08:00`);
}

/** "2026-11-05" (Singapore date) for a date input. */
export function sgDateInput(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(d);
}

export function isExpired(validUntilMs: number, now: Date): boolean {
  return now.getTime() > validUntilMs;
}

/** Did the couple change this vendor's part of the plan since asking? */
export function planChangedSince(lead: Pick<Lead, "headcount" | "tierKey" | "spaceId" | "selections">, plan: Pick<Plan, "headcount" | "tierKey" | "spaceId" | "selections">, vendorUid: string, isVenue: boolean): boolean {
  if (lead.headcount !== plan.headcount) return true;
  if (isVenue && (lead.tierKey !== plan.tierKey || lead.spaceId !== plan.spaceId)) return true;
  const a = selectionsForVendor(plan.selections, vendorUid);
  const b = lead.selections;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return true;
  return false;
}

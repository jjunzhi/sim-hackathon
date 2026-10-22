/** Render limits. Defaults here; an admin can override them in config/renderLimits. */
export interface RenderLimits {
  userPerDay: number;
  userPerMonth: number;
  vendorPerMonth: number;
  globalPerDay: number;
}

export const DEFAULT_LIMITS: RenderLimits = {
  userPerDay: 10,
  userPerMonth: 40,
  vendorPerMonth: 300,
  globalPerDay: 200,
};

/** Merge an admin override, ignoring anything that isn't a sensible whole number. */
export function resolveLimits(override: unknown): RenderLimits {
  const o = (override ?? {}) as Partial<Record<keyof RenderLimits, unknown>>;
  const pick = (k: keyof RenderLimits) => {
    const v = o[k];
    return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : DEFAULT_LIMITS[k];
  };
  return { userPerDay: pick("userPerDay"), userPerMonth: pick("userPerMonth"), vendorPerMonth: pick("vendorPerMonth"), globalPerDay: pick("globalPerDay") };
}

/** Day and month in Singapore time, so limits reset at local midnight. */
export function periodKeys(now: Date): { day: string; month: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const month = `${get("year")}-${get("month")}`;
  return { day: `${month}-${get("day")}`, month };
}

/** Usage counter document ids. The uid is opaque; no names or emails. */
export function counterIds(uid: string, vendorUid: string, now: Date) {
  const { day, month } = periodKeys(now);
  return {
    userDay: `user_${uid}_${day}`,
    userMonth: `user_${uid}_${month}`,
    vendorMonth: `vendor_${vendorUid}_${month}`,
    globalDay: `global_${day}`,
  };
}

export type LimitName = "userPerDay" | "userPerMonth" | "vendorPerMonth" | "globalPerDay";

/** Which limit (if any) the next render would break. Checked in the order people can act on. */
export function firstExceeded(
  counts: { userDay: number; userMonth: number; vendorMonth: number; globalDay: number },
  limits: RenderLimits,
): LimitName | null {
  if (counts.userDay >= limits.userPerDay) return "userPerDay";
  if (counts.userMonth >= limits.userPerMonth) return "userPerMonth";
  if (counts.vendorMonth >= limits.vendorPerMonth) return "vendorPerMonth";
  if (counts.globalDay >= limits.globalPerDay) return "globalPerDay";
  return null;
}

export const LIMIT_MESSAGES: Record<LimitName, string> = {
  userPerDay: "You've reached today's render limit. You can render again tomorrow, and saved renders are still here.",
  userPerMonth: "You've reached this month's render limit. Saved renders are still here.",
  vendorPerMonth: "This venue has reached its render limit for the month. Please try again next month or contact the vendor.",
  globalPerDay: "We're very busy right now. Please try rendering again later today.",
};

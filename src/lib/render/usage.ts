/** Mirrors functions/src/render/quota.ts (Singapore day and month); a test keeps them equal. */
export function usageDocIds(uid: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const month = `${get("year")}-${get("month")}`;
  return { userDay: `user_${uid}_${month}-${get("day")}`, userMonth: `user_${uid}_${month}`, vendorMonth: `vendor_${uid}_${month}` };
}

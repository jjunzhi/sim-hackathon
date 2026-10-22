/**
 * The planning assistant may only SUGGEST changes; the couple applies them.
 * Everything the model proposes is checked here against the venue's real
 * rooms, tiers, themes and inventory. Anything that doesn't match is dropped,
 * never "fixed up", so the assistant can't invent rooms, items or prices.
 */
import { THEMES } from "../render/themes.js";

export type { Brief, Change, ContextOption, ContextSpace, ContextVenue, PlanSnapshot, Proposal, ShortlistEntry, TierKey, TimelineEntry, VenueContext } from "./types.js";
import { BRIEF_DIET_TAGS, BRIEF_LIMITS, BRIEF_TRADITIONS, EMPTY_BRIEF } from "./types.js";
import type { Brief, Change, ContextSpace, PlanSnapshot, Proposal, ShortlistEntry, TierKey, TimelineEntry, VenueContext } from "./types.js";
export { applyChanges } from "./types.js";

export const LIMITS = {
  headcountMax: 7000,
  quantityMax: 999,
  summaryMax: 400,
  changesMax: 20,
  labelMax: 40,
  optionsMax: 3,
  shortlistMax: 8,
  reasonMax: 200,
} as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
function isIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

const tierKeysOf = (s: ContextSpace) => (Object.keys(s.tiers) as TierKey[]).filter((k) => s.tiers[k]);

/** Turns the model's raw function arguments into checked changes. */
export function validateProposal(raw: unknown, ctx: VenueContext, plan: PlanSnapshot): Proposal {
  const a = (raw ?? {}) as Record<string, unknown>;
  const dropped: string[] = [];
  const changes: Change[] = [];
  const summary = typeof a.summary === "string" ? a.summary.trim().slice(0, LIMITS.summaryMax) : "";
  const label = typeof a.label === "string" ? a.label.trim().slice(0, LIMITS.labelMax) : "";

  // Room first: tier validity depends on it.
  let space = ctx.spaces.find((s) => s.id === plan.spaceId) ?? null;
  if (typeof a.spaceId === "string" && a.spaceId !== plan.spaceId) {
    const next = ctx.spaces.find((s) => s.id === a.spaceId);
    if (next) {
      space = next;
      const keys = tierKeysOf(next);
      const wanted = typeof a.tierKey === "string" && keys.includes(a.tierKey as TierKey) ? (a.tierKey as TierKey) : null;
      changes.push({ kind: "space", spaceId: next.id, tierKey: wanted ?? (plan.tierKey && keys.includes(plan.tierKey) ? plan.tierKey : (keys[0] ?? null)) });
    } else dropped.push(`unknown room ${String(a.spaceId)}`);
  } else if (typeof a.tierKey === "string" && a.tierKey !== plan.tierKey) {
    if (space && tierKeysOf(space).includes(a.tierKey as TierKey)) changes.push({ kind: "tier", tierKey: a.tierKey as TierKey });
    else dropped.push(`tier ${a.tierKey} not offered for this room`);
  }

  if (a.headcount !== undefined && a.headcount !== null) {
    const n = Number(a.headcount);
    if (Number.isInteger(n) && n >= 1 && n <= LIMITS.headcountMax) {
      if (n !== plan.headcount) changes.push({ kind: "headcount", value: n });
    } else dropped.push(`headcount ${String(a.headcount)}`);
  }

  if (typeof a.themeId === "string" && a.themeId !== plan.themeId) {
    if (THEMES.some((t) => t.id === a.themeId)) changes.push({ kind: "theme", themeId: a.themeId });
    else dropped.push(`unknown theme ${a.themeId}`);
  }

  if (typeof a.weddingDate === "string") {
    const v = a.weddingDate.trim();
    if (v === "") {
      if (plan.weddingDate) changes.push({ kind: "date", value: null });
    } else if (isIsoDate(v)) {
      if (v !== plan.weddingDate) changes.push({ kind: "date", value: v });
    } else dropped.push(`date ${v}`);
  }

  const byKey = new Map(ctx.options.map((o) => [o.key, o]));
  const removing = new Set<string>();
  if (Array.isArray(a.remove)) {
    for (const k of a.remove) {
      if (typeof k === "string" && plan.selections[k] !== undefined && !removing.has(k)) {
        removing.add(k);
        changes.push({ kind: "remove", key: k });
      } else dropped.push(`remove ${String(k)}`);
    }
  }
  if (Array.isArray(a.add)) {
    const seen = new Set<string>();
    for (const entry of a.add) {
      const e = (entry ?? {}) as Record<string, unknown>;
      const key = typeof e.ref === "string" ? e.ref : typeof e.key === "string" ? e.key : "";
      const option = byKey.get(key);
      if (!option || seen.has(key) || removing.has(key)) {
        dropped.push(`add ${key || "?"}`);
        continue;
      }
      seen.add(key);
      // Only per-piece choices carry a quantity; per-table and per-guest are always 1.
      const q = option.unit === "piece" ? Math.trunc(Number(e.quantity ?? 1)) : 1;
      if (!(q >= 1 && q <= LIMITS.quantityMax)) {
        dropped.push(`quantity for ${key}`);
        continue;
      }
      if (plan.selections[key] === q) continue; // already exactly so
      changes.push({ kind: "add", key, quantity: q });
    }
  }

  if (a.budget !== undefined && a.budget !== null) {
    // The model speaks in whole dollars; the plan stores integer cents.
    const dollars = Number(a.budget);
    const cents = dollars * 100;
    if (Number.isInteger(dollars) && cents >= 100 && cents <= BRIEF_LIMITS.budgetMaxCents) {
      if (cents !== plan.budgetCents) changes.push({ kind: "budget", cents });
    } else dropped.push(`budget ${String(a.budget)}`);
  }

  const brief = mergeBrief(plan.brief, a, dropped);
  if (brief) changes.push({ kind: "brief", brief });

  if (Array.isArray(a.timeline)) {
    const entries = cleanTimeline(a.timeline, dropped);
    if (entries.length && JSON.stringify(entries) !== JSON.stringify(plan.timeline)) changes.push({ kind: "timeline", entries });
  }

  return { label, summary, changes: changes.slice(0, LIMITS.changesMax), dropped };
}

const BRIEF_FIELDS = ["style", "traditions", "dietaryTags", "stepFree", "notes"] as const;

/** The brief after the model's suggested fields, or null when nothing (valid) changes. */
export function mergeBrief(current: Brief | null, a: Record<string, unknown>, dropped: string[]): Brief | null {
  if (!BRIEF_FIELDS.some((f) => a[f] !== undefined && a[f] !== null)) return null;
  const base = current ?? EMPTY_BRIEF;
  const next: Brief = { ...base, traditions: [...base.traditions], dietaryTags: [...base.dietaryTags] };
  if (typeof a.style === "string") next.style = a.style.trim().slice(0, BRIEF_LIMITS.styleMax);
  if (typeof a.notes === "string") next.notes = a.notes.trim().slice(0, BRIEF_LIMITS.notesMax);
  if (typeof a.stepFree === "boolean") next.stepFree = a.stepFree;
  const pick = (v: unknown, allowed: readonly string[], what: string) => {
    if (!Array.isArray(v)) return null;
    const out: string[] = [];
    for (const x of v) {
      if (typeof x === "string" && allowed.includes(x)) {
        if (!out.includes(x)) out.push(x);
      } else dropped.push(`${what} ${String(x)}`);
    }
    return out;
  };
  next.traditions = pick(a.traditions, BRIEF_TRADITIONS, "tradition") ?? next.traditions;
  next.dietaryTags = pick(a.dietaryTags, BRIEF_DIET_TAGS, "diet") ?? next.dietaryTags;
  return JSON.stringify(next) === JSON.stringify(base) && current !== null ? null : next;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valid "HH:MM" lines with a short label, in time order, at most 15. */
export function cleanTimeline(raw: unknown[], dropped: string[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const r of raw) {
    const e = (r ?? {}) as Record<string, unknown>;
    const time = typeof e.time === "string" ? e.time.trim() : "";
    const label = typeof e.label === "string" ? e.label.trim().slice(0, BRIEF_LIMITS.timelineLabelMax) : "";
    if (HHMM.test(time) && label) out.push({ time, label });
    else dropped.push(`timeline ${time || "?"}`);
  }
  return out.sort((x, y) => x.time.localeCompare(y.time)).slice(0, BRIEF_LIMITS.timelineEntries);
}

/** Keeps only listed venues, once each, with a short reason. */
export function validateShortlist(raw: unknown, ctx: VenueContext): ShortlistEntry[] {
  const a = (raw ?? {}) as Record<string, unknown>;
  const venues = new Map((ctx.venues ?? []).map((v) => [v.id, v]));
  const out: ShortlistEntry[] = [];
  for (const entry of Array.isArray(a.venues) ? a.venues : []) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const v = typeof e.venueId === "string" ? venues.get(e.venueId) : undefined;
    if (!v || out.some((o) => o.venueId === v.id)) continue;
    const reason = typeof e.reason === "string" ? e.reason.trim().slice(0, LIMITS.reasonMax) : "";
    out.push({ venueId: v.id, venueName: v.name, reason });
    if (out.length >= LIMITS.shortlistMax) break;
  }
  return out;
}

/**
 * The planning assistant may only SUGGEST changes; the couple applies them.
 * Everything the model proposes is checked here against the venue's real
 * rooms, tiers, themes and inventory. Anything that doesn't match is dropped,
 * never "fixed up", so the assistant can't invent rooms, items or prices.
 */
import { THEMES } from "../render/themes.js";

export type { Change, ContextOption, ContextSpace, PlanSnapshot, Proposal, TierKey, VenueContext } from "./types.js";
import type { Change, ContextSpace, PlanSnapshot, Proposal, TierKey, VenueContext } from "./types.js";
export { applyChanges } from "./types.js";

export const LIMITS = {
  headcountMax: 7000,
  quantityMax: 999,
  summaryMax: 400,
  changesMax: 20,
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

  return { summary, changes: changes.slice(0, LIMITS.changesMax), dropped };
}

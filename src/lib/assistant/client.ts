"use client";

import { httpsCallable } from "firebase/functions";
import { callableCode, callableMessage } from "@/lib/firebase/callable-error";
import { getFirebase } from "@/lib/firebase/client";
import type { Locale } from "@/lib/i18n/locales";
import type { PlanDraft } from "@/lib/plans/model";
import { parseSelectionKey } from "@/lib/plans/model";
import type { VendorCatalog } from "@/lib/plans/estimates";
import type { Change, PlanSnapshot, Proposal, VenueContext } from "../../../functions/src/assistant/types";
import { applyChanges } from "../../../functions/src/assistant/types";

export type { Change, Proposal };

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  proposal?: Proposal | null;
  /** Set once the couple applied or set aside this message's suggestion. */
  settled?: "applied" | "dismissed";
  demo?: boolean;
}

export type AssistantError = { kind: "limit" | "failed" | "signed-out"; message: string };

const MAX_HISTORY = 12;

export const toSnapshot = (p: PlanDraft): PlanSnapshot => ({
  headcount: p.headcount,
  spaceId: p.spaceId,
  tierKey: p.tierKey,
  themeId: p.themeId,
  weddingDate: p.weddingDate ?? null,
  selections: p.selections,
});

/** One turn with the planning assistant. Only the last few messages are sent, and nothing is stored. */
export async function askAssistant(args: {
  venueId: string;
  plan: PlanDraft;
  history: ChatMessage[];
  locale: Locale;
  estimateTotalCents: number | null;
}): Promise<{ ok: true; reply: string; proposal: Proposal | null; demo: boolean; remainingToday: number } | { ok: false; error: AssistantError }> {
  const messages = args.history.slice(-MAX_HISTORY).map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
  try {
    const call = httpsCallable<unknown, { reply: string; proposal: Proposal | null; demo: boolean; remainingToday: number }>(getFirebase().functions, "planAssistant", {
      timeout: 60_000,
    });
    const res = await call({ venueId: args.venueId, plan: toSnapshot(args.plan), messages, locale: args.locale, estimateTotalCents: args.estimateTotalCents });
    return { ok: true, ...res.data };
  } catch (err) {
    const code = callableCode(err);
    if (code === "resource-exhausted") return { ok: false, error: { kind: "limit", message: callableMessage(err) } };
    if (code === "unauthenticated") return { ok: false, error: { kind: "signed-out", message: callableMessage(err) } };
    return { ok: false, error: { kind: "failed", message: "" } };
  }
}

/** The client's view of the choices, enough for Apply (packages replace their items) and for naming changes. */
export function optionIndex(catalogs: VendorCatalog[]): VenueContext["options"] {
  const out: VenueContext["options"] = [];
  for (const c of catalogs) {
    for (const i of c.items) out.push({ key: `item:${c.uid}:${i.id}`, vendorName: c.profile.businessName, name: i.name, category: i.category, unit: i.unit, priceCents: i.priceCents, dietaryTags: i.dietaryTags ?? [], includes: [] });
    for (const p of c.packages)
      out.push({ key: `package:${c.uid}:${p.id}`, vendorName: c.profile.businessName, name: p.name, category: "Package", unit: p.unit, priceCents: p.priceCents, dietaryTags: [], includes: p.itemIds.map((id) => `item:${c.uid}:${id}`) });
  }
  return out;
}

/** The plan after a suggestion, using the same Apply step the server's tests check. */
export function applyProposal(plan: PlanDraft, changes: Change[], catalogs: VendorCatalog[]): PlanDraft {
  const next = applyChanges(toSnapshot(plan), changes, { venueId: plan.venueId, venueName: "", spaces: [], options: optionIndex(catalogs) });
  return { ...plan, ...next };
}

export const nameOfKey = (key: string, catalogs: VendorCatalog[]) => {
  const sel = parseSelectionKey(key);
  const cat = sel && catalogs.find((c) => c.uid === sel.vendorUid);
  if (!sel || !cat) return key;
  return sel.kind === "item" ? (cat.items.find((i) => i.id === sel.id)?.name ?? key) : (cat.packages.find((p) => p.id === sel.id)?.name ?? key);
};

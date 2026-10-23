"use client";

import { httpsCallable } from "firebase/functions";
import { callableCode, callableMessage } from "@/lib/firebase/callable-error";
import { getFirebase } from "@/lib/firebase/client";
import { ensureVisitorSession } from "@/lib/data/shares";
import type { Locale } from "@/lib/i18n/locales";
import type { PlanDraft } from "@/lib/plans/model";
import { THEME_OPTIONS } from "@/lib/render/themes";
import type { PlannerResult, PlanStart, ShortlistEntry, VendorPick } from "../../../functions/src/assistant/types";

export type { PlanStart, ShortlistEntry, VendorPick };

/** One message in Aria's planner chat. Kept in the page only; never stored. */
export interface PlannerMessage {
  role: "user" | "model";
  text: string;
  shortlist?: ShortlistEntry[];
  vendors?: VendorPick[];
  plans?: PlanStart[];
  demo?: boolean;
}

export type PlannerAnswer = { ok: true; result: Omit<PlannerResult, "reply"> & { reply: string } } | { ok: false; kind: "limit" | "failed"; message: string };

/**
 * One turn with Aria the planner. Anyone can chat: a visitor without an
 * account gets a guest session (anonymous sign-in) with a smaller daily
 * allowance. Only the last 12 messages are sent.
 */
export async function askPlanner(history: PlannerMessage[], locale: Locale): Promise<PlannerAnswer> {
  try {
    await ensureVisitorSession();
    const call = httpsCallable<unknown, PlannerResult>(getFirebase().functions, "ariaChat", { timeout: 60_000 });
    const res = await call({ messages: history.slice(-12).map((m) => ({ role: m.role, text: m.text.slice(0, 2000) })), locale });
    return { ok: true, result: { ...res.data, shortlist: res.data.shortlist ?? [], vendors: res.data.vendors ?? [], plans: res.data.plans ?? [] } };
  } catch (err) {
    if (callableCode(err) === "resource-exhausted") return { ok: false, kind: "limit", message: callableMessage(err) };
    return { ok: false, kind: "failed", message: "" };
  }
}

/** The Studio draft for a plan Aria suggested starting. The Studio saves it (or asks the visitor to sign up first). */
export function draftFromStart(start: PlanStart, name: string): PlanDraft {
  return {
    name,
    venueId: start.venueId,
    spaceId: start.spaceId,
    tierKey: start.tierKey,
    headcount: start.headcount ?? 100,
    themeId: start.themeId ?? THEME_OPTIONS[0].value,
    selections: start.selections,
    savedRenders: [],
    weddingDate: start.weddingDate,
    budgetCents: start.budgetCents,
    brief: start.brief,
    timeline: [],
  };
}

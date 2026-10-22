import type { TierKey } from "@/lib/estimate/build";

/** A couple's saved plan: projects/{id}. Owner-only; mirrors firestore.rules. */
export interface Plan {
  ownerUid: string;
  name: string;
  venueId: string;
  spaceId: string | null;
  tierKey: TierKey | null;
  headcount: number;
  themeId: string;
  /** Keys from selectionKey(); value is the quantity (per-piece only, otherwise 1). */
  selections: Record<string, number>;
  savedRenders: SavedRender[];
}

export interface SavedRender {
  key: string;
  path: string;
  themeId: string;
  demo: boolean;
  savedAt: string;
}

export const PLAN_LIMITS = {
  plansPerCouple: 10,
  savedRenders: 6,
  selections: 60,
  nameMax: 80,
} as const;

export type PlanDraft = Omit<Plan, "ownerUid">;

/** "item:<vendorUid>:<id>" / "package:<vendorUid>:<id>". Firestore ids never contain ":". */
export function selectionKey(kind: "item" | "package", vendorUid: string, id: string): string {
  return `${kind}:${vendorUid}:${id}`;
}

export function parseSelectionKey(key: string): { kind: "item" | "package"; vendorUid: string; id: string } | null {
  const [kind, vendorUid, id, ...rest] = key.split(":");
  if (rest.length || !vendorUid || !id || (kind !== "item" && kind !== "package")) return null;
  return { kind, vendorUid, id };
}

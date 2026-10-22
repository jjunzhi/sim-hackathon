import type { Cents } from "@/lib/money";

/** shares/{shareId}: a family link. The unguessable id is the only key to it. */
export interface ShareOption {
  planId: string;
  planName: string;
  venueName: string;
  renderKey: string;
  renderPath: string;
  themeId: string;
  demo: boolean;
  /** Width / height of the room photo, for a stable frame. */
  aspect: string;
  /** The plan's estimate total when the link was made. Always shown as an Estimate. */
  estimateTotalCents: Cents;
}

export interface Share {
  ownerUid: string;
  title: string;
  status: "active" | "revoked";
  /** 2 or 3 while active; cleared when revoked so nothing is left to see. */
  options: ShareOption[];
}

export interface Vote {
  optionIndex: number;
  name: string;
  note: string;
}

export const SHARE_LIMITS = { titleMax: 80, nameMax: 40, noteMax: 280, minOptions: 2, maxOptions: 3 } as const;

/** 128 random bits, base64url: 22 characters nobody can guess. */
export function newShareId(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(16));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface OptionResult {
  index: number;
  count: number;
  /** Whole percentages that always add up to 100 (largest remainder). */
  pct: number;
}

export interface VoteResults {
  total: number;
  options: OptionResult[];
  leaders: number[];
  /** "agree" when one option has at least AGREEMENT_THRESHOLD of votes. */
  summary: "none" | "agree" | "split";
}

/** Share of votes that counts as "most of your family agree". */
export const AGREEMENT_THRESHOLD = 0.7;

/** Computed only from real votes. */
export function computeResults(votes: Pick<Vote, "optionIndex">[], optionCount: number): VoteResults {
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const v of votes) if (Number.isInteger(v.optionIndex) && v.optionIndex >= 0 && v.optionIndex < optionCount) counts[v.optionIndex]!++;
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return { total, options: counts.map((count, index) => ({ index, count, pct: 0 })), leaders: [], summary: "none" };

  // Largest remainder so displayed percentages add to exactly 100.
  const exact = counts.map((c) => (c * 100) / total);
  const pct = exact.map(Math.floor);
  let left = 100 - pct.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    pct[i]!++;
    left--;
  }

  const max = Math.max(...counts);
  const leaders = counts.flatMap((c, i) => (c === max ? [i] : []));
  const summary = leaders.length === 1 && max / total >= AGREEMENT_THRESHOLD ? "agree" : "split";
  return { total, options: counts.map((count, index) => ({ index, count, pct: pct[index]! })), leaders, summary };
}

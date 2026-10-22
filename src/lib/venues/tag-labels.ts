import type { TKey } from "@/lib/i18n/dictionaries/types";
import type { Vars } from "@/lib/i18n/format";

type T = (key: TKey, vars?: Vars) => string;

/** Stored tag value (STYLE_TAGS / CULTURE_TAGS in ./model.ts) → dictionary key. Values in Firestore stay English. */
const TAG_KEYS: Record<string, TKey> = {
  Garden: "tag.garden",
  Ballroom: "tag.ballroom",
  Rooftop: "tag.rooftop",
  Heritage: "tag.heritage",
  Beach: "tag.beach",
  Industrial: "tag.industrial",
  Intimate: "tag.intimate",
  Waterfront: "tag.waterfront",
  Chinese: "tag.chinese",
  Malay: "tag.malay",
  Indian: "tag.indian",
  Peranakan: "tag.peranakan",
  Western: "tag.western",
  Fusion: "tag.fusion",
  "Halal-friendly": "tag.halalFriendly",
};

export function tagKey(value: string): TKey | null {
  return TAG_KEYS[value] ?? null;
}

/** Display label for a stored tag; unknown values show as stored. */
export function tagLabel(t: T, value: string): string {
  const key = tagKey(value);
  return key ? t(key) : value;
}

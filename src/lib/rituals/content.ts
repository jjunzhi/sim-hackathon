/**
 * Ritual checklists: DRAFT CONTENT, PENDING COMMUNITY REVIEW.
 *
 * Only the structure lives here (ids and groups). The wording is in the
 * dictionaries under "ritual.<checklist>.<item>" so it can be translated and
 * so reviewers can correct one file per language. Nothing here is advice on
 * what a family must do: every list says practices vary, and couples add
 * their own items. The ids are stable because tick state is keyed by them.
 */
export interface RitualGroup {
  id: string;
  items: readonly string[];
}

export interface Ritual {
  id: string;
  groups: readonly RitualGroup[];
}

export const RITUALS: readonly Ritual[] = [
  {
    id: "tea",
    groups: [
      { id: "before", items: ["order", "elders", "teaset", "tea", "cushions", "gifts", "helper", "photos", "combing"] },
      { id: "day", items: ["sequence", "address", "hands", "receive", "keeper", "refill"] },
    ],
  },
  {
    id: "nikah",
    groups: [
      { id: "before", items: ["romm", "course", "wali", "witnesses", "kadi", "maskahwin", "hantaran", "pelamin", "andam", "doorgifts", "kompang", "merenjis"] },
      { id: "day", items: ["akad", "signing", "bersanding", "renjis", "beradab", "gifts"] },
    ],
  },
  {
    id: "vivaha",
    groups: [
      { id: "before", items: ["priest", "muhurtham", "mandap", "fire", "thali", "garlands", "attire", "mehndi", "haldi", "sangeetvenue", "music", "food"] },
      { id: "day", items: ["welcome", "puja", "kanyadaanam", "thalitying", "saptapadi", "aarti", "reception"] },
    ],
  },
  {
    id: "rom",
    groups: [
      { id: "before", items: ["notice", "verification", "witnesses", "solemniser", "venue", "rings", "vows", "documents"] },
      { id: "day", items: ["arrive", "identity", "declaration", "sign", "certificate", "celebrate"] },
    ],
  },
];

export const RITUAL_LIMITS = {
  /** Custom items a couple may add per checklist. */
  customPerChecklist: 30,
  customTextMax: 120,
} as const;

export const tickKey = (ritualId: string, itemId: string) => `${ritualId}.${itemId}`;

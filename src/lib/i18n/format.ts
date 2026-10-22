/**
 * Message formatting without a library: `{name}` placeholders, and plural
 * forms chosen with Intl.PluralRules from sibling keys `key_one` / `key_other`
 * (plus `key_zero`, `key_two`, `key_few`, `key_many` where a language needs them).
 */
export type Vars = Record<string, string | number>;

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const rulesCache = new Map<string, Intl.PluralRules>();
export function pluralCategory(lang: string, n: number): Intl.LDMLPluralRule {
  let r = rulesCache.get(lang);
  if (!r) {
    r = new Intl.PluralRules(lang);
    rulesCache.set(lang, r);
  }
  return r.select(n);
}

/**
 * Look a key up, resolving plural forms when `vars.count` is a number and the
 * dictionary has `key_other`. Missing keys fall back to the fallback dictionary,
 * then to the key itself (visible, so it gets fixed).
 */
export function lookup(strings: Record<string, string>, fallback: Record<string, string>, lang: string, key: string, vars?: Vars): string {
  const count = vars?.count;
  if (typeof count === "number" && (strings[`${key}_other`] !== undefined || fallback[`${key}_other`] !== undefined)) {
    const cat = pluralCategory(lang, count);
    const exact = `${key}_${cat}`;
    const template = strings[exact] ?? strings[`${key}_other`] ?? fallback[exact] ?? fallback[`${key}_other`] ?? key;
    return interpolate(template, vars);
  }
  return interpolate(strings[key] ?? fallback[key] ?? key, vars);
}

/** Dates in the reader's language, Singapore time. */
export function formatDate(lang: string, ms: number, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return new Intl.DateTimeFormat(lang, { timeZone: "Asia/Singapore", ...opts }).format(new Date(ms));
}

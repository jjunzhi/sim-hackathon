/** The four official languages of Singapore. `lang` is what goes on <html>. */
export const LOCALES = [
  { code: "en", lang: "en-SG", label: "English" },
  { code: "zh", lang: "zh-Hans-SG", label: "中文" },
  { code: "ms", lang: "ms-SG", label: "Bahasa Melayu" },
  { code: "ta", lang: "ta-SG", label: "தமிழ்" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "wv-locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && LOCALES.some((l) => l.code === v);
}

export function langTag(locale: Locale): string {
  return LOCALES.find((l) => l.code === locale)!.lang;
}

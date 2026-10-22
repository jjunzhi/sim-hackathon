"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { en } from "./dictionaries/en";
import type { Dictionary, LocaleFile, TKey } from "./dictionaries/types";
import { formatDate, lookup, type Vars } from "./format";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, langTag, type Locale } from "./locales";

const loaders: Record<Exclude<Locale, "en">, () => Promise<{ default: LocaleFile }>> = {
  zh: () => import("./dictionaries/zh"),
  ms: () => import("./dictionaries/ms"),
  ta: () => import("./dictionaries/ta"),
};

interface LocaleContextValue {
  locale: Locale;
  /** BCP 47 tag for Intl and <html lang>. */
  lang: string;
  /** True while a non-English dictionary is still marked "draft". */
  draft: boolean;
  setLocale: (l: Locale) => void;
  t: (key: TKey, vars?: Vars) => string;
  date: (ms: number, opts?: Intl.DateTimeFormatOptions) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function readStoredLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

// The chosen language is an external store: localStorage, plus an in-memory
// fallback for when storage is blocked. Other tabs follow via "storage" events.
let memoryLocale: Locale | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => e.key === LOCALE_STORAGE_KEY && onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = (): Locale => readStoredLocale() ?? memoryLocale ?? DEFAULT_LOCALE;
// The server (and the first client paint) always renders English, so hydration matches.
const getServerSnapshot = (): Locale => DEFAULT_LOCALE;

function storeLocale(l: Locale) {
  memoryLocale = l;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, l);
  } catch {
    // Private mode: the choice lasts for this page only (memoryLocale).
  }
  notify();
}

/**
 * The reader's language. English renders at once; other dictionaries load on
 * demand. The choice is kept in localStorage and mirrored to <html lang> and
 * data-locale (which switches to fonts that cover the script).
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [loaded, setLoaded] = useState<Partial<Record<Locale, LocaleFile>>>({ en: { status: "reviewed", strings: en } });

  useEffect(() => {
    document.documentElement.lang = langTag(locale);
    document.documentElement.dataset.locale = locale;
    if (locale === "en" || loaded[locale]) return;
    let cancelled = false;
    loaders[locale]().then((m) => {
      if (!cancelled) setLoaded((prev) => ({ ...prev, [locale]: m.default }));
    });
    return () => {
      cancelled = true;
    };
  }, [locale, loaded]);

  const setLocale = useCallback((l: Locale) => storeLocale(l), []);

  const value = useMemo<LocaleContextValue>(() => {
    const file = loaded[locale];
    const strings: Dictionary = file?.strings ?? en;
    const lang = langTag(locale);
    return {
      locale,
      lang,
      draft: locale !== "en" && (file?.status ?? "draft") === "draft",
      setLocale,
      t: (key, vars) => lookup(strings, en, lang, key, vars),
      date: (ms, opts) => formatDate(lang, ms, opts),
    };
  }, [locale, loaded, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale needs LocaleProvider");
  return ctx;
}

/** Shorthand for components that only read strings. */
export function useT() {
  return useLocale().t;
}

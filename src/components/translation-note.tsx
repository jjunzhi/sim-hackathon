"use client";

import { useLocale } from "@/lib/i18n/provider";

/** One line under the header while a language is still a draft. Nothing in English. */
export function TranslationNote() {
  const { draft, t } = useLocale();
  if (!draft) return null;
  return (
    <p role="note" className="border-b border-line bg-subtle">
      <span className="container-page block py-2 text-small text-muted">{t("lang.draftNote")}</span>
    </p>
  );
}

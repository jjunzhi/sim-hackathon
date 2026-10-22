"use client";

import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import type { TKey } from "@/lib/i18n/dictionaries/types";
import { useT } from "@/lib/i18n/provider";

/** Only what the software really does. Nothing here promises people, services or payments. */
const INCLUDED: TKey[] = [
  "rose.f.aria",
  "rose.f.brief",
  "rose.f.approve",
  "rose.f.shortlist",
  "rose.f.estimates",
  "rose.f.renders",
  "rose.f.timeline",
  "rose.f.log",
  "rose.f.guests",
  "rose.f.family",
  "rose.f.requests",
  "rose.f.checklists",
];
const NOT_DONE: TKey[] = ["rose.not.payments", "rose.not.booking", "rose.not.guests"];

/** Rose Garden: the single couple plan, free during the pilot. */
export function RoseGarden() {
  const t = useT();
  return (
    <>
      <AppHeader />
      <main className="container-page flex max-w-3xl flex-col gap-8 py-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-h1">{t("rose.title")}</h1>
          <p className="text-h3 text-muted">{t("rose.tagline")}</p>
          <p className="w-fit rounded-full bg-accent-tint px-4 py-1.5 font-semibold text-accent-text">{t("rose.price")}</p>
          <p className="max-w-2xl">{t("rose.intro")}</p>
        </div>
        <section aria-labelledby="rose-included" className="flex flex-col gap-3">
          <h2 id="rose-included" className="text-h2">
            {t("rose.includedTitle")}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {INCLUDED.map((k) => (
              <li key={k} className="flex items-start gap-2 rounded-xl border border-line bg-surface p-3">
                <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="rose-not" className="flex flex-col gap-3">
          <h2 id="rose-not" className="text-h2">
            {t("rose.notTitle")}
          </h2>
          <ul className="flex flex-col gap-2">
            {NOT_DONE.map((k) => (
              <li key={k} className="flex items-start gap-2">
                <Minus aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
        </section>
        <Link
          href="/venues"
          className="inline-flex min-h-11 w-fit items-center rounded-full bg-accent px-6 font-semibold text-on-accent shadow-soft hover:bg-accent-hover"
        >
          {t("rose.cta")}
        </Link>
      </main>
    </>
  );
}

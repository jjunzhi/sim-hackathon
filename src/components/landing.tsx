"use client";

import Link from "next/link";
import { Calculator, Heart, MapPinned, Sparkles } from "lucide-react";
import { HeroCrossfade } from "@/components/hero-crossfade";
import { LanguageMenu } from "@/components/language-menu";
import { TranslationNote } from "@/components/translation-note";
import { useT } from "@/lib/i18n/provider";

/** Public landing page. */
export function Landing({ accountDeleted }: { accountDeleted: boolean }) {
  const t = useT();
  const steps = [
    { icon: MapPinned, title: t("landing.step1Title"), body: t("landing.step1Body") },
    { icon: Sparkles, title: t("landing.step2Title"), body: t("landing.step2Body") },
    { icon: Calculator, title: t("landing.step3Title"), body: t("landing.step3Body") },
    { icon: Heart, title: t("landing.step4Title"), body: t("landing.step4Body") },
  ];
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="container-page flex min-h-16 items-center justify-between gap-2 sm:gap-4">
          <span className="font-display text-h3 text-ink">WeddingVista</span>
          <nav aria-label={t("nav.main")} className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            <Link href="/venues" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-2 text-small font-semibold text-muted hover:text-ink sm:px-3">
              {t("nav.venues")}
            </Link>
            <Link href="/sign-in" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-2 text-small font-semibold text-muted hover:text-ink sm:px-3">
              {t("nav.signIn")}
            </Link>
            <LanguageMenu withAuth={false} />
          </nav>
        </div>
      </header>
      <TranslationNote />
      <main className="container-page flex flex-col gap-16 py-10 sm:py-16">
        {accountDeleted && (
          <p role="status" className="w-fit rounded-xl border border-success bg-surface px-4 py-3 text-small font-medium text-success">
            {t("landing.accountDeleted")}
          </p>
        )}
        <section className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,34rem)]">
          <div className="flex flex-col gap-6">
            <p className="text-small font-semibold uppercase tracking-widest text-accent-text">{t("landing.eyebrow")}</p>
            <h1 className="text-display">{t("landing.title")}</h1>
            <p className="max-w-xl text-body text-muted">{t("landing.lede")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/venues"
                className="inline-flex min-h-13 items-center rounded-full bg-accent px-7 font-semibold text-on-accent shadow-soft transition-colors hover:bg-accent-hover"
              >
                {t("landing.findVenue")}
              </Link>
              <Link href="/sign-up?role=vendor" className="inline-flex min-h-11 items-center px-3 font-semibold text-accent-text underline underline-offset-4">
                {t("landing.imVendor")}
              </Link>
            </div>
          </div>
          <HeroCrossfade />
        </section>

        <section aria-labelledby="how" className="flex flex-col gap-6">
          <h2 id="how" className="text-h2">
            {t("landing.howItWorks")}
          </h2>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5 shadow-soft">
                <span className="flex items-center gap-2 text-gold">
                  <Icon aria-hidden className="size-5" />
                  <span className="num text-small font-semibold text-muted">{t("common.step", { n: i + 1 })}</span>
                </span>
                <h3 className="text-h3">{title}</h3>
                <p className="text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-6 text-small text-muted">
          <span>{t("landing.footer")}</span>
          <Link href="/rose-garden" className="inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-4">
            {t("rose.link")}
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-4">
            {t("landing.privacy")}
          </Link>
        </div>
      </footer>
    </>
  );
}

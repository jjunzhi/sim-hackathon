"use client";

import Link from "next/link";
import { ArrowRight, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askPlanner, draftFromStart, type PlannerMessage, type PlanStart } from "@/lib/assistant/planner-client";
import { useAuth } from "@/lib/auth/auth-provider";
import { stashDraft } from "@/lib/data/plans";
import type { TKey } from "@/lib/i18n/dictionaries/types";
import { useLocale } from "@/lib/i18n/provider";
import { formatSGD } from "@/lib/money";
import { themeLabelT } from "@/lib/render/themes";
import { DIET_KEYS } from "@/lib/venues/inclusion";
import { tagLabel } from "@/lib/venues/tag-labels";
import { useAria } from "./aria-context";

const CHIPS: TKey[] = ["aria.chip1", "aria.chip2", "aria.chip3"];

/**
 * Aria as a wedding planner, before any plan exists. She recommends listed
 * venues and decorators; a suggested plan starts only when the couple taps
 * "Start planning here", which opens it in the Studio.
 */
export function AriaGeneral() {
  const { t, locale, date } = useLocale();
  const auth = useAuth();
  const router = useRouter();
  const { messages, setMessages } = useAria();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const body = useRef<HTMLDivElement>(null);
  const guest = auth.status !== "ready";

  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight });
  }, [messages, busy]);

  async function send(text: string) {
    text = text.trim();
    if (!text || busy) return;
    const mine: PlannerMessage = { role: "user", text };
    const history = [...messages, mine];
    setMessages((prev) => [...prev, mine]);
    setDraft("");
    setBusy(true);
    setError(null);
    const r = await askPlanner(history, locale);
    setBusy(false);
    if (!r.ok) {
      setError(r.kind === "limit" ? r.message : t("assistant.failed"));
      return;
    }
    setRemaining(r.result.remainingToday);
    setMessages((prev) => [...prev, { role: "model", text: r.result.reply, shortlist: r.result.shortlist, vendors: r.result.vendors, plans: r.result.plans, demo: r.result.demo }]);
  }

  function start(p: PlanStart) {
    stashDraft(draftFromStart(p, t("studio.defaultPlanName", { venue: p.venueName })));
    // The Studio picks up the stashed plan: it saves it for a signed-in couple, or asks a visitor to create an account.
    router.push(`/studio/${p.venueId}?resume=1`);
  }

  const showDemo = messages.some((m) => m.demo);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={body} role="log" aria-live="polite" aria-label={t("assistant.title")} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {showDemo && (
          <Badge tone="sample" className="self-start">
            {t("assistant.demo")}
          </Badge>
        )}
        <Bubble role="model" label={t("assistant.ai")}>
          {t("aria.greeting")}
        </Bubble>
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-small font-semibold text-muted">{t("aria.chipsLabel")}</p>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => void send(t(k))}
                  className="min-h-11 rounded-full border border-line-strong bg-surface px-4 text-left text-small font-semibold hover:bg-subtle"
                >
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Bubble role={m.role} label={m.role === "user" ? t("assistant.you") : t("assistant.ai")}>
              {m.text}
            </Bubble>
            {m.shortlist && m.shortlist.length > 0 && (
              <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
                <h3 className="text-small font-semibold">{t("aria.shortlistTitle")}</h3>
                <ul className="flex flex-col gap-3">
                  {m.shortlist.map((v) => (
                    <li key={v.venueId} className="flex flex-col gap-0.5">
                      <Link href={`/venues/${v.venueId}`} className="inline-flex min-h-11 w-fit items-center gap-1.5 font-semibold text-accent-text underline underline-offset-4">
                        {v.venueName}
                        <ArrowRight aria-hidden className="size-4" />
                      </Link>
                      {v.reason && <span className="text-small text-muted">{v.reason}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {m.vendors && m.vendors.length > 0 && (
              <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
                <h3 className="text-small font-semibold">{t("aria.vendorsTitle")}</h3>
                <ul className="flex flex-col gap-2">
                  {m.vendors.map((v) => (
                    <li key={v.vendorUid} className="flex flex-col gap-0.5">
                      <span className="font-semibold">{v.vendorName}</span>
                      {v.reason && <span className="text-small text-muted">{v.reason}</span>}
                    </li>
                  ))}
                </ul>
                <p className="text-small text-muted">{t("aria.vendorsNote")}</p>
              </section>
            )}
            {m.plans?.map((p) => {
              const key = `${i}:${p.venueId}`;
              const needs = [...(p.brief?.traditions ?? []).map((x) => tagLabel(t, x)), ...(p.brief?.dietaryTags ?? []).map((d) => t(DIET_KEYS[d as keyof typeof DIET_KEYS])), ...(p.brief?.stepFree ? [t("access.stepFree")] : [])];
              const items = Object.keys(p.selections).length;
              return (
                <section key={key} className="flex flex-col gap-2 rounded-xl border border-accent bg-surface p-3">
                  <h3 className="text-small font-semibold">{t("aria.planTitle")}</h3>
                  {p.summary && <p className="text-small">{p.summary}</p>}
                  <ul className="flex list-disc flex-col gap-0.5 pl-5 text-small">
                    <li>{t("aria.planVenue", { venue: p.venueName })}</li>
                    {p.headcount !== null && <li>{t("guests.count", { count: p.headcount })}</li>}
                    {p.themeId && <li>{t("assistant.change.theme", { theme: themeLabelT(t, p.themeId) })}</li>}
                    {p.weddingDate && <li>{t("assistant.change.date", { date: date(new Date(`${p.weddingDate}T12:00:00+08:00`).getTime(), { dateStyle: "long" }) })}</li>}
                    {p.budgetCents !== null && <li className="num">{t("assistant.change.budget", { amount: formatSGD(p.budgetCents) })}</li>}
                    {needs.length > 0 && <li>{t("aria.planNeeds", { needs: needs.join(", ") })}</li>}
                    {items > 0 && <li>{t("aria.planItems", { count: items })}</li>}
                  </ul>
                  {dismissed.has(key) ? (
                    <p role="status" className="text-small font-semibold">
                      {t("aria.notStarted")}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => start(p)} icon={<Sparkles aria-hidden className="size-4" />}>
                        {t("aria.startPlan")}
                      </Button>
                      <Button variant="ghost" onClick={() => setDismissed((s) => new Set(s).add(key))}>
                        {t("assistant.dismiss")}
                      </Button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ))}
        {busy && <p className="text-small text-muted">{t("assistant.thinking")}</p>}
        {error && (
          <p role="alert" className="text-small text-error">
            {error}
          </p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="flex flex-col gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-end gap-2">
          <Textarea
            label={t("assistant.inputLabel")}
            placeholder={t("aria.placeholder")}
            value={draft}
            maxLength={2000}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            className="min-w-0 flex-1 [&_label]:sr-only"
          />
          <Button type="submit" variant="primary" loading={busy} disabled={!draft.trim()} aria-label={t("assistant.send")} icon={<Send aria-hidden className="size-4" />} />
        </div>
        <p className="text-small text-muted">
          {guest ? (
            <>
              {t("aria.guestNote")}{" "}
              <Link href="/sign-up?role=couple" className="font-semibold text-accent-text underline underline-offset-4">
                {t("aria.guestLink")}
              </Link>
            </>
          ) : (
            t("assistant.note")
          )}
          {remaining !== null && <span className="num"> {t("assistant.remaining", { count: remaining })}</span>}
        </p>
      </form>
    </div>
  );
}

function Bubble({ role, label, children }: { role: "user" | "model"; label: string; children: React.ReactNode }) {
  return (
    <div className={role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"}>
      <span className="sr-only">{label}:</span>
      <p
        className={
          role === "user"
            ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-tint px-4 py-2.5 text-ink"
            : "max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-2.5"
        }
      >
        {children}
      </p>
    </div>
  );
}

"use client";

import { Download, Pencil, Plus, Printer, RefreshCw, ScrollText, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAssistant } from "@/lib/assistant/client";
import { cn } from "@/lib/cn";
import { drawItinerary } from "@/lib/itinerary/draw";
import { ITINERARY_STYLES, ITINERARY_TITLE_MAX, styleForTheme, type ItineraryStyle } from "@/lib/itinerary/layout";
import { useLocale } from "@/lib/i18n/provider";
import { buildPlanEstimates, type VendorCatalog } from "@/lib/plans/estimates";
import type { PlanDraft, PlanItinerary, TimelineEntry } from "@/lib/plans/model";
import type { CatalogVenue } from "@/lib/venues/catalog";
import type { Space } from "@/lib/venues/model";
import { BRIEF_LIMITS } from "../../../functions/src/assistant/types";
import { cleanRows } from "./aria-timeline";

const STYLE_KEYS = { classic: "itinerary.style.classic", botanical: "itinerary.style.botanical", festive: "itinerary.style.festive" } as const;

/**
 * The guest itinerary, in the Share step. Aria drafts it from the plan; the
 * couple edits and approves it; only then is it drawn as a designed image to
 * download or print. The approved schedule is the plan's timeline, the same
 * one Aria's Timeline tab and the print page use.
 */
export function ItineraryPanel({
  plan,
  venue,
  space,
  catalogs,
  onChange,
}: {
  plan: PlanDraft;
  venue: CatalogVenue;
  space: (Space & { id: string }) | null;
  catalogs: VendorCatalog[];
  onChange: (patch: Partial<PlanDraft>) => void;
}) {
  const { t, locale, date } = useLocale();
  const settings: PlanItinerary = plan.itinerary ?? { title: "", style: styleForTheme(plan.themeId), approved: false };
  const approved = settings.approved && (plan.timeline?.length ?? 0) > 0;
  const [rows, setRows] = useState<TimelineEntry[]>(() => (plan.timeline ?? []).map((e) => ({ ...e })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = (patch: Partial<PlanItinerary>) => onChange({ itinerary: { ...settings, ...patch } });

  async function generate() {
    setBusy(true);
    setError(null);
    const estimate = buildPlanEstimates({ plan, venueOwnerUid: venue.ownerUid, space, catalogs }).combinedTotalCents;
    const r = await askAssistant({ venueId: venue.id, plan, history: [{ role: "user", text: t("itinerary.prompt") }], locale, estimateTotalCents: estimate });
    setBusy(false);
    if (!r.ok) return setError(r.error.kind === "limit" ? r.error.message : t("itinerary.failed"));
    const timeline = r.proposals.flatMap((p) => p.changes).find((c) => c.kind === "timeline");
    if (!timeline || timeline.kind !== "timeline") return setError(t("itinerary.failed"));
    setRows(timeline.entries.map((e) => ({ ...e })));
  }

  function approve() {
    const clean = cleanRows(rows);
    if (!clean || clean.length === 0) return setError(t("assistant.timeline.invalid"));
    setError(null);
    setRows(clean);
    onChange({ timeline: clean, itinerary: { ...settings, approved: true } });
  }

  if (approved) {
    return (
      <ItineraryImage
        plan={plan}
        settings={settings}
        place={[venue.name, space?.name].filter(Boolean).join(" · ")}
        dateText={plan.weddingDate ? date(new Date(`${plan.weddingDate}T12:00:00+08:00`).getTime(), { dateStyle: "full" }) : ""}
        onSave={save}
        onEdit={() => {
          setRows((plan.timeline ?? []).map((e) => ({ ...e })));
          save({ approved: false });
        }}
      />
    );
  }

  const set = (i: number, patch: Partial<TimelineEntry>) => {
    setError(null);
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };
  return (
    <section aria-labelledby="itinerary-h" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id="itinerary-h" className="flex items-center gap-2 text-h3">
          <ScrollText aria-hidden className="size-5 text-gold" />
          {t("itinerary.title")}
        </h3>
        <p className="max-w-2xl text-muted">{t("itinerary.intro")}</p>
      </div>
      {rows.length === 0 ? (
        <div>
          <Button onClick={() => void generate()} loading={busy}>
            {t("itinerary.create")}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="sample">{t("assistant.timeline.draft")}</Badge>
            <p className="text-small text-muted">{t("itinerary.reviewHint")}</p>
          </div>
          <ol className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <li key={i} className="flex items-end gap-2">
                <Input label={t("assistant.timeline.time")} type="time" className="w-[9.5rem] shrink-0" value={r.time} onChange={(e) => set(i, { time: e.target.value })} />
                <Input label={t("assistant.timeline.label")} className="min-w-0 flex-1" maxLength={BRIEF_LIMITS.timelineLabelMax} value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
                <Button
                  variant="ghost"
                  aria-label={t("assistant.timeline.remove", { time: r.time || "--:--" })}
                  onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                  icon={<Trash2 aria-hidden className="size-4" />}
                />
              </li>
            ))}
          </ol>
          <p className="text-small text-muted">{t("assistant.timeline.intro")}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={approve}>
              {t("itinerary.approve")}
            </Button>
            <Button onClick={() => void generate()} loading={busy} icon={<RefreshCw aria-hidden className="size-4" />}>
              {t("itinerary.again")}
            </Button>
            <Button variant="ghost" onClick={() => setRows((r) => [...r, { time: "", label: "" }])} disabled={rows.length >= BRIEF_LIMITS.timelineEntries} icon={<Plus aria-hidden className="size-4" />}>
              {t("assistant.timeline.add")}
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-small text-error">
          {error}
        </p>
      )}
    </section>
  );
}

function ItineraryImage({
  plan,
  settings,
  place,
  dateText,
  onSave,
  onEdit,
}: {
  plan: PlanDraft;
  settings: PlanItinerary;
  place: string;
  dateText: string;
  onSave: (patch: Partial<PlanItinerary>) => void;
  onEdit: () => void;
}) {
  const { t } = useLocale();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [fits, setFits] = useState(true);
  const [title, setTitle] = useState(settings.title);
  const entries = useMemo(() => plan.timeline ?? [], [plan.timeline]);
  const shownTitle = settings.title.trim() || t("itinerary.defaultTitle");

  // Redraw whenever what's on the image changes.
  useEffect(() => {
    let cancelled = false;
    const c = canvas.current;
    if (!c) return;
    void drawItinerary(c, { title: shownTitle, subtitle: t("itinerary.subtitle"), place, date: dateText, entries, footer: t("itinerary.footer"), style: settings.style }).then((r) => {
      if (cancelled) return;
      setFits(r.fits);
      setUrl(c.toDataURL("image/png"));
    });
    return () => {
      cancelled = true;
    };
  }, [shownTitle, place, dateText, entries, settings.style, t]);

  function print() {
    if (!url) return;
    const w = window.open("", "_blank", "noopener=no");
    if (!w) return;
    w.document.title = shownTitle;
    const img = w.document.createElement("img");
    img.src = url;
    img.alt = t("itinerary.imageAlt", { title: shownTitle });
    img.style.cssText = "display:block;max-width:100%;max-height:100vh;margin:0 auto";
    img.onload = () => w.print();
    w.document.body.style.margin = "0";
    w.document.body.appendChild(img);
  }

  return (
    <section aria-labelledby="itinerary-h" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id="itinerary-h" className="flex items-center gap-2 text-h3">
          <ScrollText aria-hidden className="size-5 text-gold" />
          {t("itinerary.title")}
        </h3>
        <p className="max-w-2xl text-muted">{t("itinerary.approvedIntro")}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="flex flex-col gap-2">
          <canvas ref={canvas} className="hidden" aria-hidden />
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, not a remote image
            <img src={url} alt={t("itinerary.imageAlt", { title: shownTitle })} width={1080} height={1620} className="h-auto w-full rounded-xl border border-line shadow-soft" />
          ) : (
            <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-subtle" />
          )}
          <ol className="sr-only">
            {entries.map((e, i) => (
              <li key={i}>
                {e.time} {e.label}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-5">
          <Input
            label={t("itinerary.heading")}
            hint={t("itinerary.headingHint")}
            placeholder={t("itinerary.defaultTitle")}
            maxLength={ITINERARY_TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== settings.title && onSave({ title: title.trim() })}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-small font-semibold">{t("itinerary.styleLabel")}</legend>
            <div className="flex flex-wrap gap-2">
              {ITINERARY_STYLES.map((s: ItineraryStyle) => (
                <label
                  key={s}
                  className={cn(
                    "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-small font-semibold transition-colors",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                    settings.style === s ? "border-accent bg-accent-tint text-accent-text ring-2 ring-accent" : "border-line-strong bg-surface hover:bg-subtle",
                  )}
                >
                  <input type="radio" name="itinerary-style" className="sr-only" checked={settings.style === s} onChange={() => onSave({ style: s })} />
                  {t(STYLE_KEYS[s])}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <a
              href={url ?? undefined}
              download="wedding-itinerary.png"
              aria-disabled={!url}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-5 font-semibold text-ink hover:bg-subtle"
            >
              <Download aria-hidden className="size-4" />
              {t("itinerary.download")}
            </a>
            <Button onClick={print} disabled={!url} icon={<Printer aria-hidden className="size-4" />}>
              {t("itinerary.print")}
            </Button>
            <Button variant="ghost" onClick={onEdit} icon={<Pencil aria-hidden className="size-4" />}>
              {t("itinerary.edit")}
            </Button>
          </div>
          {!fits && (
            <p role="status" className="text-small font-semibold text-warning">
              {t("itinerary.tooLong")}
            </p>
          )}
          <p className="text-small text-muted">{t("assistant.timeline.intro")}</p>
        </div>
      </div>
    </section>
  );
}

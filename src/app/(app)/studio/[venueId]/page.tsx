"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bookmark, CalendarPlus, Check, Printer, Share2, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { StorageImage } from "@/components/photos/storage-image";
import { RenderPanel } from "@/components/render/render-panel";
import { FamilyLinks } from "@/components/sharing/family-links";
import { CapacityStatus } from "@/components/studio/capacity-status";
import { ItemPicker } from "@/components/studio/item-picker";
import { AriaAlerts } from "@/components/studio/aria-alerts";
import { PlanAssistant } from "@/components/studio/plan-assistant";
import { detectAlerts } from "@/lib/assistant/alerts";
import type { ChatMessage } from "@/lib/assistant/client";
import { ResolvedEstimates } from "@/components/studio/resolved-estimates";
import { resolvePlan } from "@/lib/leads/resolve";
import { useCoupleConfirmations } from "@/lib/leads/use-couple-confirmations";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { JourneyStepper } from "@/components/ui/journey-stepper";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonList } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth/auth-provider";
import { buildIcs, downloadIcs, isIsoDate } from "@/lib/calendar/ics";
import { clampHeadcount, sliderRange } from "@/lib/capacity";
import { cn } from "@/lib/cn";
import { getPublishedVenue, getVendorCatalog, loadVenueCatalogs } from "@/lib/data/catalog";
import type { RenderResult } from "@/lib/data/renders";
import { watchParties } from "@/lib/data/guests";
import { clearStashedDraft, countMyPlans, createPlan, getPlan, peekStashedDraft, stashDraft, updatePlan } from "@/lib/data/plans";
import { watchBlockedDates, type BlockedDate } from "@/lib/data/vendors";
import { watchSpaces, type WithId } from "@/lib/data/venues";
import { tierKeys, type TierKey } from "@/lib/estimate/build";
import { useLocale, useT } from "@/lib/i18n/provider";
import { formatSGD, tablesForHeadcount } from "@/lib/money";
import { stepVariants } from "@/lib/motion";
import { buildPlanEstimates, type VendorCatalog } from "@/lib/plans/estimates";
import { parseSelectionKey, PLAN_LIMITS, type PlanDraft } from "@/lib/plans/model";
import { THEME_OPTIONS, themeDescriptionT, themeLabelT } from "@/lib/render/themes";
import { partySeats } from "@/lib/guests/helper";
import type { CatalogVenue } from "@/lib/venues/catalog";
import type { Space } from "@/lib/venues/model";

const STEP_IDS = ["venue", "style", "render", "estimate", "share"] as const;
const STEP_KEYS = { venue: "studio.stepVenue", style: "studio.stepStyle", render: "studio.stepRender", estimate: "studio.stepEstimate", share: "studio.stepShare" } as const;
/** Tier names for the pricing select and summary bar; "standard" has no label. */
const TIER_KEYS = { standard: null, peak: "studio.tierPeak", offPeak: "studio.tierOffPeak" } as const satisfies Record<TierKey, string | null>;
const money = (c: number) => formatSGD(c);

export default function StudioPage() {
  return (
    <Suspense>
      <Studio />
    </Suspense>
  );
}

function defaultDraft(venue: CatalogVenue, spaces: WithId<Space>[], name: string): PlanDraft {
  const s = spaces[0] ?? null;
  return {
    name,
    venueId: venue.id,
    spaceId: s?.id ?? null,
    tierKey: s ? tierKeys(s)[0]! : null,
    headcount: s ? Math.round((s.capacityMin + s.capacityMax) / 10) * 5 : 100,
    themeId: THEME_OPTIONS[0].value,
    selections: {},
    savedRenders: [],
    weddingDate: null,
    budgetCents: null,
    brief: null,
    timeline: [],
  };
}

function Studio() {
  const { venueId } = useParams<{ venueId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const toast = useToast();
  const { t, date } = useLocale();
  const STEPS = useMemo(() => STEP_IDS.map((id) => ({ id, label: t(STEP_KEYS[id]) })), [t]);
  const planId = params.get("plan");
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.id === params.get("step")));
  const canSave = auth.status === "ready" && auth.profile.role === "couple";

  const [venue, setVenue] = useState<CatalogVenue | null | undefined>(undefined);
  const [spaces, setSpaces] = useState<WithId<Space>[] | null>(null);
  const [catalogs, setCatalogs] = useState<VendorCatalog[] | null>(null);
  const [blocked, setBlocked] = useState<WithId<BlockedDate>[]>([]);
  // A plan stashed before sign-up comes back here (read-only peek; cleared once saved).
  const [draft, setDraft] = useState<PlanDraft | null>(() => (params.get("resume") ? peekStashedDraft(venueId) : null));
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // The planning assistant's conversation lives only in this page.
  const [assistantOpen, setAssistantOpen] = useState(() => params.get("assistant") === "1");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  // Seats on the couple's guest list, for Aria's capacity check (counts only).
  const [guestSeats, setGuestSeats] = useState<number | null>(null);
  // Other vendors in the plan who blocked dates: uid -> dates.
  const [vendorBlocked, setVendorBlocked] = useState<Record<string, string[]>>({});
  const [direction, setDirection] = useState(1);
  const [lastRender, setLastRender] = useState<RenderResult | null>(null);
  const lastSaved = useRef<string>("");
  const creating = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getPublishedVenue(venueId).then((v) => {
      if (cancelled) return;
      setVenue(v);
      if (v) loadVenueCatalogs(v).then((c) => !cancelled && setCatalogs(c));
    });
    const unsub = watchSpaces(venueId, setSpaces, () => setSpaces([]));
    return () => {
      cancelled = true;
      unsub();
    };
  }, [venueId]);

  // A saved plan may use a vendor that is no longer listed: load it so its items stay priced.
  const missingVendors = draft && catalogs ? [...new Set(Object.keys(draft.selections).map((k) => parseSelectionKey(k)?.vendorUid))].filter((u): u is string => !!u && !catalogs.some((c) => c.uid === u)).sort().join(",") : "";
  useEffect(() => {
    if (!missingVendors) return;
    let cancelled = false;
    Promise.all(missingVendors.split(",").map(getVendorCatalog)).then((extra) => {
      const found = extra.filter((c): c is VendorCatalog => c !== null);
      if (!cancelled && found.length) setCatalogs((prev) => [...(prev ?? []), ...found.filter((f) => !(prev ?? []).some((p) => p.uid === f.uid))]);
    });
    return () => {
      cancelled = true;
    };
  }, [missingVendors]);

  // The venue's own booked dates, to warn before a couple picks a taken one.
  const venueOwner = venue?.ownerUid ?? null;
  useEffect(() => {
    if (!venueOwner) return;
    return watchBlockedDates(venueOwner, setBlocked, () => setBlocked([]));
  }, [venueOwner]);

  // Open a saved plan.
  useEffect(() => {
    if (!planId || loadedPlanId === planId || auth.status === "loading") return;
    let cancelled = false;
    getPlan(planId).then((p) => {
      if (cancelled) return;
      if (!p || p.venueId !== venueId) {
        setPlanError(t("studio.planOpenError"));
        return;
      }
      // Only the editable fields; ownerUid and timestamps stay on the server copy.
      const d: PlanDraft = {
        name: p.name,
        venueId: p.venueId,
        spaceId: p.spaceId,
        tierKey: p.tierKey,
        headcount: p.headcount,
        themeId: p.themeId,
        selections: p.selections,
        savedRenders: p.savedRenders,
        weddingDate: p.weddingDate ?? null,
        budgetCents: p.budgetCents ?? null,
        brief: p.brief ?? null,
        timeline: p.timeline ?? [],
      };
      lastSaved.current = JSON.stringify(d);
      setDraft(d);
      setLoadedPlanId(planId);
    });
    return () => {
      cancelled = true;
    };
  }, [planId, loadedPlanId, venueId, auth.status, t]);

  const plan: PlanDraft | null = draft ?? (venue && spaces ? defaultDraft(venue, spaces, t("studio.defaultPlanName", { venue: venue.name })) : null);
  const space = spaces?.find((s) => s.id === plan?.spaceId) ?? null;

  // Guest list seat counts (no labels) for Aria's capacity check.
  const guestUid = auth.status === "ready" && auth.profile.role === "couple" ? auth.user.uid : null;
  useEffect(() => {
    if (!guestUid) return;
    return watchParties(
      guestUid,
      (rows) => setGuestSeats(rows.length ? rows.reduce((n, p) => n + partySeats(p), 0) : null),
      () => setGuestSeats(null),
    );
  }, [guestUid]);

  // Blocked dates of the plan's other vendors (decorators), so Aria can warn about the date.
  const otherVendors = plan && venueOwner ? [...new Set(Object.keys(plan.selections).map((k) => parseSelectionKey(k)?.vendorUid))].filter((u): u is string => !!u && u !== venueOwner).sort().slice(0, 5).join(",") : "";
  useEffect(() => {
    if (!otherVendors) return;
    const unsubs = otherVendors.split(",").map((uid) =>
      watchBlockedDates(
        uid,
        (rows) => setVendorBlocked((prev) => ({ ...prev, [uid]: rows.map((r) => r.date) })),
        () => setVendorBlocked((prev) => ({ ...prev, [uid]: [] })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [otherVendors]);

  function update(patch: Partial<PlanDraft>) {
    if (!plan) return;
    setDraft({ ...plan, ...patch });
  }

  // After signing up mid-way: save the stashed plan once, then continue in it.
  useEffect(() => {
    if (!canSave || planId || !params.get("resume") || !draft || creating.current) return;
    creating.current = true;
    const uid = auth.status === "ready" ? auth.user.uid : "";
    createPlan(uid, draft)
      .then((id) => {
        clearStashedDraft();
        lastSaved.current = JSON.stringify(draft);
        setLoadedPlanId(id);
        router.replace(`/studio/${venueId}?plan=${id}&step=${STEPS[stepIndex]!.id}`, { scroll: false });
        toast({ title: t("studio.planSavedTitle"), description: t("studio.planSavedDesc"), tone: "success" });
      })
      .catch(() => {
        creating.current = false;
        toast({ title: t("studio.planSaveFailed"), tone: "error" });
      });
  }, [canSave, planId, params, draft, auth, router, venueId, stepIndex, toast, t, STEPS]);

  // Autosave a saved plan, shortly after the last change.
  useEffect(() => {
    if (!planId || !canSave || !draft || loadedPlanId !== planId) return;
    const json = JSON.stringify(draft);
    if (json === lastSaved.current) return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      updatePlan(planId, draft)
        .then(() => {
          lastSaved.current = json;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draft, planId, canSave, loadedPlanId]);

  async function savePlan() {
    if (!plan) return;
    if (!canSave) {
      if (auth.status === "ready") {
        toast({ title: t("studio.coupleOnlyTitle"), description: t("studio.coupleOnlyDesc"), tone: "error" });
        return;
      }
      stashDraft(plan);
      const next = `/studio/${venueId}?resume=1&step=${STEPS[stepIndex]!.id}`;
      router.push(`/sign-up?role=couple&next=${encodeURIComponent(next)}`);
      return;
    }
    const uid = auth.status === "ready" ? auth.user.uid : "";
    if ((await countMyPlans(uid)) >= PLAN_LIMITS.plansPerCouple) {
      toast({ title: t("studio.planLimitTitle", { n: PLAN_LIMITS.plansPerCouple }), description: t("studio.planLimitDesc"), tone: "error" });
      return;
    }
    try {
      const id = await createPlan(uid, plan);
      lastSaved.current = JSON.stringify(plan);
      setDraft(plan);
      setLoadedPlanId(id);
      router.replace(`/studio/${venueId}?plan=${id}&step=${STEPS[stepIndex]!.id}`, { scroll: false });
      toast({ title: t("studio.planSavedTitle"), description: t("studio.planSavedDesc"), tone: "success" });
    } catch {
      toast({ title: t("studio.planSaveFailed"), tone: "error" });
    }
  }

  function goTo(i: number) {
    setDirection(i >= stepIndex ? 1 : -1);
    const q = new URLSearchParams(params.toString());
    q.set("step", STEPS[i]!.id);
    q.delete("resume");
    router.replace(`/studio/${venueId}?${q.toString()}`, { scroll: false });
    window.scrollTo({ top: 0 });
  }

  const estimates = useMemo(
    () => (plan && venue && catalogs ? buildPlanEstimates({ plan, venueOwnerUid: venue.ownerUid, space, catalogs }) : null),
    [plan, venue, catalogs, space],
  );

  // Render request: chosen items with a photo, plus items inside chosen packages (max 10).
  const renderItems = useMemo(() => {
    if (!plan || !catalogs) return [];
    const out: Array<{ vendorUid: string; itemId: string }> = [];
    for (const key of Object.keys(plan.selections)) {
      const sel = parseSelectionKey(key);
      const cat = sel && catalogs.find((c) => c.uid === sel.vendorUid);
      if (!sel || !cat) continue;
      const ids = sel.kind === "item" ? [sel.id] : (cat.packages.find((p) => p.id === sel.id)?.itemIds ?? []);
      for (const id of ids) if (cat.items.find((i) => i.id === id)?.photo && !out.some((o) => o.vendorUid === cat.uid && o.itemId === id)) out.push({ vendorUid: cat.uid, itemId: id });
    }
    return out;
  }, [plan, catalogs]);
  const saved = !!planId && loadedPlanId === planId;
  // Confirmed parts count at the price the vendor confirmed, in the summary bar and the Estimate step alike.
  const coupleUid = canSave && auth.status === "ready" ? auth.user.uid : null;
  const { leads, confirmations } = useCoupleConfirmations(coupleUid);
  const resolved = useMemo(
    () => (estimates && plan ? resolvePlan({ plan, planId: saved ? planId : "", live: estimates, leads: saved ? leads : [], confirmations, now: new Date() }) : null),
    [estimates, plan, planId, saved, leads, confirmations],
  );

  const ariaAlerts = plan && resolved
    ? detectAlerts({
        budgetCents: plan.budgetCents ?? null,
        estimateCents: resolved.combinedTotalCents,
        headcount: plan.headcount,
        capacityMax: space?.capacityMax ?? null,
        guestSeats,
        unavailableVendors: plan.weddingDate
          ? [
              ...(blocked.some((b) => b.date === plan.weddingDate) && venue ? [venue.name] : []),
              ...Object.entries(vendorBlocked)
                .filter(([uid, dates]) => otherVendors.split(",").includes(uid) && dates.includes(plan.weddingDate!))
                .map(([uid]) => catalogs?.find((c) => c.uid === uid)?.profile.businessName ?? uid),
            ]
          : [],
      })
    : [];

  if (venue === null) {
    return (
      <>
        <AppHeader />
        <main className="container-page py-10">
          <p role="alert">{t("studio.venueUnavailable")}</p>
        </main>
      </>
    );
  }
  if (!venue || !spaces || !plan) {
    return (
      <>
        <AppHeader />
        <main className="container-page py-10">
          <SkeletonList rows={3} label={t("studio.opening")} />
        </main>
      </>
    );
  }

  const range = space ? { min: space.capacityMin, max: space.capacityMax } : null;
  const slider = range ? sliderRange(range) : { min: 1, max: 500 };
  const keys = space ? tierKeys(space) : [];
  const savedRender = (key: string) => plan.savedRenders.some((r) => r.key === key);

  return (
    <>
      <AppHeader />
      <main className="container-page flex flex-col gap-6 py-8 pb-28 sm:pb-12">
        <div className="flex flex-col gap-3">
          <Link href={saved ? "/plans" : `/venues/${venue.id}`} className="inline-flex min-h-11 w-fit items-center gap-2 text-small font-semibold text-muted hover:text-ink">
            <ArrowLeft aria-hidden className="size-4" />
            {saved ? t("nav.plans") : venue.name}
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-h1">{saved ? plan.name : t("studio.planYourDay")}</h1>
              <p className="text-muted">{venue.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setAssistantOpen(true)} icon={<Sparkles aria-hidden className="size-4" />}>
              {t("assistant.open")}
            </Button>
            {saved ? (
              <p className="flex items-center gap-1.5 text-small text-muted" aria-live="polite">
                {saveState === "saving" ? t("common.saving") : saveState === "error" ? t("studio.notSaved") : (
                  <>
                    <Check aria-hidden className="size-4 text-success" /> {t("common.saved")}
                  </>
                )}
              </p>
            ) : (
              <Button onClick={savePlan} icon={<Bookmark aria-hidden className="size-4" />}>
                {auth.status === "signed-out" ? t("studio.saveYourPlan") : t("studio.savePlan")}
              </Button>
            )}
            </div>
          </div>
          {planError && (
            <p role="alert" className="text-error">
              {planError}
            </p>
          )}
        </div>

        <JourneyStepper steps={STEPS} current={stepIndex} onStepChange={goTo} allowForward label={t("studio.planningSteps")} />

        {catalogs && spaces && (
          <PlanAssistant
            open={assistantOpen}
            onOpenChange={setAssistantOpen}
            venue={venue}
            spaces={spaces}
            catalogs={catalogs}
            plan={plan}
            planId={saved ? planId : null}
            canUse={saved && canSave}
            alerts={ariaAlerts}
            onSave={() => {
              setAssistantOpen(false);
              savePlan();
            }}
            onApply={(next) =>
              update({
                headcount: next.headcount,
                spaceId: next.spaceId,
                tierKey: next.tierKey,
                themeId: next.themeId,
                weddingDate: next.weddingDate ?? null,
                selections: next.selections,
                budgetCents: next.budgetCents ?? null,
                brief: next.brief ?? null,
                timeline: next.timeline ?? [],
              })
            }
            onOpenRequest={() => {
              setAssistantOpen(false);
              goTo(3);
            }}
            messages={chat}
            setMessages={setChat}
          />
        )}

        {resolved && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-subtle px-4 py-3">
            <span className="num text-small">
              {t("guests.count", { count: plan.headcount })}
              {space ? ` · ${space.name}` : ""}
              {plan.tierKey && TIER_KEYS[plan.tierKey] ? ` · ${t(TIER_KEYS[plan.tierKey]!)}` : ""}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-small text-muted">{resolved.confirmedCount > 0 && resolved.confirmedCount === resolved.vendors.length ? t("studio.confirmedTotal") : t("studio.estimatedTotal")}</span>
              <span className="font-display text-h3">
                <AnimatedNumber value={resolved.combinedTotalCents} format={money} />
              </span>
            </span>
          </div>
        )}

        {saved && canSave && (
          <AriaAlerts
            alerts={ariaAlerts}
            openLabel={t("assistant.open")}
            onAsk={() => setAssistantOpen(true)}
          />
        )}

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.section key={stepIndex} custom={direction} variants={stepVariants} initial="initial" animate="animate" exit="exit" aria-labelledby="step-h" className="flex flex-col gap-6">
            <h2 id="step-h" className="sr-only">
              {STEPS[stepIndex]!.label}
            </h2>

            {stepIndex === 0 && (
              <Card>
                <CardBody className="flex flex-col gap-6">
                  <fieldset className="flex flex-col gap-3">
                    <legend className="mb-1 text-small font-semibold text-ink">{t("studio.room")}</legend>
                    <div className="grid gap-3 md:grid-cols-2">
                      {spaces.map((s) => (
                        <label
                          key={s.id}
                          className={cn(
                            "flex min-h-11 cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                            "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                            plan.spaceId === s.id ? "border-accent bg-accent-tint" : "border-line-strong bg-surface hover:bg-subtle",
                          )}
                        >
                          <input
                            type="radio"
                            name="space"
                            className="sr-only"
                            checked={plan.spaceId === s.id}
                            onChange={() =>
                              update({
                                spaceId: s.id,
                                tierKey: tierKeys(s)[0]!,
                                headcount: clampHeadcount(plan.headcount, { min: s.capacityMin, max: s.capacityMax }),
                              })
                            }
                          />
                          {s.photo && (
                            <div className="w-24 shrink-0">
                              <StorageImage photo={s.photo} alt="" aspect="4 / 3" className="rounded-lg" sizes="96px" />
                            </div>
                          )}
                          <span className="flex flex-col">
                            <span className="font-semibold">{s.name}</span>
                            <span className="num text-small text-muted">{t("studio.capacityRange", { min: s.capacityMin, max: s.capacityMax })}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {space && keys.length > 1 && (
                    <Select
                      label={t("studio.pricing")}
                      className="md:max-w-xs"
                      options={keys.map((k) => ({ value: k, label: TIER_KEYS[k] ? t(TIER_KEYS[k]!) : "" }))}
                      value={plan.tierKey ?? undefined}
                      onValueChange={(v) => update({ tierKey: v as TierKey })}
                      hint={t("studio.pricingHint")}
                    />
                  )}
                  <div className="flex flex-col gap-2">
                    <Input
                      label={t("date.label")}
                      type="date"
                      className="md:max-w-xs"
                      hint={t("date.hint")}
                      value={plan.weddingDate ?? ""}
                      onChange={(e) => update({ weddingDate: isIsoDate(e.target.value) ? e.target.value : null })}
                    />
                    {plan.weddingDate && blocked.some((b) => b.date === plan.weddingDate) && (
                      <p role="status" className="flex items-center gap-2 text-small font-medium text-warning">
                        <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning-icon" />
                        {t("date.clash", { date: date(new Date(`${plan.weddingDate}T12:00:00+08:00`).getTime(), { dateStyle: "long" }) })}
                      </p>
                    )}
                  </div>
                  <Slider
                    label={t("studio.guests")}
                    value={Math.min(slider.max, Math.max(slider.min, plan.headcount))}
                    onValueChange={(v) => update({ headcount: v })}
                    min={slider.min}
                    max={slider.max}
                    valueText={(v) => t("guests.count", { count: v })}
                    tone={range && (plan.headcount > range.max || plan.headcount < range.min) ? "warning" : "default"}
                    displayValue={<AnimatedNumber value={plan.headcount} />}
                  >
                    <p className="num">
                      {t("tables.line", {
                        guests: plan.headcount,
                        count: tablesForHeadcount(plan.headcount, space?.seatsPerTable ?? 10),
                        seats: space?.seatsPerTable ?? 10,
                      })}
                    </p>
                    {range && <CapacityStatus headcount={plan.headcount} range={range} />}
                  </Slider>
                </CardBody>
              </Card>
            )}

            {stepIndex === 1 && (
              <Card>
                <CardBody className="flex flex-col gap-6">
                  <Select
                    label={t("studio.theme")}
                    className="md:max-w-sm"
                    options={THEME_OPTIONS.map((o) => ({ value: o.value, label: themeLabelT(t, o.value), description: themeDescriptionT(t, o.value) }))}
                    value={plan.themeId}
                    onValueChange={(v) => update({ themeId: v })}
                    hint={t("studio.themeHint")}
                  />
                  {!catalogs ? (
                    <SkeletonList rows={2} label={t("studio.loadingDecor")} />
                  ) : (
                    <ItemPicker catalogs={catalogs} venueOwnerUid={venue.ownerUid} selections={plan.selections} onChange={(selections) => update({ selections })} />
                  )}
                </CardBody>
              </Card>
            )}

            {stepIndex === 2 && (
              <Card>
                <CardBody className="flex flex-col gap-6">
                  {auth.status === "signed-out" ? (
                    <div className="flex flex-col items-start gap-3">
                      <p>{t("studio.createAccountPrompt")}</p>
                      <Button variant="primary" onClick={savePlan}>
                        {t("studio.saveAndContinue")}
                      </Button>
                    </div>
                  ) : (
                    <RenderPanel
                      request={space ? { venueId: venue.id, spaceId: space.id, themeId: plan.themeId, items: renderItems.slice(0, 10) } : null}
                      roomPhoto={space?.photo ?? null}
                      disabledReason={renderItems.length > 10 ? t("studio.tooManyItems", { max: 10 }) : null}
                      actions={
                        saved ? (
                          <SaveRenderButton
                            render={lastRender}
                            disabled={plan.savedRenders.length >= PLAN_LIMITS.savedRenders}
                            isSaved={savedRender}
                            onSave={(r) =>
                              update({
                                savedRenders: [...plan.savedRenders, { key: r.key, path: r.path, themeId: r.themeId, demo: r.demo, savedAt: new Date().toISOString() }].slice(
                                  -PLAN_LIMITS.savedRenders,
                                ),
                              })
                            }
                          />
                        ) : (
                          <p className="text-small text-muted">{t("studio.saveToKeepRenders")}</p>
                        )
                      }
                      onRendered={setLastRender}
                    />
                  )}
                  {plan.savedRenders.length > 0 && space?.photo && (
                    <section aria-labelledby="saved-renders" className="flex flex-col gap-3">
                      <h3 id="saved-renders" className="text-h3">
                        {t("studio.savedRenders", { n: plan.savedRenders.length, max: PLAN_LIMITS.savedRenders })}
                      </h3>
                      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {plan.savedRenders.map((r) => (
                          <li key={r.key} className="flex flex-col gap-2">
                            <StorageImage
                              photo={{ path: r.path, width: space.photo!.width, height: space.photo!.height, contentType: "image/jpeg" }}
                              alt={t("render.savedAlt", { theme: themeLabelT(t, r.themeId) })}
                              aspect={`${space.photo!.width} / ${space.photo!.height}`}
                              sizes="(min-width: 48rem) 33vw, 50vw"
                            />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-small">{r.demo ? t("studio.themeDemo", { theme: themeLabelT(t, r.themeId) }) : themeLabelT(t, r.themeId)}</span>
                              <Button
                                variant="ghost"
                                aria-label={t("studio.removeSavedRender", { theme: themeLabelT(t, r.themeId) })}
                                onClick={() => update({ savedRenders: plan.savedRenders.filter((x) => x.key !== r.key) })}
                                icon={<Trash2 aria-hidden className="size-4" />}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </CardBody>
              </Card>
            )}

            {stepIndex === 3 && (
              <Card>
                <CardBody className="flex flex-col gap-6">
                  {saved && plan.weddingDate && isIsoDate(plan.weddingDate) && (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
                      <p className="num font-semibold">{t("date.set", { date: date(new Date(`${plan.weddingDate}T12:00:00+08:00`).getTime(), { dateStyle: "long" }) })}</p>
                      <Button
                        onClick={() =>
                          downloadIcs(
                            plan.name,
                            buildIcs({
                              uid: `plan-${planId}@weddingvista`,
                              date: plan.weddingDate!,
                              summary: t("date.eventTitle", { plan: plan.name }),
                              location: [venue.name, venue.address, venue.postalCode ? `Singapore ${venue.postalCode}` : ""].filter(Boolean).join(", "),
                              url: `${window.location.origin}/studio/${venue.id}?plan=${planId}`,
                            }),
                          )
                        }
                        icon={<CalendarPlus aria-hidden className="size-4" />}
                      >
                        {t("date.addToCalendar")}
                      </Button>
                      <p className="w-full text-small text-muted">{t("date.icsHelp")}</p>
                    </div>
                  )}
                  {estimates ? (
                    <ResolvedEstimates
                      live={estimates}
                      plan={plan}
                      planId={saved ? planId : null}
                      coupleUid={coupleUid}
                      venue={venue}
                      space={space}
                      leads={leads}
                      confirmations={confirmations}
                    />
                  ) : (
                    <SkeletonList rows={2} label={t("studio.workingOutEstimate")} />
                  )}
                  {saved ? (
                    <Link
                      href={`/plans/${planId}/print`}
                      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-line-strong bg-surface px-5 font-semibold text-ink hover:bg-subtle"
                    >
                      <Printer aria-hidden className="size-4" />
                      {t("studio.printOrPdf")}
                    </Link>
                  ) : (
                    <p className="text-small text-muted">{t("studio.saveToPrint")}</p>
                  )}
                </CardBody>
              </Card>
            )}

            {stepIndex === 4 && (
              <Card>
                <CardBody>
                  {canSave && auth.status === "ready" ? (
                    <FamilyLinks uid={auth.user.uid} />
                  ) : (
                    <div className="flex flex-col items-start gap-3">
                      <Share2 aria-hidden className="size-6 text-gold" />
                      <h3 className="text-h3">{t("studio.shareWithFamily")}</h3>
                      <p className="max-w-xl text-muted">{t("studio.shareIntro")}</p>
                      <Button variant="primary" onClick={savePlan}>
                        {t("studio.saveYourPlan")}
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            <div className="flex flex-wrap justify-between gap-3">
              <Button onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>
                {t("common.back")}
              </Button>
              {stepIndex < STEPS.length - 1 && (
                <Button variant={stepIndex === 3 ? "secondary" : "primary"} onClick={() => goTo(stepIndex + 1)}>
                  {t("studio.nextStep", { step: STEPS[stepIndex + 1]!.label })}
                </Button>
              )}
            </div>
          </motion.section>
        </AnimatePresence>
      </main>
    </>
  );
}

function SaveRenderButton({ render, disabled, isSaved, onSave }: { render: RenderResult | null; disabled: boolean; isSaved: (key: string) => boolean; onSave: (r: RenderResult) => void }) {
  const t = useT();
  if (!render) return null;
  const already = isSaved(render.key);
  return (
    <Button onClick={() => onSave(render)} disabled={already || disabled} icon={<Bookmark aria-hidden className="size-4" />}>
      {already ? t("studio.savedToPlan") : disabled ? t("studio.savedRendersFull", { max: PLAN_LIMITS.savedRenders }) : t("studio.saveThisRender")}
    </Button>
  );
}

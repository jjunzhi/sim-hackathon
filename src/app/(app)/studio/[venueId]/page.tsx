"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bookmark, Check, Printer, Share2, Trash2 } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { StorageImage } from "@/components/photos/storage-image";
import { RenderPanel } from "@/components/render/render-panel";
import { CapacityStatus } from "@/components/studio/capacity-status";
import { ItemPicker } from "@/components/studio/item-picker";
import { PlanEstimatesView } from "@/components/studio/plan-estimates";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { JourneyStepper } from "@/components/ui/journey-stepper";
import { Select } from "@/components/ui/select";
import { SkeletonList } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth/auth-provider";
import { clampHeadcount, sliderRange, tablesLine } from "@/lib/capacity";
import { cn } from "@/lib/cn";
import { getPublishedVenue, loadVenueCatalogs } from "@/lib/data/catalog";
import type { RenderResult } from "@/lib/data/renders";
import { clearStashedDraft, countMyPlans, createPlan, getPlan, peekStashedDraft, stashDraft, updatePlan } from "@/lib/data/plans";
import { watchSpaces, type WithId } from "@/lib/data/venues";
import { TIER_LABELS, tierKeys, type TierKey } from "@/lib/estimate/build";
import { formatSGD } from "@/lib/money";
import { stepVariants } from "@/lib/motion";
import { buildPlanEstimates, type VendorCatalog } from "@/lib/plans/estimates";
import { parseSelectionKey, PLAN_LIMITS, type PlanDraft } from "@/lib/plans/model";
import { THEME_OPTIONS, themeLabel } from "@/lib/render/themes";
import type { CatalogVenue } from "@/lib/venues/catalog";
import type { Space } from "@/lib/venues/model";

const STEPS = [
  { id: "venue", label: "Venue" },
  { id: "style", label: "Style" },
  { id: "render", label: "Render" },
  { id: "estimate", label: "Estimate" },
  { id: "share", label: "Share" },
];
const money = (c: number) => formatSGD(c);

export default function StudioPage() {
  return (
    <Suspense>
      <Studio />
    </Suspense>
  );
}

function defaultDraft(venue: CatalogVenue, spaces: WithId<Space>[]): PlanDraft {
  const s = spaces[0] ?? null;
  return {
    name: `${venue.name} plan`,
    venueId: venue.id,
    spaceId: s?.id ?? null,
    tierKey: s ? tierKeys(s)[0]! : null,
    headcount: s ? Math.round((s.capacityMin + s.capacityMax) / 10) * 5 : 100,
    themeId: THEME_OPTIONS[0].value,
    selections: {},
    savedRenders: [],
  };
}

function Studio() {
  const { venueId } = useParams<{ venueId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const toast = useToast();
  const planId = params.get("plan");
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.id === params.get("step")));
  const canSave = auth.status === "ready" && auth.profile.role === "couple";

  const [venue, setVenue] = useState<CatalogVenue | null | undefined>(undefined);
  const [spaces, setSpaces] = useState<WithId<Space>[] | null>(null);
  const [catalogs, setCatalogs] = useState<VendorCatalog[] | null>(null);
  // A plan stashed before sign-up comes back here (read-only peek; cleared once saved).
  const [draft, setDraft] = useState<PlanDraft | null>(() => (params.get("resume") ? peekStashedDraft(venueId) : null));
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
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

  // Open a saved plan.
  useEffect(() => {
    if (!planId || loadedPlanId === planId || auth.status === "loading") return;
    let cancelled = false;
    getPlan(planId).then((p) => {
      if (cancelled) return;
      if (!p || p.venueId !== venueId) {
        setPlanError("We couldn't open this plan. It may have been deleted.");
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
      };
      lastSaved.current = JSON.stringify(d);
      setDraft(d);
      setLoadedPlanId(planId);
    });
    return () => {
      cancelled = true;
    };
  }, [planId, loadedPlanId, venueId, auth.status]);

  const plan: PlanDraft | null = draft ?? (venue && spaces ? defaultDraft(venue, spaces) : null);
  const space = spaces?.find((s) => s.id === plan?.spaceId) ?? null;

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
        toast({ title: "Plan saved", description: "Changes now save automatically.", tone: "success" });
      })
      .catch(() => {
        creating.current = false;
        toast({ title: "We couldn't save your plan", tone: "error" });
      });
  }, [canSave, planId, params, draft, auth, router, venueId, stepIndex, toast]);

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
        toast({ title: "Plans are saved by couple accounts", description: "Vendor accounts can't save plans.", tone: "error" });
        return;
      }
      stashDraft(plan);
      const next = `/studio/${venueId}?resume=1&step=${STEPS[stepIndex]!.id}`;
      router.push(`/sign-up?role=couple&next=${encodeURIComponent(next)}`);
      return;
    }
    const uid = auth.status === "ready" ? auth.user.uid : "";
    if ((await countMyPlans(uid)) >= PLAN_LIMITS.plansPerCouple) {
      toast({ title: `You can keep up to ${PLAN_LIMITS.plansPerCouple} plans`, description: "Delete one under My plans to save this one.", tone: "error" });
      return;
    }
    try {
      const id = await createPlan(uid, plan);
      lastSaved.current = JSON.stringify(plan);
      setDraft(plan);
      setLoadedPlanId(id);
      router.replace(`/studio/${venueId}?plan=${id}&step=${STEPS[stepIndex]!.id}`, { scroll: false });
      toast({ title: "Plan saved", description: "Changes now save automatically.", tone: "success" });
    } catch {
      toast({ title: "We couldn't save your plan", tone: "error" });
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

  if (venue === null) {
    return (
      <>
        <AppHeader />
        <main className="container-page py-10">
          <p role="alert">This venue isn&apos;t available. It may have been unpublished.</p>
        </main>
      </>
    );
  }
  if (!venue || !spaces || !plan) {
    return (
      <>
        <AppHeader />
        <main className="container-page py-10">
          <SkeletonList rows={3} label="Opening the studio" />
        </main>
      </>
    );
  }

  const range = space ? { min: space.capacityMin, max: space.capacityMax } : null;
  const slider = range ? sliderRange(range) : { min: 1, max: 500 };
  const keys = space ? tierKeys(space) : [];
  const saved = !!planId && loadedPlanId === planId;
  const savedRender = (key: string) => plan.savedRenders.some((r) => r.key === key);

  return (
    <>
      <AppHeader />
      <main className="container-page flex flex-col gap-6 py-8 pb-28 sm:pb-12">
        <div className="flex flex-col gap-3">
          <Link href={saved ? "/plans" : `/venues/${venue.id}`} className="inline-flex min-h-11 w-fit items-center gap-2 text-small font-semibold text-muted hover:text-ink">
            <ArrowLeft aria-hidden className="size-4" />
            {saved ? "My plans" : venue.name}
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-h1">{saved ? plan.name : "Plan your day"}</h1>
              <p className="text-muted">{venue.name}</p>
            </div>
            {saved ? (
              <p className="flex items-center gap-1.5 text-small text-muted" aria-live="polite">
                {saveState === "saving" ? "Saving..." : saveState === "error" ? "Not saved. Check your connection." : (
                  <>
                    <Check aria-hidden className="size-4 text-success" /> Saved
                  </>
                )}
              </p>
            ) : (
              <Button onClick={savePlan} icon={<Bookmark aria-hidden className="size-4" />}>
                {auth.status === "signed-out" ? "Save your plan" : "Save plan"}
              </Button>
            )}
          </div>
          {planError && (
            <p role="alert" className="text-error">
              {planError}
            </p>
          )}
        </div>

        <JourneyStepper steps={STEPS} current={stepIndex} onStepChange={goTo} allowForward label="Planning steps" />

        {estimates && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-subtle px-4 py-3">
            <span className="num text-small">
              {plan.headcount} guests{space ? ` · ${space.name}` : ""}
              {plan.tierKey && TIER_LABELS[plan.tierKey] ? ` · ${TIER_LABELS[plan.tierKey]}` : ""}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-small text-muted">Estimated total</span>
              <span className="font-display text-h3">
                <AnimatedNumber value={estimates.combinedTotalCents} format={money} />
              </span>
            </span>
          </div>
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
                    <legend className="mb-1 text-small font-semibold text-ink">Room</legend>
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
                            <span className="num text-small text-muted">
                              {s.capacityMin} to {s.capacityMax} guests
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {space && keys.length > 1 && (
                    <Select
                      label="Pricing"
                      className="md:max-w-xs"
                      options={keys.map((k) => ({ value: k, label: TIER_LABELS[k] }))}
                      value={plan.tierKey ?? undefined}
                      onValueChange={(v) => update({ tierKey: v as TierKey })}
                      hint="Ask the venue which dates count as Peak."
                    />
                  )}
                  <Slider
                    label="Guests"
                    value={Math.min(slider.max, Math.max(slider.min, plan.headcount))}
                    onValueChange={(v) => update({ headcount: v })}
                    min={slider.min}
                    max={slider.max}
                    valueText={(v) => `${v} guests`}
                    tone={range && (plan.headcount > range.max || plan.headcount < range.min) ? "warning" : "default"}
                    displayValue={<AnimatedNumber value={plan.headcount} />}
                  >
                    <p className="num">{tablesLine(plan.headcount, space?.seatsPerTable ?? 10)}</p>
                    {range && <CapacityStatus headcount={plan.headcount} range={range} />}
                  </Slider>
                </CardBody>
              </Card>
            )}

            {stepIndex === 1 && (
              <Card>
                <CardBody className="flex flex-col gap-6">
                  <Select
                    label="Theme"
                    className="md:max-w-sm"
                    options={[...THEME_OPTIONS]}
                    value={plan.themeId}
                    onValueChange={(v) => update({ themeId: v })}
                    hint="Cultural themes are pending community review."
                  />
                  {!catalogs ? (
                    <SkeletonList rows={2} label="Loading decor" />
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
                      <p>Create a free account to see this room decorated with your choices. Your plan comes with you.</p>
                      <Button variant="primary" onClick={savePlan}>
                        Save your plan and continue
                      </Button>
                    </div>
                  ) : (
                    <RenderPanel
                      request={space ? { venueId: venue.id, spaceId: space.id, themeId: plan.themeId, items: renderItems.slice(0, 10) } : null}
                      roomPhoto={space?.photo ?? null}
                      disabledReason={renderItems.length > 10 ? "Renders can show up to 10 items. Deselect a few to render." : null}
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
                          <p className="text-small text-muted">Save your plan to keep renders.</p>
                        )
                      }
                      onRendered={setLastRender}
                    />
                  )}
                  {plan.savedRenders.length > 0 && space?.photo && (
                    <section aria-labelledby="saved-renders" className="flex flex-col gap-3">
                      <h3 id="saved-renders" className="text-h3">
                        Saved renders ({plan.savedRenders.length} of {PLAN_LIMITS.savedRenders})
                      </h3>
                      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {plan.savedRenders.map((r) => (
                          <li key={r.key} className="flex flex-col gap-2">
                            <StorageImage
                              photo={{ path: r.path, width: space.photo!.width, height: space.photo!.height, contentType: "image/jpeg" }}
                              alt={`Saved AI illustration, ${themeLabel(r.themeId)} theme`}
                              aspect={`${space.photo!.width} / ${space.photo!.height}`}
                              sizes="(min-width: 48rem) 33vw, 50vw"
                            />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-small">
                                {themeLabel(r.themeId)}
                                {r.demo ? " · DEMO" : ""}
                              </span>
                              <Button
                                variant="ghost"
                                aria-label={`Remove saved render, ${themeLabel(r.themeId)}`}
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
                  {estimates ? <PlanEstimatesView result={estimates} /> : <SkeletonList rows={2} label="Working out your estimate" />}
                  {saved ? (
                    <Link
                      href={`/plans/${planId}/print`}
                      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-line-strong bg-surface px-5 font-semibold text-ink hover:bg-subtle"
                    >
                      <Printer aria-hidden className="size-4" />
                      Print or save as PDF
                    </Link>
                  ) : (
                    <p className="text-small text-muted">Save your plan to print or save the estimate as a PDF.</p>
                  )}
                </CardBody>
              </Card>
            )}

            {stepIndex === 4 && (
              <Card>
                <CardBody className="flex flex-col items-start gap-3">
                  <Share2 aria-hidden className="size-6 text-gold" />
                  <h3 className="text-h3">Share with family: coming soon</h3>
                  <p className="max-w-xl text-muted">
                    Soon you&apos;ll be able to send family a private link to compare two or three saved renders and vote for a favourite.
                  </p>
                  <Button disabled>Create a family link</Button>
                </CardBody>
              </Card>
            )}

            <div className="flex flex-wrap justify-between gap-3">
              <Button onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>
                Back
              </Button>
              {stepIndex < STEPS.length - 1 && (
                <Button variant={stepIndex === 3 ? "secondary" : "primary"} onClick={() => goTo(stepIndex + 1)}>
                  Next: {STEPS[stepIndex + 1]!.label}
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
  if (!render) return null;
  const already = isSaved(render.key);
  return (
    <Button onClick={() => onSave(render)} disabled={already || disabled} icon={<Bookmark aria-hidden className="size-4" />}>
      {already ? "Saved to your plan" : disabled ? `Saved renders are full (${PLAN_LIMITS.savedRenders})` : "Save this render"}
    </Button>
  );
}

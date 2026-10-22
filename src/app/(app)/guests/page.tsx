"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/auth/require-auth";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth/auth-provider";
import { addParty, deleteParty, saveGuestSettings, updateParty, watchGuestSettings, watchParties, type GuestListSettings } from "@/lib/data/guests";
import { watchMyPlans, type PlanRow } from "@/lib/data/plans";
import type { WithId } from "@/lib/data/venues";
import { GUEST_LIMITS, partySeats, summariseGuests, TIER_LABEL_KEYS, TIERS, validateParty, type GuestParty, type GuestTier } from "@/lib/guests/helper";
import { useT } from "@/lib/i18n/provider";
import { formatSGD } from "@/lib/money";
import { slideDown } from "@/lib/motion";
import { usePlanEstimate } from "@/lib/plans/use-plan-estimate";

export default function GuestsPage() {
  return (
    <RequireAuth role="couple">
      <AppHeader />
      <Guests />
    </RequireAuth>
  );
}

const emptyParty: GuestParty = { label: "", tier: "must", seats: 1, plusOnes: 0 };

function Guests() {
  const auth = useAuth();
  const uid = auth.status === "ready" ? auth.user.uid : null;
  const toast = useToast();
  const t = useT();
  const [parties, setParties] = useState<WithId<GuestParty>[] | null>(null);
  const [settings, setSettings] = useState<GuestListSettings | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [editing, setEditing] = useState<string | "new" | null>(null);

  useEffect(() => {
    if (!uid) return;
    const subs = [
      watchParties(uid, setParties, () => setParties([])),
      watchGuestSettings(uid, setSettings),
      watchMyPlans(uid, setPlans, () => setPlans([])),
    ];
    return () => subs.forEach((u) => u());
  }, [uid]);

  const planId = settings?.planId && plans.some((p) => p.id === settings.planId) ? settings.planId : (plans[0]?.id ?? null);
  const plan = plans.find((p) => p.id === planId) ?? null;
  const { space, estimates } = usePlanEstimate(plan);
  const summary = useMemo(
    () => (parties && settings ? summariseGuests(parties, space?.capacityMax ?? null, settings.trimOrder) : null),
    [parties, settings, space],
  );

  if (!uid) return null;
  const save = (s: GuestListSettings) => saveGuestSettings(uid, s).catch(() => toast({ title: t("guests.saveError"), tone: "error" }));

  function moveTier(i: number, delta: -1 | 1) {
    if (!settings) return;
    const order = [...settings.trimOrder];
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j]!, order[i]!];
    void save({ ...settings, trimOrder: order });
  }

  return (
    <main className="container-page flex flex-col gap-6 py-10 pb-28 sm:pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">{t("nav.guests")}</h1>
        <p className="max-w-2xl text-muted">{t("guests.subtitle")}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
        <section aria-labelledby="parties-h" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="parties-h" className="text-h2">
              {t("guests.parties")}
            </h2>
            {editing !== "new" && (
              <Button variant="primary" onClick={() => setEditing("new")} icon={<Plus aria-hidden className="size-4" />}>
                {t("guests.addParty")}
              </Button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {editing === "new" && (
              <motion.div variants={slideDown} initial="hidden" animate="visible" exit="exit">
                <Card>
                  <CardBody>
                    <PartyForm
                      initial={emptyParty}
                      submitLabel={t("guests.addPartySubmit")}
                      onCancel={() => setEditing(null)}
                      onSave={async (p) => {
                        await addParty(uid, p);
                        setEditing(null);
                      }}
                    />
                  </CardBody>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
          {!parties && <SkeletonList rows={3} label={t("guests.loading")} />}
          {parties?.length === 0 && editing !== "new" && (
            <EmptyState icon={<Users aria-hidden className="size-8" />} title={t("guests.emptyTitle")} action={<Button onClick={() => setEditing("new")}>{t("guests.addFirst")}</Button>}>
              {t("guests.emptyBody")}
            </EmptyState>
          )}
          {parties &&
            TIERS.map((tier) => {
              const rows = parties.filter((p) => p.tier === tier);
              if (!rows.length) return null;
              return (
                <section key={tier} aria-label={t(TIER_LABEL_KEYS[tier])} className="flex flex-col gap-2">
                  <h3 className="flex items-baseline justify-between text-small font-semibold">
                    {t(TIER_LABEL_KEYS[tier])}
                    <span className="num text-muted">{t("guests.seats", { count: summary?.byTier[tier] ?? 0 })}</span>
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {rows.map((p) =>
                      editing === p.id ? (
                        <li key={p.id}>
                          <Card>
                            <CardBody>
                              <PartyForm
                                initial={p}
                                submitLabel={t("guests.savePartySubmit")}
                                onCancel={() => setEditing(null)}
                                onSave={async (np) => {
                                  await updateParty(uid, p.id, np);
                                  setEditing(null);
                                }}
                              />
                            </CardBody>
                          </Card>
                        </li>
                      ) : (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-2">
                          <span className="flex flex-col">
                            <span>{p.label}</span>
                            <span className="num text-small text-muted">
                              {p.plusOnes
                                ? t("guests.seatsWithPlusOnes", { seats: t("guests.seats", { count: p.seats }), plusOnes: t("guests.plusOnes", { count: p.plusOnes }) })
                                : t("guests.seats", { count: p.seats })}
                            </span>
                          </span>
                          <span className="flex">
                            <Button variant="ghost" aria-label={t("guests.editAria", { label: p.label })} onClick={() => setEditing(p.id)} icon={<Pencil aria-hidden className="size-4" />} />
                            <Button
                              variant="ghost"
                              aria-label={t("guests.removeAria", { label: p.label })}
                              onClick={() => deleteParty(uid, p.id).catch(() => toast({ title: t("guests.removeError"), tone: "error" }))}
                              icon={<Trash2 aria-hidden className="size-4" />}
                            />
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              );
            })}
        </section>

        <aside aria-label={t("guests.summaryAria")} className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card>
            <CardBody className="flex flex-col gap-4">
              {plans.length > 0 ? (
                <Select
                  label={t("guests.compareWithPlan")}
                  options={plans.map((p) => ({ value: p.id, label: p.name }))}
                  value={planId ?? undefined}
                  onValueChange={(v) => settings && void save({ ...settings, planId: v })}
                />
              ) : (
                <p className="text-small text-muted">{t("guests.savePlanHint")}</p>
              )}
              {summary && (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-small text-muted">{t("guests.seatsLabel")}</span>
                    <span className="num font-display text-h2">
                      <AnimatedNumber value={summary.totalSeats} />
                      {space && <span className="text-h3 text-muted"> / {space.capacityMax}</span>}
                    </span>
                  </div>
                  {space && (
                    <div
                      role="meter"
                      aria-label={t("guests.seatsUsed")}
                      aria-valuemin={0}
                      aria-valuemax={space.capacityMax}
                      aria-valuenow={summary.totalSeats}
                      className="h-2 overflow-hidden rounded-full bg-subtle"
                    >
                      <div
                        className={`h-full origin-left rounded-full transition-transform duration-300 ${summary.over ? "bg-warning-icon" : "bg-accent"}`}
                        style={{ transform: `scaleX(${Math.min(1, summary.totalSeats / space.capacityMax)})` }}
                      />
                    </div>
                  )}
                  {summary.remaining !== null && (
                    <div aria-live="polite">
                      {summary.over === 0 ? (
                        <p className="flex items-center gap-2 text-small font-semibold text-success">
                          <CircleCheck aria-hidden className="size-4" />
                          {t("guests.seatsLeft", { count: summary.remaining, room: space?.name ?? "" })}
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2 rounded-lg border border-warning-icon p-3 text-small text-warning">
                          <p className="flex items-start gap-2 font-semibold">
                            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-icon" />
                            {t("guests.overMax", { over: summary.over, max: space?.capacityMax ?? "" })}
                          </p>
                          {summary.trimSuggestion.length > 0 && (
                            <p>
                              {t(summary.trimNotEnough ? "guests.trimNotEnough" : "guests.trimToFit", {
                                list: summary.trimSuggestion
                                  .map((s) => t("guests.trimItem", { tier: t(TIER_LABEL_KEYS[s.tier]), count: s.seats }))
                                  .reduce((first, next) => t("guests.trimThen", { first, next })),
                              })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {estimates?.combinedPerGuestCents != null && plan && (
                    <p className="num text-small text-muted">
                      {t("guests.perGuestIn", { amount: formatSGD(estimates.combinedPerGuestCents), plan: plan.name, count: plan.headcount })}
                    </p>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          {settings && (
            <Card>
              <CardBody className="flex flex-col gap-3">
                <h2 className="text-h3">{t("guests.trimTitle")}</h2>
                <p className="text-small text-muted">{t("guests.trimHint")}</p>
                <ol className="flex flex-col gap-2">
                  {settings.trimOrder.map((tier, i) => (
                    <li key={tier} className="flex items-center justify-between rounded-lg bg-subtle px-3 py-1">
                      <span>{t("guests.trimOrderItem", { n: i + 1, tier: t(TIER_LABEL_KEYS[tier]) })}</span>
                      <span className="flex">
                        <Button variant="ghost" aria-label={t("guests.moveEarlier", { tier: t(TIER_LABEL_KEYS[tier]) })} disabled={i === 0} onClick={() => moveTier(i, -1)} icon={<ArrowUp aria-hidden className="size-4" />} />
                        <Button
                          variant="ghost"
                          aria-label={t("guests.moveLater", { tier: t(TIER_LABEL_KEYS[tier]) })}
                          disabled={i === settings.trimOrder.length - 1}
                          onClick={() => moveTier(i, 1)}
                          icon={<ArrowDown aria-hidden className="size-4" />}
                        />
                      </span>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}

function PartyForm({ initial, submitLabel, onSave, onCancel }: { initial: GuestParty; submitLabel: string; onSave: (p: GuestParty) => Promise<void>; onCancel: () => void }) {
  const [label, setLabel] = useState(initial.label);
  const [tier, setTier] = useState<GuestTier>(initial.tier);
  const [seats, setSeats] = useState(String(initial.seats));
  const [plusOnes, setPlusOnes] = useState(String(initial.plusOnes));
  const [errors, setErrors] = useState<Partial<Record<keyof GuestParty | "form", string>>>({});
  const [busy, setBusy] = useState(false);
  const t = useT();
  const toInt = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : Number.NaN);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const p: GuestParty = { label: label.trim(), tier, seats: toInt(seats), plusOnes: toInt(plusOnes) };
    const e = validateParty(p);
    setErrors({
      label: e.label && t(e.label, { max: GUEST_LIMITS.labelMax }),
      seats: e.seats && t(e.seats, { max: GUEST_LIMITS.seatsMax }),
      plusOnes: e.plusOnes && t(e.plusOnes, { max: GUEST_LIMITS.plusOnesMax }),
      tier: e.tier && t(e.tier),
    });
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await onSave(p);
    } catch {
      setErrors({ form: t("error.save") });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Input label={t("guests.partyLabel")} placeholder={t("guests.partyPlaceholder")} value={label} maxLength={GUEST_LIMITS.labelMax} onChange={(e) => setLabel(e.target.value)} error={errors.label} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label={t("guests.tierLabel")} options={TIERS.map((tier) => ({ value: tier, label: t(TIER_LABEL_KEYS[tier]) }))} value={tier} onValueChange={(v) => setTier(v as GuestTier)} />
        <Input label={t("guests.seatsLabel")} inputMode="numeric" className="num" value={seats} onChange={(e) => setSeats(e.target.value)} error={errors.seats} />
        <Input label={t("guests.plusOnesLabel")} inputMode="numeric" className="num" value={plusOnes} onChange={(e) => setPlusOnes(e.target.value)} error={errors.plusOnes} />
      </div>
      <p className="num text-small text-muted">
        {Number.isNaN(toInt(seats) + toInt(plusOnes)) ? t("guests.totalForPartyUnknown") : t("guests.totalForParty", { count: partySeats({ seats: toInt(seats), plusOnes: toInt(plusOnes) }) })}
      </p>
      {errors.form && (
        <p role="alert" className="text-small text-error">
          {errors.form}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" loading={busy}>
          {submitLabel}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

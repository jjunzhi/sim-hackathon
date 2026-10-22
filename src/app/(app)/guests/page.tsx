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
import { GUEST_LIMITS, partySeats, summariseGuests, TIER_LABELS, TIERS, validateParty, type GuestParty, type GuestTier } from "@/lib/guests/helper";
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
  const save = (s: GuestListSettings) => saveGuestSettings(uid, s).catch(() => toast({ title: "We couldn't save that", tone: "error" }));

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
        <h1 className="text-h1">Guests</h1>
        <p className="max-w-2xl text-muted">
          Count seats against your room. Only labels you write and seat numbers are kept: no contact details.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
        <section aria-labelledby="parties-h" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="parties-h" className="text-h2">
              Parties
            </h2>
            {editing !== "new" && (
              <Button variant="primary" onClick={() => setEditing("new")} icon={<Plus aria-hidden className="size-4" />}>
                Add a party
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
                      submitLabel="Add party"
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
          {!parties && <SkeletonList rows={3} label="Loading guests" />}
          {parties?.length === 0 && editing !== "new" && (
            <EmptyState icon={<Users aria-hidden className="size-8" />} title="No guests yet" action={<Button onClick={() => setEditing("new")}>Add your first party</Button>}>
              Add families or groups with how many seats they need. You choose each party&apos;s tier.
            </EmptyState>
          )}
          {parties &&
            TIERS.map((tier) => {
              const rows = parties.filter((p) => p.tier === tier);
              if (!rows.length) return null;
              return (
                <section key={tier} aria-label={TIER_LABELS[tier]} className="flex flex-col gap-2">
                  <h3 className="flex items-baseline justify-between text-small font-semibold">
                    {TIER_LABELS[tier]}
                    <span className="num text-muted">{summary?.byTier[tier]} seats</span>
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {rows.map((p) =>
                      editing === p.id ? (
                        <li key={p.id}>
                          <Card>
                            <CardBody>
                              <PartyForm
                                initial={p}
                                submitLabel="Save party"
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
                              {p.seats} {p.seats === 1 ? "seat" : "seats"}
                              {p.plusOnes ? ` + ${p.plusOnes} plus-${p.plusOnes === 1 ? "one" : "ones"}` : ""}
                            </span>
                          </span>
                          <span className="flex">
                            <Button variant="ghost" aria-label={`Edit ${p.label}`} onClick={() => setEditing(p.id)} icon={<Pencil aria-hidden className="size-4" />} />
                            <Button
                              variant="ghost"
                              aria-label={`Remove ${p.label}`}
                              onClick={() => deleteParty(uid, p.id).catch(() => toast({ title: "We couldn't remove that", tone: "error" }))}
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

        <aside aria-label="Seat summary" className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card>
            <CardBody className="flex flex-col gap-4">
              {plans.length > 0 ? (
                <Select
                  label="Compare with plan"
                  options={plans.map((p) => ({ value: p.id, label: p.name }))}
                  value={planId ?? undefined}
                  onValueChange={(v) => settings && void save({ ...settings, planId: v })}
                />
              ) : (
                <p className="text-small text-muted">Save a plan to compare your guests with a room.</p>
              )}
              {summary && (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-small text-muted">Seats</span>
                    <span className="num font-display text-h2">
                      <AnimatedNumber value={summary.totalSeats} />
                      {space && <span className="text-h3 text-muted"> / {space.capacityMax}</span>}
                    </span>
                  </div>
                  {space && (
                    <div
                      role="meter"
                      aria-label="Seats used"
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
                          {summary.remaining} {summary.remaining === 1 ? "seat" : "seats"} left in {space?.name}
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2 rounded-lg border border-warning-icon p-3 text-small text-warning">
                          <p className="flex items-start gap-2 font-semibold">
                            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-icon" />
                            {summary.over} over the room&apos;s maximum of {space?.capacityMax}
                          </p>
                          {summary.trimSuggestion.length > 0 && (
                            <p>
                              Trim {summary.trimSuggestion.map((t) => `${TIER_LABELS[t.tier]} (${t.seats} seats)`).join(", then ")} first
                              {summary.trimNotEnough ? ". Even that isn't enough: consider a larger room." : " to fit."}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {estimates?.combinedPerGuestCents != null && plan && (
                    <p className="num text-small text-muted">
                      About {formatSGD(estimates.combinedPerGuestCents)} per guest in &quot;{plan.name}&quot; ({plan.headcount} guests). Estimate.
                    </p>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          {settings && (
            <Card>
              <CardBody className="flex flex-col gap-3">
                <h2 className="text-h3">If you need to trim</h2>
                <p className="text-small text-muted">Suggestions follow this order. &quot;Must invite&quot; is never suggested.</p>
                <ol className="flex flex-col gap-2">
                  {settings.trimOrder.map((t, i) => (
                    <li key={t} className="flex items-center justify-between rounded-lg bg-subtle px-3 py-1">
                      <span>
                        {i + 1}. {TIER_LABELS[t]}
                      </span>
                      <span className="flex">
                        <Button variant="ghost" aria-label={`Move ${TIER_LABELS[t]} earlier`} disabled={i === 0} onClick={() => moveTier(i, -1)} icon={<ArrowUp aria-hidden className="size-4" />} />
                        <Button
                          variant="ghost"
                          aria-label={`Move ${TIER_LABELS[t]} later`}
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
  const toInt = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : Number.NaN);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const p: GuestParty = { label: label.trim(), tier, seats: toInt(seats), plusOnes: toInt(plusOnes) };
    const e = validateParty(p);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await onSave(p);
    } catch {
      setErrors({ form: "We couldn't save that. Please try again." });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Input label="Party" placeholder="For example, Auntie Mei's family" value={label} maxLength={GUEST_LIMITS.labelMax} onChange={(e) => setLabel(e.target.value)} error={errors.label} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Tier" options={TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] }))} value={tier} onValueChange={(v) => setTier(v as GuestTier)} />
        <Input label="Seats" inputMode="numeric" className="num" value={seats} onChange={(e) => setSeats(e.target.value)} error={errors.seats} />
        <Input label="Plus-ones" inputMode="numeric" className="num" value={plusOnes} onChange={(e) => setPlusOnes(e.target.value)} error={errors.plusOnes} />
      </div>
      <p className="num text-small text-muted">Total for this party: {Number.isNaN(toInt(seats) + toInt(plusOnes)) ? "-" : partySeats({ seats: toInt(seats), plusOnes: toInt(plusOnes) })} seats</p>
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
          Cancel
        </Button>
      </div>
    </form>
  );
}

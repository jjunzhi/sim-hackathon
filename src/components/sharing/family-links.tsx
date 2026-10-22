"use client";

import { AnimatePresence, motion } from "motion/react";
import { Copy, Link2Off, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { StorageImage } from "@/components/photos/storage-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { watchMyPlans, type PlanRow } from "@/lib/data/plans";
import { createShare, deleteShare, revokeShare, shareUrl, watchMyShares, type ShareRow } from "@/lib/data/shares";
import { formatSGD } from "@/lib/money";
import { slideDown } from "@/lib/motion";
import { usePlanEstimate } from "@/lib/plans/use-plan-estimate";
import { useT } from "@/lib/i18n/provider";
import { themeLabelT } from "@/lib/render/themes";
import { SHARE_LIMITS, type ShareOption } from "@/lib/sharing/model";
import { optionLetter, ShareResults } from "./share-results";

/** Create family links from saved renders in any plan, and see what family think. */
export function FamilyLinks({ uid }: { uid: string }) {
  const toast = useToast();
  const t = useT();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [shares, setShares] = useState<ShareRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [chosen, setChosen] = useState<ShareOption[]>([]);
  const [title, setTitle] = useState(() => t("sharing.defaultQuestion"));
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<ShareRow | null>(null);
  const [removing, setRemoving] = useState<ShareRow | null>(null);

  useEffect(() => {
    const a = watchMyPlans(uid, setPlans, () => undefined);
    const b = watchMyShares(uid, setShares, () => setShares([]));
    return () => {
      a();
      b();
    };
  }, [uid]);

  const renderCount = plans.reduce((n, p) => n + p.savedRenders.length, 0);
  const toggle = (o: ShareOption) =>
    setChosen((prev) => (prev.some((x) => x.renderKey === o.renderKey && x.planId === o.planId) ? prev.filter((x) => !(x.renderKey === o.renderKey && x.planId === o.planId)) : prev.length >= SHARE_LIMITS.maxOptions ? prev : [...prev, o]));

  async function create() {
    setBusy(true);
    try {
      const id = await createShare(uid, title.trim().slice(0, SHARE_LIMITS.titleMax), chosen);
      await navigator.clipboard?.writeText(shareUrl(id)).catch(() => undefined);
      toast({ title: t("sharing.created"), description: t("sharing.createdDescription"), tone: "success" });
      setCreating(false);
      setChosen([]);
    } catch {
      toast({ title: t("sharing.createError"), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2">{t("sharing.title")}</h2>
          <p className="max-w-2xl text-muted">{t("sharing.subtitle")}</p>
        </div>
        {!creating && (
          <Button variant="primary" disabled={renderCount < 2} onClick={() => setCreating(true)} icon={<Plus aria-hidden className="size-4" />}>
            {t("sharing.create")}
          </Button>
        )}
      </div>
      {renderCount < 2 && <p className="text-small text-muted">{t("sharing.needTwo")}</p>}

      <AnimatePresence initial={false}>
        {creating && (
          <motion.div variants={slideDown} initial="hidden" animate="visible" exit="exit">
            <Card>
              <CardBody className="flex flex-col gap-5">
                <Input label={t("sharing.questionLabel")} value={title} maxLength={SHARE_LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} />
                <fieldset className="flex flex-col gap-4">
                  <legend className="mb-1 text-small font-semibold">
                    {t("sharing.chooseRenders")} <span className="num font-normal text-muted">{t("sharing.chosen", { count: chosen.length })}</span>
                  </legend>
                  {plans
                    .filter((p) => p.savedRenders.length)
                    .map((p) => (
                      <PlanRenders key={p.id} plan={p} chosen={chosen} onToggle={toggle} />
                    ))}
                </fieldset>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" loading={busy} disabled={chosen.length < SHARE_LIMITS.minOptions || !title.trim()} onClick={create}>
                    {t("sharing.createLink")}
                  </Button>
                  <Button onClick={() => setCreating(false)} disabled={busy}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {shares?.length === 0 && !creating && (
        <EmptyState icon={<Users aria-hidden className="size-8" />} title={t("sharing.emptyTitle")}>
          {t("sharing.emptyBody")}
        </EmptyState>
      )}
      <ul className="flex flex-col gap-4">
        {shares?.map((s) => (
          <li key={s.id}>
            <Card>
              <CardBody className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-h3">{s.status === "active" ? s.title : t("sharing.turnedOffLink")}</h3>
                  {s.status === "active" ? <Badge tone="confirmed">{t("sharing.active")}</Badge> : <Badge tone="neutral">{t("sharing.turnedOff")}</Badge>}
                </div>
                {s.status === "active" && (
                  <>
                    <div className="flex flex-wrap items-end gap-2">
                      <Input label={t("sharing.linkLabel")} readOnly value={shareUrl(s.id)} className="min-w-0 flex-1" onFocus={(e) => e.currentTarget.select()} />
                      <Button
                        onClick={() =>
                          navigator.clipboard
                            ?.writeText(shareUrl(s.id))
                            .then(() => toast({ title: t("sharing.copied"), tone: "success" }))
                            .catch(() => toast({ title: t("sharing.copyFailed"), tone: "error" }))
                        }
                        icon={<Copy aria-hidden className="size-4" />}
                      >
                        {t("common.copy")}
                      </Button>
                    </div>
                    <ShareResults shareId={s.id} options={s.options} />
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  {s.status === "active" && (
                    <Button variant="ghost" onClick={() => setRevoking(s)} icon={<Link2Off aria-hidden className="size-4" />}>
                      {t("sharing.turnOffLink")}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setRemoving(s)} icon={<Trash2 aria-hidden className="size-4" />}>
                    {t("sharing.deleteLinkVotes")}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <Modal
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={t("sharing.revokeTitle")}
        description={t("sharing.revokeDescription")}
        footer={
          <>
            <Button onClick={() => setRevoking(null)}>{t("sharing.keepItOn")}</Button>
            <Button
              variant="primary"
              onClick={async () => {
                const s = revoking!;
                setRevoking(null);
                await revokeShare(s.id).then(() => toast({ title: t("sharing.revoked") })).catch(() => toast({ title: t("sharing.revokeError"), tone: "error" }));
              }}
            >
              {t("sharing.turnOff")}
            </Button>
          </>
        }
      />
      <Modal
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t("sharing.deleteTitle")}
        description={t("sharing.deleteDescription")}
        footer={
          <>
            <Button onClick={() => setRemoving(null)}>{t("sharing.keepIt")}</Button>
            <Button
              variant="primary"
              onClick={async () => {
                const s = removing!;
                setRemoving(null);
                await deleteShare(s.id).then(() => toast({ title: t("sharing.deleted") })).catch(() => toast({ title: t("sharing.deleteError"), tone: "error" }));
              }}
            >
              {t("common.delete")}
            </Button>
          </>
        }
      />
    </div>
  );
}

function PlanRenders({ plan, chosen, onToggle }: { plan: PlanRow; chosen: ShareOption[]; onToggle: (o: ShareOption) => void }) {
  const t = useT();
  const { venue, space, estimates } = usePlanEstimate(plan);
  if (!venue || !estimates) return <p className="text-small text-muted">{t("sharing.loadingPlan", { plan: plan.name })}</p>;
  const aspect = space?.photo ? `${space.photo.width} / ${space.photo.height}` : "4 / 3";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-small">
        <span className="font-semibold">{plan.name}</span> · {venue.name} · <span className="num">{t("sharing.amountEstimate", { amount: formatSGD(estimates.combinedTotalCents) })}</span>
      </p>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {plan.savedRenders.map((r) => {
          const option: ShareOption = {
            planId: plan.id, planName: plan.name, venueName: venue.name, renderKey: r.key, renderPath: r.path, themeId: r.themeId,
            demo: r.demo, aspect, estimateTotalCents: estimates.combinedTotalCents,
          };
          const idx = chosen.findIndex((c) => c.renderKey === r.key && c.planId === plan.id);
          const on = idx >= 0;
          return (
            <li key={r.key}>
              <label
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-2 transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  on ? "border-accent bg-accent-tint" : "border-transparent hover:bg-subtle",
                )}
              >
                <input type="checkbox" className="sr-only" checked={on} onChange={() => onToggle(option)} />
                <StorageImage
                  photo={{ path: r.path, width: space?.photo?.width ?? 4, height: space?.photo?.height ?? 3, contentType: "image/jpeg" }}
                  alt={t("render.savedAlt", { theme: themeLabelT(t, r.themeId) })}
                  aspect={aspect}
                  sizes="(min-width: 48rem) 220px, 45vw"
                />
                <span className="flex items-center justify-between text-small">
                  <span>{r.demo ? t("sharing.themeDemo", { theme: themeLabelT(t, r.themeId) }) : themeLabelT(t, r.themeId)}</span>
                  {on && <span className="font-semibold text-accent-text">{t("sharing.option", { letter: optionLetter(idx) })}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

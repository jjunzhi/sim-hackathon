"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { LayoutList, Pencil, Printer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/auth/require-auth";
import { FamilyLinks } from "@/components/sharing/family-links";
import { StorageImage } from "@/components/photos/storage-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth/auth-provider";
import { watchConfirmationsBy, watchCoupleLeads, type ConfirmationRow, type LeadRow } from "@/lib/data/leads";
import { deletePlan, updatePlan, watchMyPlans, type PlanRow } from "@/lib/data/plans";
import { resolvePlan } from "@/lib/leads/resolve";
import { formatSGD } from "@/lib/money";
import { revealContainer, revealItem } from "@/lib/motion";
import { PLAN_LIMITS } from "@/lib/plans/model";
import { usePlanEstimate } from "@/lib/plans/use-plan-estimate";
import { themeLabel } from "@/lib/render/themes";

export default function PlansPage() {
  return (
    <RequireAuth role="couple">
      <AppHeader />
      <Plans />
    </RequireAuth>
  );
}

function Plans() {
  const auth = useAuth();
  const uid = auth.status === "ready" ? auth.user.uid : null;
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [confs, setConfs] = useState<ConfirmationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<PlanRow | null>(null);
  const [removing, setRemoving] = useState<PlanRow | null>(null);
  const [name, setName] = useState("");
  const toast = useToast();

  useEffect(() => {
    if (!uid) return;
    const subs = [
      watchMyPlans(uid, setPlans, () => setError("We couldn't load your plans. Please refresh the page.")),
      watchCoupleLeads(uid, setLeads),
      watchConfirmationsBy("coupleUid", uid, setConfs),
    ];
    return () => subs.forEach((u) => u());
  }, [uid]);

  return (
    <main className="container-page flex flex-col gap-6 py-10 pb-28 sm:pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">My plans</h1>
          <p className="text-muted">
            Compare venues side by side. You can keep up to {PLAN_LIMITS.plansPerCouple} plans.
          </p>
        </div>
        <Link href="/venues" className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover">
          Find another venue
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {!plans && !error && <SkeletonList rows={2} label="Loading plans" />}
      {plans?.length === 0 && (
        <EmptyState icon={<LayoutList aria-hidden className="size-8" />} title="No plans yet">
          Open a venue and choose &quot;Plan here&quot;. Your plan saves as you go.
        </EmptyState>
      )}
      {plans && plans.length > 0 && (
        <motion.ul variants={revealContainer} initial="hidden" animate="visible" className="grid gap-5 md:grid-cols-2">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              leads={leads}
              confirmations={confs}
              onRename={() => {
                setName(p.name);
                setRenaming(p);
              }}
              onRemove={() => setRemoving(p)}
            />
          ))}
        </motion.ul>
      )}

      {uid && (
        <section className="border-t border-line pt-8">
          <FamilyLinks uid={uid} />
        </section>
      )}

      <Modal
        open={renaming !== null}
        onOpenChange={(o) => !o && setRenaming(null)}
        title="Rename plan"
        footer={
          <>
            <Button onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={async () => {
                if (!renaming) return;
                const id = renaming.id;
                setRenaming(null);
                await updatePlan(id, { name: name.trim().slice(0, PLAN_LIMITS.nameMax) }).catch(() => toast({ title: "We couldn't rename that", tone: "error" }));
              }}
            >
              Save name
            </Button>
          </>
        }
      >
        <Input label="Plan name" value={name} maxLength={PLAN_LIMITS.nameMax} onChange={(e) => setName(e.target.value)} />
      </Modal>

      <Modal
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete "${removing?.name ?? "this plan"}"?`}
        description="Its choices and saved renders go with it. This can't be undone."
        footer={
          <>
            <Button onClick={() => setRemoving(null)}>Keep it</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!removing) return;
                const id = removing.id;
                setRemoving(null);
                try {
                  await deletePlan(id);
                  toast({ title: "Plan deleted" });
                } catch {
                  toast({ title: "We couldn't delete that plan", tone: "error" });
                }
              }}
            >
              Delete plan
            </Button>
          </>
        }
      />
    </main>
  );
}

function PlanCard({
  plan,
  leads,
  confirmations,
  onRename,
  onRemove,
}: {
  plan: PlanRow;
  leads: LeadRow[];
  confirmations: ConfirmationRow[];
  onRename: () => void;
  onRemove: () => void;
}) {
  const { venue, space, estimates, loading } = usePlanEstimate(plan);
  // Confirmed parts count at the price the vendor confirmed, as in the Studio and print view.
  const resolved = estimates ? resolvePlan({ plan, planId: plan.id, live: estimates, leads, confirmations, now: new Date() }) : null;
  const thumb = plan.savedRenders[plan.savedRenders.length - 1];
  return (
    <motion.li variants={revealItem}>
      <Card className="flex h-full flex-col">
        {thumb && space?.photo ? (
          <StorageImage
            photo={{ path: thumb.path, width: space.photo.width, height: space.photo.height, contentType: "image/jpeg" }}
            alt={`Saved AI illustration, ${themeLabel(thumb.themeId)} theme`}
            aspect="3 / 2"
            className="rounded-none"
            sizes="(min-width: 48rem) 50vw, 100vw"
          />
        ) : space?.photo ? (
          <StorageImage photo={space.photo} alt="" aspect="3 / 2" className="rounded-none" sizes="(min-width: 48rem) 50vw, 100vw" />
        ) : null}
        <CardBody className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-h3">{plan.name}</h2>
            <p className="text-small text-muted">{loading ? "Loading..." : venue ? `${venue.name}${space ? ` · ${space.name}` : ""}` : "This venue is no longer listed"}</p>
          </div>
          <p className="num text-small">
            {plan.headcount} guests · {themeLabel(plan.themeId)} · {plan.savedRenders.length} saved {plan.savedRenders.length === 1 ? "render" : "renders"}
          </p>
          {resolved && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="num font-display text-h3">{formatSGD(resolved.combinedTotalCents)}</span>
              {resolved.confirmedCount > 0 && resolved.confirmedCount === resolved.vendors.length ? (
                <Badge tone="confirmed">Vendor Confirmed</Badge>
              ) : (
                <>
                  <Badge tone="estimate">Estimate</Badge>
                  {resolved.confirmedCount > 0 && (
                    <span className="num text-small text-muted">
                      {resolved.confirmedCount} of {resolved.vendors.length} vendors confirmed
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Link href={`/studio/${plan.venueId}?plan=${plan.id}`} className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-5 font-semibold hover:bg-subtle">
              Open
            </Link>
            <Link
              href={`/plans/${plan.id}/print`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-semibold text-accent-text hover:bg-accent-tint"
              aria-label={`Print estimate for ${plan.name}`}
            >
              <Printer aria-hidden className="size-4" />
              Print
            </Link>
            <Button variant="ghost" onClick={onRename} icon={<Pencil aria-hidden className="size-4" />} aria-label={`Rename ${plan.name}`}>
              Rename
            </Button>
            <Button variant="ghost" onClick={onRemove} icon={<Trash2 aria-hidden className="size-4" />} aria-label={`Delete ${plan.name}`}>
              Delete
            </Button>
          </div>
        </CardBody>
      </Card>
    </motion.li>
  );
}

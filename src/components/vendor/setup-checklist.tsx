"use client";

import Link from "next/link";
import { ArrowRight, Circle, CircleCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { useBilling } from "@/lib/billing/use-billing";
import { watchItems } from "@/lib/data/vendors";
import { watchMyVenues, watchSpaces, type WithId } from "@/lib/data/venues";
import type { InventoryItem } from "@/lib/inventory/model";
import type { Space, Venue } from "@/lib/venues/model";
import type { VendorProfile } from "@/lib/vendors/model";
import { readinessProblems, setupSteps, type SetupInput } from "@/lib/vendors/setup-steps";

/** Live data for the setup checklist and the publish readiness check. */
export function useSetupInput(uid: string, profile: VendorProfile): SetupInput | null {
  const { billing, standing } = useBilling(uid);
  const [venues, setVenues] = useState<WithId<Venue>[] | null>(null);
  const [items, setItems] = useState<WithId<InventoryItem>[] | null>(null);
  const [spaces, setSpaces] = useState<Record<string, WithId<Space>[]>>({});
  const venueIds = (venues ?? []).map((v) => v.id).join(",");

  useEffect(() => {
    const subs = [watchMyVenues(uid, setVenues, () => setVenues([])), watchItems(uid, setItems, () => setItems([]))];
    return () => subs.forEach((u) => u());
  }, [uid]);
  useEffect(() => {
    if (!venueIds) return;
    const subs = venueIds.split(",").map((id) => watchSpaces(id, (s) => setSpaces((prev) => ({ ...prev, [id]: s })), () => undefined));
    return () => subs.forEach((u) => u());
  }, [venueIds]);

  if (!venues || !items || !billing || !standing) return null;
  return { profile, venues, items, spaces, goodStanding: standing.kind !== "lapsed" };
}

/**
 * The vendor's path from sign-up to being found by couples, on the Overview.
 * Hidden once everything is done. Each step links to where it's done.
 */
export function SetupChecklist({ uid, profile }: { uid: string; profile: VendorProfile }) {
  const input = useSetupInput(uid, profile);
  if (!input) return null;
  const steps = setupSteps(input);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const problems = readinessProblems(input);
  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-h2">Get set up</h2>
          <span className="num text-small text-muted" aria-live="polite">
            {done} of {steps.length} done
          </span>
        </div>
        <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} className="h-2 overflow-hidden rounded-full bg-subtle">
          <div className="h-full origin-left rounded-full bg-accent transition-transform duration-300" style={{ transform: `scaleX(${done / steps.length})` }} />
        </div>
        <ol className="flex flex-col divide-y divide-line">
          {steps.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex items-start gap-3">
                {s.done ? <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" /> : <Circle aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />}
                <span className="flex flex-col">
                  <span className={s.done ? "font-semibold" : "font-semibold text-ink"}>
                    <span className="num text-muted">{i + 1}.</span> {s.title}
                    <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
                  </span>
                  {s.todo && <span className="text-small text-muted">{s.todo}</span>}
                </span>
              </span>
              {!s.done && (
                <Link href={s.href} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent-text hover:underline underline-offset-4">
                  {s.id === "plan" ? "See plan" : s.id === "publish" ? "Go to publish" : "Open"}
                  <span className="sr-only">: {s.title}</span>
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              )}
            </li>
          ))}
        </ol>
        {problems.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-subtle p-3">
            <p className="flex items-center gap-2 text-small font-semibold">
              <TriangleAlert aria-hidden className="size-4 text-warning-icon" />
              Before couples see your listing
            </p>
            <ul className="list-disc pl-8 text-small text-muted">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

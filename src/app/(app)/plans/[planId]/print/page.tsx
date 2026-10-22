"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/ui/skeleton";
import { getPlan, type PlanRow } from "@/lib/data/plans";
import type { Estimate } from "@/lib/estimate/engine";
import { TIER_LABELS } from "@/lib/estimate/build";
import { formatBps, formatSGD } from "@/lib/money";
import { usePlanEstimate } from "@/lib/plans/use-plan-estimate";
import { sgDate } from "@/components/studio/resolved-estimates";
import { useAuth } from "@/lib/auth/auth-provider";
import { watchConfirmationsBy, watchCoupleLeads, type ConfirmationRow, type LeadRow } from "@/lib/data/leads";
import { resolvePlan } from "@/lib/leads/resolve";
import { themeLabel } from "@/lib/render/themes";

export default function PrintPage() {
  return (
    <RequireAuth role="couple">
      <PrintView />
    </RequireAuth>
  );
}

function working(l: Estimate["lines"][number]) {
  if (l.kind === "rental") return "";
  const one = l.count === 1;
  const unit = l.unit === "piece" ? (one ? "piece" : "pieces") : l.unit === "table" ? (one ? "table" : "tables") : one ? "guest" : "guests";
  return `${l.count} ${unit} × ${formatSGD(l.unitPriceCents)}`;
}

/** A plain A4 document: no navigation, light background, every fee itemised. */
function PrintView() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<PlanRow | null | undefined>(undefined);
  useEffect(() => {
    getPlan(planId).then(setPlan);
  }, [planId]);
  const { venue, space, estimates } = usePlanEstimate(plan ?? null);
  const auth = useAuth();
  const uid = auth.status === "ready" ? auth.user.uid : null;
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [confs, setConfs] = useState<ConfirmationRow[]>([]);
  useEffect(() => {
    if (!uid) return;
    const a = watchCoupleLeads(uid, setLeads);
    const b = watchConfirmationsBy("coupleUid", uid, setConfs);
    return () => {
      a();
      b();
    };
  }, [uid]);

  if (plan === null) {
    return (
      <main className="container-page py-10">
        <p role="alert">We couldn&apos;t open this plan.</p>
      </main>
    );
  }
  if (!plan || !estimates || !venue) {
    return (
      <main className="container-page py-10">
        <SkeletonList rows={2} label="Preparing your estimate" />
      </main>
    );
  }
  const printed = new Date().toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });
  // Confirmed parts print exactly as the vendor confirmed them, with their validity date.
  const resolved = resolvePlan({ plan, planId: plan.id, live: estimates, leads, confirmations: confs, now: new Date() });
  const allConfirmed = resolved.confirmedCount === resolved.vendors.length;

  return (
    <main className="print-doc mx-auto flex max-w-3xl flex-col gap-6 bg-surface px-4 py-8 text-ink sm:px-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/studio/${plan.venueId}?plan=${plan.id}&step=estimate`} className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" />
          Back to the plan
        </Link>
        <Button variant="primary" onClick={() => window.print()} icon={<Printer aria-hidden className="size-4" />}>
          Print or save as PDF
        </Button>
      </div>

      <header className="flex flex-col gap-1 border-b border-line pb-4">
        <p className="text-small font-semibold uppercase tracking-widest">
          {allConfirmed ? "Vendor confirmed" : resolved.confirmedCount ? "Partly vendor confirmed · Estimate" : "Estimate · not a final quote"}
        </p>
        <h1 className="text-h1">{plan.name}</h1>
        <p>
          {venue.name}
          {space ? ` · ${space.name}` : ""}
          {plan.tierKey && TIER_LABELS[plan.tierKey] ? ` · ${TIER_LABELS[plan.tierKey]} pricing` : ""}
        </p>
        <p className="num text-small">
          {plan.headcount} guests · Theme: {themeLabel(plan.themeId)} · Prepared {printed}
        </p>
      </header>

      {estimates.unavailable.length > 0 && <p className="text-small">Note: {estimates.unavailable.length} item(s) are no longer offered and are not included.</p>}

      {resolved.vendors.map((v) => (
        <section key={v.vendorUid} className="print-avoid-break flex flex-col gap-2">
          <h2 className="text-h3">
            {v.vendorName}
            {v.isVenue ? " (venue)" : ""}
          </h2>
          <p className="text-small font-semibold">
            {v.status.kind === "confirmed"
              ? `Vendor Confirmed · Valid until ${sgDate(v.status.validUntilMs)}`
              : v.status.kind === "expired"
                ? `Estimate · the vendor's confirmation expired on ${sgDate(v.status.validUntilMs)}`
                : v.status.kind === "changed"
                  ? "Estimate · changed since the vendor confirmed"
                  : "Estimate"}
          </p>
          <table className="num w-full border-collapse text-small">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-1.5 font-semibold">Item</th>
                <th scope="col" className="py-1.5 font-semibold">Working</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {v.estimate.lines.map((l) => (
                <tr key={l.kind === "rental" ? "rental" : `${l.kind}:${l.id}`} className="border-b border-line">
                  <td className="py-1.5 pr-2">{l.label}</td>
                  <td className="py-1.5 pr-2">{working(l)}</td>
                  <td className="py-1.5 text-right">{formatSGD(l.amountCents)}</td>
                </tr>
              ))}
              <tr className="border-b border-line font-semibold">
                <td className="py-1.5" colSpan={2}>Subtotal</td>
                <td className="py-1.5 text-right">{formatSGD(v.estimate.subtotalCents)}</td>
              </tr>
              {v.estimate.minimumSpendShortfall && (
                <tr className="border-b border-line">
                  <td className="py-1.5" colSpan={2}>
                    Minimum spend shortfall (minimum {formatSGD(v.estimate.minimumSpendShortfall.minimumCents)})
                  </td>
                  <td className="py-1.5 text-right">{formatSGD(v.estimate.minimumSpendShortfall.shortfallCents)}</td>
                </tr>
              )}
              {v.estimate.serviceCharge && (
                <tr className="border-b border-line">
                  <td className="py-1.5" colSpan={2}>Service charge ({formatBps(v.estimate.serviceCharge.rateBps)})</td>
                  <td className="py-1.5 text-right">{formatSGD(v.estimate.serviceCharge.amountCents)}</td>
                </tr>
              )}
              {v.estimate.gst && (
                <tr className="border-b border-line">
                  <td className="py-1.5" colSpan={2}>GST ({formatBps(v.estimate.gst.rateBps)})</td>
                  <td className="py-1.5 text-right">{formatSGD(v.estimate.gst.amountCents)}</td>
                </tr>
              )}
              <tr className="font-semibold">
                <td className="py-2" colSpan={2}>{v.status.kind === "confirmed" ? "Confirmed total" : "Estimated total"}</td>
                <td className="py-2 text-right text-body">{formatSGD(v.estimate.totalCents)}</td>
              </tr>
            </tbody>
          </table>
          {v.estimate.notes.map((n) => (
            <p key={n} className="text-small">
              {n}
            </p>
          ))}
        </section>
      ))}

      <section className="print-avoid-break flex flex-col gap-1 border-t-2 border-ink pt-3">
        <p className="flex justify-between font-semibold">
          <span>
            {allConfirmed ? "Confirmed total" : "Estimated total"}
            {resolved.vendors.length > 1 ? ` across ${resolved.vendors.length} vendors` : ""}
          </span>
          <span className="num text-h3">{formatSGD(resolved.combinedTotalCents)}</span>
        </p>
        {resolved.combinedPerGuestCents !== null && <p className="num text-small">About {formatSGD(resolved.combinedPerGuestCents)} per guest</p>}
      </section>

      <footer className="flex flex-col gap-1 text-small">
        <p>
          {resolved.confirmedCount > 0
            ? "Confirmed parts are fixed until the date shown. Anything marked Estimate uses current prices and is not a final quote."
            : "This is an estimate based on current prices, not a final quote."}{" "}
          Each vendor confirms only its own part.
        </p>
        <p>Prices in Singapore dollars. Generated by WeddingVista.</p>
      </footer>
    </main>
  );
}

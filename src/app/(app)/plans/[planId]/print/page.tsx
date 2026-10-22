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
import { useLocale } from "@/lib/i18n/provider";
import { useAuth } from "@/lib/auth/auth-provider";
import { watchConfirmationsBy, watchCoupleLeads, type ConfirmationRow, type LeadRow } from "@/lib/data/leads";
import { resolvePlan } from "@/lib/leads/resolve";
import { themeLabelT } from "@/lib/render/themes";

export default function PrintPage() {
  return (
    <RequireAuth role="couple">
      <PrintView />
    </RequireAuth>
  );
}

type T = ReturnType<typeof useLocale>["t"];

function working(t: T, l: Estimate["lines"][number]) {
  if (l.kind === "rental") return "";
  const key = l.unit === "piece" ? "print.workingPiece" : l.unit === "table" ? "print.workingTable" : "print.workingGuest";
  return t(key, { count: l.count, price: formatSGD(l.unitPriceCents) });
}

/** A plain A4 document: no navigation, light background, every fee itemised. */
function PrintView() {
  const { planId } = useParams<{ planId: string }>();
  const { t, date } = useLocale();
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
        <p role="alert">{t("print.openError")}</p>
      </main>
    );
  }
  if (!plan || !estimates || !venue) {
    return (
      <main className="container-page py-10">
        <SkeletonList rows={2} label={t("print.preparing")} />
      </main>
    );
  }
  const printed = date(new Date().getTime(), { day: "numeric", month: "long", year: "numeric" });
  // Confirmed parts print exactly as the vendor confirmed them, with their validity date.
  const resolved = resolvePlan({ plan, planId: plan.id, live: estimates, leads, confirmations: confs, now: new Date() });
  const allConfirmed = resolved.confirmedCount === resolved.vendors.length;

  return (
    <main className="print-doc mx-auto flex max-w-3xl flex-col gap-6 bg-surface px-4 py-8 text-ink sm:px-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/studio/${plan.venueId}?plan=${plan.id}&step=estimate`} className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" />
          {t("print.back")}
        </Link>
        <Button variant="primary" onClick={() => window.print()} icon={<Printer aria-hidden className="size-4" />}>
          {t("print.printButton")}
        </Button>
      </div>

      <header className="flex flex-col gap-1 border-b border-line pb-4">
        <p className="text-small font-semibold uppercase tracking-widest">
          {allConfirmed ? t("print.statusConfirmed") : resolved.confirmedCount ? t("print.statusPartly") : t("print.statusEstimate")}
        </p>
        <h1 className="text-h1">{plan.name}</h1>
        <p>
          {venue.name}
          {space ? ` · ${space.name}` : ""}
          {plan.tierKey && TIER_LABELS[plan.tierKey] ? ` · ${t("print.tierPricing", { tier: TIER_LABELS[plan.tierKey] })}` : ""}
        </p>
        <p className="num text-small">
          {t("print.meta", { count: plan.headcount, theme: themeLabelT(t, plan.themeId), date: printed })}
        </p>
      </header>

      {estimates.unavailable.length > 0 && <p className="text-small">{t("print.unavailable", { count: estimates.unavailable.length })}</p>}

      {resolved.vendors.map((v) => (
        <section key={v.vendorUid} className="print-avoid-break flex flex-col gap-2">
          <h2 className="text-h3">{v.isVenue ? t("print.vendorVenue", { name: v.vendorName }) : v.vendorName}</h2>
          <p className="text-small font-semibold">
            {v.status.kind === "confirmed"
              ? t("badge.vendorConfirmedUntil", { date: date(v.status.validUntilMs) })
              : v.status.kind === "expired"
                ? t("print.vendorExpired", { date: date(v.status.validUntilMs) })
                : v.status.kind === "changed"
                  ? t("print.vendorChanged")
                  : t("badge.estimate")}
          </p>
          <table className="num w-full border-collapse text-small">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-1.5 font-semibold">{t("print.colItem")}</th>
                <th scope="col" className="py-1.5 font-semibold">{t("print.colWorking")}</th>
                <th scope="col" className="py-1.5 text-right font-semibold">{t("print.colAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {v.estimate.lines.map((l) => (
                <tr key={l.kind === "rental" ? "rental" : `${l.kind}:${l.id}`} className="border-b border-line">
                  <td className="py-1.5 pr-2">{l.label}</td>
                  <td className="py-1.5 pr-2">{working(t, l)}</td>
                  <td className="py-1.5 text-right">{formatSGD(l.amountCents)}</td>
                </tr>
              ))}
              <tr className="border-b border-line font-semibold">
                <td className="py-1.5" colSpan={2}>{t("print.subtotal")}</td>
                <td className="py-1.5 text-right">{formatSGD(v.estimate.subtotalCents)}</td>
              </tr>
              {v.estimate.minimumSpendShortfall && (
                <tr className="border-b border-line">
                  <td className="py-1.5" colSpan={2}>
                    {t("print.minimumShortfall", { amount: formatSGD(v.estimate.minimumSpendShortfall.minimumCents) })}
                  </td>
                  <td className="py-1.5 text-right">{formatSGD(v.estimate.minimumSpendShortfall.shortfallCents)}</td>
                </tr>
              )}
              {v.estimate.serviceCharge && (
                <tr className="border-b border-line">
                  <td className="py-1.5" colSpan={2}>{t("print.serviceCharge", { rate: formatBps(v.estimate.serviceCharge.rateBps) })}</td>
                  <td className="py-1.5 text-right">{formatSGD(v.estimate.serviceCharge.amountCents)}</td>
                </tr>
              )}
              {v.estimate.gst && (
                <tr className="border-b border-line">
                  <td className="py-1.5" colSpan={2}>{t("print.gst", { rate: formatBps(v.estimate.gst.rateBps) })}</td>
                  <td className="py-1.5 text-right">{formatSGD(v.estimate.gst.amountCents)}</td>
                </tr>
              )}
              <tr className="font-semibold">
                <td className="py-2" colSpan={2}>{v.status.kind === "confirmed" ? t("print.confirmedTotal") : t("print.estimatedTotal")}</td>
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
            {resolved.vendors.length > 1
              ? t(allConfirmed ? "print.confirmedTotalAcross" : "print.estimatedTotalAcross", { count: resolved.vendors.length })
              : allConfirmed
                ? t("print.confirmedTotal")
                : t("print.estimatedTotal")}
          </span>
          <span className="num text-h3">{formatSGD(resolved.combinedTotalCents)}</span>
        </p>
        {resolved.combinedPerGuestCents !== null && <p className="num text-small">{t("print.perGuest", { amount: formatSGD(resolved.combinedPerGuestCents) })}</p>}
        {plan.budgetCents ? <p className="num text-small">{t("assistant.change.budget", { amount: formatSGD(plan.budgetCents) })}</p> : null}
      </section>

      {plan.timeline && plan.timeline.length > 0 && (
        <section className="print-avoid-break flex flex-col gap-2">
          <h2 className="text-h3">
            {t("assistant.timeline.title")} ({t("assistant.timeline.draft")})
          </h2>
          <ol className="num flex flex-col text-small">
            {plan.timeline.map((e, i) => (
              <li key={i} className="flex gap-4 border-b border-line py-1.5">
                <span className="w-14 shrink-0 font-semibold">{e.time}</span>
                <span>{e.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="flex flex-col gap-1 text-small">
        <p>
          {resolved.confirmedCount > 0 ? t("print.footerConfirmed") : t("money.estimateNotQuote")} {t("print.eachVendor")}
        </p>
        <p>{t("print.generated")}</p>
      </footer>
    </main>
  );
}

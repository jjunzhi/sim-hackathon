"use client";

import { CircleAlert } from "lucide-react";
import { EstimateView } from "@/components/estimate/estimate-view";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { formatSGD } from "@/lib/money";
import type { PlanEstimates } from "@/lib/plans/estimates";

const money = (c: number) => formatSGD(c);

/** One estimate per vendor, then the total across vendors. Every price is an Estimate. */
export function PlanEstimatesView({ result }: { result: PlanEstimates }) {
  const multi = result.vendors.length > 1;
  return (
    <div className="flex flex-col gap-8">
      {result.unavailable.length > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-warning-icon bg-surface p-3 text-small text-warning">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-icon" />
          {result.unavailable.length === 1 ? "1 item you chose is" : `${result.unavailable.length} items you chose are`} no longer offered, so{" "}
          {result.unavailable.length === 1 ? "it isn't" : "they aren't"} in this estimate.
        </p>
      )}
      {result.errors.map((e) => (
        <p key={e.vendorName} role="alert" className="text-small text-error">
          {e.vendorName}: {e.message}
        </p>
      ))}
      {result.vendors.map((v) => (
        <EstimateView key={v.vendorUid} estimate={v.estimate} title={multi ? `${v.vendorName}${v.isVenue ? " (venue)" : ""}` : "Estimate"} />
      ))}
      {multi && (
        <section aria-label="Total across vendors" className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-col">
            <span className="text-small text-muted">Estimated total across {result.vendors.length} vendors</span>
            <span className="font-display text-h1 leading-none">
              <AnimatedNumber value={result.combinedTotalCents} format={money} />
            </span>
            {result.combinedPerGuestCents !== null && (
              <span className="num text-small text-muted">
                about <AnimatedNumber value={result.combinedPerGuestCents} format={money} /> per guest
              </span>
            )}
          </div>
          <Badge tone="estimate">Estimate</Badge>
          <p className="w-full text-small text-muted">Each vendor confirms only its own estimate.</p>
        </section>
      )}
    </div>
  );
}

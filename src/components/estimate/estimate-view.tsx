"use client";

import { motion, useReducedMotion } from "motion/react";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Estimate, PreTaxLine } from "@/lib/estimate/engine";
import { formatBps, formatSGD } from "@/lib/money";

const money = (c: number) => formatSGD(c);

function working(line: PreTaxLine): string | null {
  if (line.kind === "rental") return null;
  const unit = line.unit === "piece" ? (line.count === 1 ? "piece" : "pieces") : line.unit === "table" ? (line.count === 1 ? "table" : "tables") : line.count === 1 ? "guest" : "guests";
  return `${line.count} ${unit} × ${formatSGD(line.unitPriceCents)}`;
}

/** Amount cell that briefly highlights when its value changes (opacity only). */
function Amount({ cents, strong }: { cents: number; strong?: boolean }) {
  const reduce = useReducedMotion();
  // Only highlight real changes, not the first render.
  const [first] = useState(cents);
  return (
    <span className="relative inline-block rounded-md px-1.5 py-0.5">
      {!reduce && cents !== first && (
        <motion.span
          key={cents}
          aria-hidden
          className="absolute inset-0 rounded-md bg-accent-tint"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}
      <span className={cn("relative", strong && "font-semibold")}>
        <AnimatedNumber value={cents} format={money} />
      </span>
    </span>
  );
}

function Row({ label, detail, cents, strong, tone }: { label: React.ReactNode; detail?: string | null; cents: number; strong?: boolean; tone?: "warning" }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-3", tone === "warning" && "text-warning")}>
      <dt className="flex flex-col">
        <span className={cn(strong && "font-semibold")}>{label}</span>
        {detail && <span className="num text-small text-muted">{detail}</span>}
      </dt>
      <dd className="num shrink-0 text-right">
        <Amount cents={cents} strong={strong} />
      </dd>
    </div>
  );
}

/**
 * Itemised estimate. Every price carries the "Estimate" label until a vendor
 * confirms it (Phase 5). Never call this a final quote.
 */
export function EstimateView({ estimate, title = "Estimate", badge }: { estimate: Estimate; title?: string; badge?: React.ReactNode }) {
  const e = estimate;
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3">{title}</h2>
        {badge ?? <Badge tone="estimate">Estimate</Badge>}
      </div>
      <p className="num text-small text-muted">
        {e.headcount} {e.headcount === 1 ? "guest" : "guests"} · {e.tables} {e.tables === 1 ? "table" : "tables"} of {e.seatsPerTable}
      </p>

      <dl className="divide-y divide-line">
        {e.lines.length === 0 && (
          <div className="py-3 text-muted">
            <dt>Nothing selected yet.</dt>
          </div>
        )}
        {e.lines.map((l) => (
          <Row key={l.kind === "rental" ? "rental" : `${l.kind}:${l.id}`} label={l.label} detail={working(l)} cents={l.amountCents} />
        ))}
        <Row label="Subtotal" cents={e.subtotalCents} strong />
        {e.minimumSpendShortfall && (
          <Row
            tone="warning"
            label={
              <span className="inline-flex items-center gap-1.5">
                <CircleAlert aria-hidden className="size-4 text-warning-icon" />
                Minimum spend shortfall
              </span>
            }
            detail={`Minimum spend is ${formatSGD(e.minimumSpendShortfall.minimumCents)}; your selections come to ${formatSGD(e.minimumSpendShortfall.basisCents)}.`}
            cents={e.minimumSpendShortfall.shortfallCents}
          />
        )}
        {e.serviceCharge && <Row label={`Service charge (${formatBps(e.serviceCharge.rateBps)})`} cents={e.serviceCharge.amountCents} />}
        {e.gst && <Row label={`GST (${formatBps(e.gst.rateBps)})`} cents={e.gst.amountCents} />}
      </dl>

      {e.notes.length > 0 && (
        <ul className="flex flex-col gap-1 text-small text-muted">
          {e.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-subtle p-4">
        <div className="flex flex-col">
          <span className="text-small text-muted">{badge ? "Total" : "Estimated total"}</span>
          <span className="font-display text-h1 leading-none">
            <AnimatedNumber value={e.totalCents} format={money} />
          </span>
        </div>
        {e.perGuestCents !== null && (
          <span className="num text-small text-muted">
            about <AnimatedNumber value={e.perGuestCents} format={money} /> per guest
          </span>
        )}
      </div>
      {/* Screen readers get one summary update instead of every animated digit. */}
      <p className="sr-only" aria-live="polite">
        {badge ? "Total" : "Estimated total"} {formatSGD(e.totalCents)}
      </p>
    </section>
  );
}

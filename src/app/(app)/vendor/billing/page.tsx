"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CreditCard, ExternalLink, Ticket } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { monthlyStatements } from "@/lib/billing/commission";
import { PAST_DUE_GRACE_DAYS, type Standing } from "@/lib/billing/standing";
import { useBilling } from "@/lib/billing/use-billing";
import { openPortal, redeemInvite, startCheckout, watchVendorBookings, type BillingErrorCode, type BookingRow } from "@/lib/data/billing";
import { formatDate } from "@/lib/i18n/format";
import { formatBps, formatSGD } from "@/lib/money";
import { useVendor } from "@/lib/vendors/vendor-context";

// Configurable wording (not a legal claim): see .env.example.
const PRICE_CENTS = Number(process.env.NEXT_PUBLIC_PLAN_PRICE_CENTS ?? "9900") || 9900;
const PRICE_NOTE = process.env.NEXT_PUBLIC_PLAN_PRICE_NOTE ?? "No GST is charged on the plan.";
const sgDay = (ms: number) => formatDate("en-SG", ms, { day: "numeric", month: "long", year: "numeric" });
const monthLabel = (ym: string) => formatDate("en-SG", new Date(`${ym}-15T12:00:00+08:00`).getTime(), { month: "long", year: "numeric" });

const ERRORS: Record<BillingErrorCode, string> = {
  "billing-not-configured": "Online payment isn't switched on yet. Pilot vendors list for free with an invite code.",
  "already-subscribed": "You already have a plan. Use Manage billing to change it.",
  "no-customer": "There's no billing account yet. Choose the monthly plan first.",
  failed: "We couldn't open the payment page. Please try again.",
};

export default function BillingPage() {
  return (
    <Suspense>
      <Billing />
    </Suspense>
  );
}

function Billing() {
  const vendor = useVendor();
  const uid = vendor.status === "ready" ? vendor.uid : null;
  const { billing, standing } = useBilling(uid);
  const params = useSearchParams();
  const checkout = params.get("checkout");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    return watchVendorBookings(uid, setBookings);
  }, [uid]);

  if (!billing || !standing) {
    return (
      <main className="container-page py-10">
        <SkeletonList rows={2} label="Loading your plan" />
      </main>
    );
  }

  const subscribed = billing.stripeSubscriptionId !== null && ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(billing.status);
  async function go(action: () => Promise<BillingErrorCode>) {
    setBusy(true);
    setError(null);
    const code = await action();
    setError(ERRORS[code]);
    setBusy(false);
  }
  const statements = monthlyStatements(bookings ?? [], billing.commissionBps);

  return (
    <main className="container-page flex flex-col gap-8 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Plan and billing</h1>
        <p className="max-w-2xl text-muted">
          One plan for your whole business: {formatSGD(PRICE_CENTS)} a month. {PRICE_NOTE} Couples never pay through WeddingVista.
        </p>
      </div>

      {checkout === "done" && (
        <p role="status" className="w-fit rounded-xl border border-success bg-surface px-4 py-3 text-small font-medium text-success">
          Thank you. Your plan shows here as soon as the payment is confirmed, usually within a minute.
        </p>
      )}
      {checkout === "cancelled" && (
        <p role="status" className="w-fit rounded-xl border border-line bg-surface px-4 py-3 text-small">
          Checkout was cancelled. Nothing was charged.
        </p>
      )}

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-h3">Your plan</h2>
            <StandingBadge standing={standing} />
          </div>
          <StandingText standing={standing} periodEndMs={billing.currentPeriodEndMs} cancelAtPeriodEnd={billing.cancelAtPeriodEnd} />
          <div className="flex flex-wrap gap-3">
            {subscribed ? (
              <Button variant="primary" loading={busy} onClick={() => go(openPortal)} icon={<ExternalLink aria-hidden className="size-4" />}>
                Manage billing
              </Button>
            ) : (
              <Button variant="primary" loading={busy} onClick={() => go(startCheckout)} icon={<CreditCard aria-hidden className="size-4" />}>
                Choose the monthly plan
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-small text-error">
              {error}
            </p>
          )}
          <p className="text-small text-muted">
            Payment, card changes, invoices and cancelling are handled by Stripe. We never see your card number.
          </p>
        </CardBody>
      </Card>

      {standing.kind !== "active" && <InviteForm />}

      <section aria-labelledby="bookings-h" className="flex flex-col gap-3">
        <h2 id="bookings-h" className="text-h2">
          Bookings through WeddingVista
        </h2>
        <p className="max-w-2xl text-small text-muted">
          Leads you marked as booked and the couple confirmed. Commission: {billing.commissionBps === 0 ? "none during the pilot" : `${formatBps(billing.commissionBps)} of the booked value`}.
          {billing.commissionBps > 0 ? " This statement is for your records; nothing is charged automatically yet." : ""}
        </p>
        {!bookings && <SkeletonList rows={1} label="Loading bookings" />}
        {bookings && statements.length === 0 && <p className="text-muted">No confirmed bookings yet. Mark a confirmed lead as booked from its page.</p>}
        {statements.map((m) => (
          <Card key={m.month}>
            <CardBody className="flex flex-col gap-3">
              <h3 className="font-display text-h3">{monthLabel(m.month)}</h3>
              <ul className="flex flex-col divide-y divide-line">
                {m.lines.map((l) => (
                  <li key={l.leadId} className="num flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <Link href={`/vendor/leads/${l.leadId}`} className="font-semibold text-accent-text underline underline-offset-4">
                      {formatDate("en-SG", new Date(`${l.eventDate}T12:00:00+08:00`).getTime())}
                    </Link>
                    <span>
                      {l.valueCents === null ? "No value given" : formatSGD(l.valueCents)}
                      {l.commissionCents !== null && billing.commissionBps > 0 && <span className="text-muted"> · commission {formatSGD(l.commissionCents)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="num flex flex-wrap justify-between gap-2 font-semibold">
                <span>Booked value</span>
                <span>{formatSGD(m.bookedValueCents)}</span>
              </p>
              {billing.commissionBps > 0 && (
                <p className="num flex flex-wrap justify-between gap-2">
                  <span>Commission ({formatBps(billing.commissionBps)})</span>
                  <span>{formatSGD(m.commissionCents)}</span>
                </p>
              )}
              {m.withoutValue > 0 && <p className="text-small text-muted">{m.withoutValue} booking(s) without a value are listed but not counted.</p>}
            </CardBody>
          </Card>
        ))}
      </section>

      <section aria-labelledby="lapse-h" className="flex max-w-2xl flex-col gap-2">
        <h2 id="lapse-h" className="text-h3">
          If your plan ends
        </h2>
        <p className="text-small text-muted">
          After a failed payment you stay listed for {PAST_DUE_GRACE_DAYS} days while Stripe retries. If the plan then ends, couples can no longer find your venues or
          items in the catalog. Nothing is deleted: your listings, leads, confirmations and couples&apos; saved plans keep working, and choosing a plan again lists
          you again straight away.
        </p>
      </section>
    </main>
  );
}

function StandingBadge({ standing }: { standing: Standing }) {
  if (standing.kind === "active") return <Badge tone="confirmed">Active</Badge>;
  if (standing.kind === "pilot") return <Badge tone="confirmed">Pilot</Badge>;
  if (standing.kind === "grace") return <Badge tone="warning">Payment issue</Badge>;
  return <Badge tone="neutral">Not listed</Badge>;
}

function StandingText({ standing, periodEndMs, cancelAtPeriodEnd }: { standing: Standing; periodEndMs: number | null; cancelAtPeriodEnd: boolean }) {
  let text: string;
  if (standing.kind === "pilot") text = `You're in the pilot: listing is free until ${sgDay(standing.untilMs)}. Choose the monthly plan any time to stay listed after that.`;
  else if (standing.kind === "active")
    text = periodEndMs ? (cancelAtPeriodEnd ? `Your plan ends on ${sgDay(periodEndMs)} and won't renew.` : `Your plan renews on ${sgDay(periodEndMs)}.`) : "Your plan is active.";
  else if (standing.kind === "grace") text = `Your last payment didn't go through. You stay listed until ${sgDay(standing.untilMs)} while Stripe retries. Update your card in Manage billing.`;
  else if (standing.reason === "pilot-ended") text = "Your pilot has ended. Choose the monthly plan to be listed again.";
  else if (standing.reason === "payment-failed") text = "Payments didn't go through, so your listings are hidden. Update your card in Manage billing.";
  else if (standing.reason === "canceled") text = "Your plan was cancelled, so your listings are hidden. Choose the monthly plan to be listed again.";
  else text = "You don't have a plan yet. Couples can find your listings once you choose one, or use a pilot invite.";
  return <p className="max-w-2xl">{text}</p>;
}

function InviteForm() {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!code.trim()) return setError("Enter the code from your invite link.");
    setBusy(true);
    setError(null);
    const r = await redeemInvite(code);
    setBusy(false);
    if (r.ok) {
      toast({ title: "Pilot invite applied", description: `Your listing is free until ${sgDay(r.pilotUntilMs)}.`, tone: "success" });
      setCode("");
    } else {
      setError(
        r.reason === "invalid"
          ? "That code isn't valid. Check it, or ask for a new invite."
          : r.reason === "used"
            ? "That code has already been used by another account."
            : r.reason === "expired"
              ? "That invite has expired. Ask for a new one."
              : "We couldn't check the code. Please try again.",
      );
    }
  }
  return (
    <Card>
      <CardBody>
        <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-3">
          <Input label="Pilot invite code" value={code} onChange={(e) => setCode(e.target.value)} error={error ?? undefined} className="min-w-0 flex-1 md:max-w-md" autoComplete="off" />
          <Button type="submit" loading={busy} icon={<Ticket aria-hidden className="size-4" />}>
            Use code
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

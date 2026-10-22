"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { EstimateView } from "@/components/estimate/estimate-view";
import { StorageImage } from "@/components/photos/storage-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SkeletonList } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { BookingCard } from "@/components/vendor/booking-card";
import { LeadStatusBadge } from "@/components/vendor/lead-status";
import { getVendorCatalog } from "@/lib/data/catalog";
import { confirmLead, declineLead, getConfirmation, getLead, type ConfirmationRow, type LeadRow } from "@/lib/data/leads";
import { TIER_LABELS } from "@/lib/estimate/build";
import { sgDateInput, VALIDITY, validUntilFrom } from "@/lib/leads/model";
import { useLeadEstimate } from "@/lib/leads/use-lead-estimate";
import type { VendorCatalog } from "@/lib/plans/estimates";
import { themeLabel } from "@/lib/render/themes";
import { useVendor } from "@/lib/vendors/vendor-context";

const sgLong = (ms: number) => new Date(ms).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Singapore" });

export default function LeadPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const vendor = useVendor();
  const uid = vendor.status === "ready" ? vendor.uid : null;
  const toast = useToast();
  const [lead, setLead] = useState<LeadRow | null | undefined>(undefined);
  const [conf, setConf] = useState<ConfirmationRow | null>(null);
  const [catalog, setCatalog] = useState<VendorCatalog | null>(null);
  const [validDate, setValidDate] = useState(() => sgDateInput(validUntilFrom(new Date(), VALIDITY.defaultDays)));
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { estimate, problem } = useLeadEstimate(lead ?? null, catalog);

  async function load() {
    const l = await getLead(leadId);
    setLead(l);
    if (l?.confirmationId) setConf(await getConfirmation(l.confirmationId));
  }

  useEffect(() => {
    if (!uid) return;
    getVendorCatalog(uid).then(setCatalog);
    let cancelled = false;
    getLead(leadId).then(async (l) => {
      if (cancelled) return;
      setLead(l);
      if (l?.confirmationId) {
        const c = await getConfirmation(l.confirmationId);
        if (!cancelled) setConf(c);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [uid, leadId]);

  if (lead === undefined || vendor.status !== "ready") {
    return (
      <main className="container-page py-10">
        <SkeletonList rows={2} label="Loading request" />
      </main>
    );
  }
  if (lead === null) {
    return (
      <main className="container-page py-10">
        <p role="alert">This request isn&apos;t available. The couple may have withdrawn it.</p>
      </main>
    );
  }

  const today = new Date();
  const minDate = sgDateInput(validUntilFrom(today, VALIDITY.minDays));
  const maxDate = sgDateInput(validUntilFrom(today, VALIDITY.maxDays));
  const validUntil = new Date(`${validDate}T23:59:59.999+08:00`);
  const dateOk = validDate >= minDate && validDate <= maxDate;

  async function confirm() {
    if (!estimate || !lead || vendor.status !== "ready") return;
    setBusy(true);
    try {
      await confirmLead(lead, { estimate, validUntil, note: note.trim().slice(0, 500), vendorName: vendor.profile.businessName });
      setConfirming(false);
      toast({ title: "Estimate confirmed", description: `The couple now sees it as Vendor Confirmed until ${sgLong(validUntil.getTime())}.`, tone: "success" });
      await load();
    } catch {
      toast({ title: "We couldn't confirm that. Please try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container-page flex flex-col gap-6 py-10">
      <Link href="/vendor/leads" className="inline-flex min-h-11 w-fit items-center gap-2 text-small font-semibold text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        All leads
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h1">{lead.contact?.name ?? "Account deleted"}</h1>
        <LeadStatusBadge status={lead.status} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardBody>
              {lead.status === "confirmed" && conf ? (
                <div className="flex flex-col gap-3">
                  <EstimateView
                    estimate={conf.snapshot}
                    title="What you confirmed"
                    badge={<Badge tone="confirmed">Vendor Confirmed · Valid until {sgLong(conf.validUntil.toMillis())}</Badge>}
                  />
                  <p className="text-small text-muted">
                    Confirmed {sgLong(conf.confirmedAt.toMillis())}. This snapshot never changes, even if you edit your prices.
                  </p>
                </div>
              ) : estimate ? (
                <EstimateView estimate={estimate} title="At today's prices" />
              ) : (
                <SkeletonList rows={1} label="Working out the estimate" />
              )}
              {problem && lead.status === "new" && <p className="mt-3 text-small text-warning">{problem}</p>}
            </CardBody>
          </Card>
          {lead.renders.length > 0 && (
            <section aria-labelledby="renders-h" className="flex flex-col gap-3">
              <h2 id="renders-h" className="text-h3">
                Their saved renders
              </h2>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {lead.renders.map((r) => (
                  <li key={r.key} className="flex flex-col gap-1">
                    <StorageImage
                      photo={{ path: r.path, width: Number(r.aspect.split("/")[0]) || 4, height: Number(r.aspect.split("/")[1]) || 3, contentType: "image/jpeg" }}
                      alt={`AI illustration, ${themeLabel(r.themeId)} theme`}
                      aspect={r.aspect}
                      sizes="(min-width: 48rem) 220px, 45vw"
                    />
                    <span className="text-small text-muted">{themeLabel(r.themeId)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card>
            <CardBody className="flex flex-col gap-2">
              <h2 className="text-h3">Request</h2>
              <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-small">
                <dt className="text-muted">Venue</dt>
                <dd>{lead.venueName}</dd>
                <dt className="text-muted">Room</dt>
                <dd>
                  {lead.spaceName || "Decor only"}
                  {lead.tierKey && TIER_LABELS[lead.tierKey] ? ` · ${TIER_LABELS[lead.tierKey]}` : ""}
                </dd>
                <dt className="text-muted">Guests</dt>
                <dd className="num">{lead.headcount}</dd>
                {lead.contact ? (
                  <>
                    <dt className="text-muted">Contact</dt>
                    <dd className="break-all">{lead.contact.reachAt}</dd>
                    {lead.contact.eventDate && (
                      <>
                        <dt className="text-muted">Date</dt>
                        <dd>{lead.contact.eventDate}</dd>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <dt className="text-muted">Contact</dt>
                    <dd>Removed: the couple deleted their account</dd>
                  </>
                )}
              </dl>
              {lead.contact?.message && <p className="rounded-lg bg-subtle p-3 text-small">&quot;{lead.contact.message}&quot;</p>}
            </CardBody>
          </Card>

          <BookingCard lead={lead} />

          {lead.status === "new" && (
            <Card>
              <CardBody className="flex flex-col gap-3">
                <h2 className="text-h3">Confirm this estimate</h2>
                <p className="text-small text-muted">The couple sees exactly these lines and totals, frozen, until the date you choose.</p>
                <Button variant="primary" disabled={!estimate || !!problem} onClick={() => setConfirming(true)} icon={<BadgeCheck aria-hidden className="size-4" />}>
                  Confirm estimate
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => declineLead(lead.id).then(load).catch(() => toast({ title: "We couldn't decline that", tone: "error" }))}
                >
                  Decline request
                </Button>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>

      <Modal
        open={confirming}
        onOpenChange={(o) => !busy && setConfirming(o)}
        title="Confirm this estimate?"
        description="After you confirm, these prices are fixed for this couple until the date below. You can't edit a confirmation."
        footer={
          <>
            <Button onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} disabled={!dateOk} onClick={confirm}>
              Confirm estimate
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Valid until"
            type="date"
            min={minDate}
            max={maxDate}
            value={validDate}
            onChange={(e) => setValidDate(e.target.value)}
            hint={`Default ${VALIDITY.defaultDays} days. Between ${VALIDITY.minDays} and ${VALIDITY.maxDays} days from today.`}
            error={dateOk ? undefined : `Choose a date between ${sgLong(new Date(`${minDate}T12:00:00+08:00`).getTime())} and ${sgLong(new Date(`${maxDate}T12:00:00+08:00`).getTime())}.`}
          />
          <Textarea label="Note to the couple (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="[&_textarea]:min-h-24" />
        </div>
      </Modal>
    </main>
  );
}

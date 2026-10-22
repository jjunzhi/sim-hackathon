"use client";

import { CircleAlert, Clock, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { EstimateView, PerGuest } from "@/components/estimate/estimate-view";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { requestConfirmation, type ConfirmationRow, type LeadRow } from "@/lib/data/leads";
import { formatDate } from "@/lib/i18n/format";
import { useLocale, useT } from "@/lib/i18n/provider";
import { LEAD_LIMITS, selectionsForVendor } from "@/lib/leads/model";
import { resolvePlan, type ResolvedVendor } from "@/lib/leads/resolve";
import { formatSGD } from "@/lib/money";
import type { PlanEstimates } from "@/lib/plans/estimates";
import type { PlanDraft } from "@/lib/plans/model";
import type { CatalogVenue } from "@/lib/venues/catalog";
import type { Space } from "@/lib/venues/model";

const money = (c: number) => formatSGD(c);
/** English (en-SG) date for non-React callers; components use useLocale().date instead. */
export const sgDate = (ms: number) => formatDate("en-SG", ms);

/** "Vendor Confirmed · Valid until {date}" or "Expired"; nothing for a live estimate. */
export function ConfirmedBadge({ v }: { v: ResolvedVendor }) {
  const { t, date } = useLocale();
  if (v.status.kind === "confirmed") return <Badge tone="confirmed">{t("badge.vendorConfirmedUntil", { date: date(v.status.validUntilMs) })}</Badge>;
  if (v.status.kind === "expired") return <Badge tone="expired">{t("badge.expired")}</Badge>;
  return null;
}

/** Badge element for EstimateView's `badge` prop; undefined keeps its default "Estimate" badge. */
export function confirmedBadge(v: ResolvedVendor) {
  if (v.status.kind === "confirmed" || v.status.kind === "expired") return <ConfirmedBadge v={v} />;
  return undefined;
}

/**
 * Per-vendor estimates with their confirmation status. A confirmed snapshot is
 * shown exactly as the vendor confirmed it; anything else is a live Estimate.
 */
export function ResolvedEstimates({
  live,
  plan,
  planId,
  coupleUid,
  venue,
  space,
  leads,
  confirmations: confs,
}: {
  live: PlanEstimates;
  leads: LeadRow[];
  confirmations: ConfirmationRow[];
  plan: PlanDraft;
  planId: string | null;
  coupleUid: string | null;
  venue: CatalogVenue;
  space: (Space & { id: string }) | null;
}) {
  const t = useT();
  const [asking, setAsking] = useState<ResolvedVendor | null>(null);

  const resolved = useMemo(
    () => resolvePlan({ plan, planId: planId ?? "", live, leads: planId ? leads : [], confirmations: confs, now: new Date() }),
    [plan, planId, live, leads, confs],
  );
  const multi = resolved.vendors.length > 1;

  return (
    <div className="flex flex-col gap-8">
      {live.unavailable.length > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-warning-icon bg-surface p-3 text-small text-warning">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-icon" />
          {t("estimate.unavailable", { count: live.unavailable.length })}
        </p>
      )}
      {live.errors.map((e) => (
        <p key={e.vendorName} role="alert" className="text-small text-error">
          {t("estimate.vendorError", { vendor: e.vendorName, message: e.message })}
        </p>
      ))}

      {resolved.vendors.map((v) => (
        <div key={v.vendorUid} className="flex flex-col gap-3">
          <EstimateView estimate={v.estimate} title={multi && v.isVenue ? t("estimate.vendorVenue", { vendor: v.vendorName }) : v.vendorName} badge={confirmedBadge(v)} />
          <StatusLine v={v} canRequest={!!planId && !!coupleUid} onRequest={() => setAsking(v)} />
        </div>
      ))}

      {multi && (
        <section aria-label={t("estimate.totalAcrossVendors")} className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-col">
            <span className="text-small text-muted">{t("estimate.totalAcrossVendorsCount", { count: resolved.vendors.length })}</span>
            <span className="font-display text-h1 leading-none">
              <AnimatedNumber value={resolved.combinedTotalCents} format={money} />
            </span>
            {resolved.combinedPerGuestCents !== null && <PerGuest cents={resolved.combinedPerGuestCents} />}
          </div>
          {resolved.confirmedCount === resolved.vendors.length ? (
            <Badge tone="confirmed">{t("estimate.allVendorsConfirmed")}</Badge>
          ) : (
            <Badge tone="estimate">{t("badge.estimate")}</Badge>
          )}
          <p className="w-full text-small text-muted">
            {resolved.confirmedCount > 0 ? t("estimate.confirmedOfTotal", { n: resolved.confirmedCount, total: resolved.vendors.length }) : t("estimate.eachVendorConfirms")}
          </p>
        </section>
      )}

      {asking && planId && coupleUid && (
        <RequestModal
          vendor={asking}
          onClose={() => setAsking(null)}
          build={() => ({
            coupleUid,
            vendorUid: asking.vendorUid,
            venueOwnerUid: venue.ownerUid,
            planId,
            venueId: venue.id,
            venueName: venue.name,
            vendorName: asking.vendorName,
            spaceId: plan.spaceId,
            spaceName: space?.name ?? "",
            tierKey: plan.tierKey,
            headcount: plan.headcount,
            selections: selectionsForVendor(plan.selections, asking.vendorUid),
            renders: plan.savedRenders.map((r) => ({ key: r.key, path: r.path, themeId: r.themeId, aspect: space?.photo ? `${space.photo.width} / ${space.photo.height}` : "4 / 3" })),
          })}
        />
      )}
    </div>
  );
}

function StatusLine({ v, canRequest, onRequest }: { v: ResolvedVendor; canRequest: boolean; onRequest: () => void }) {
  const { t, date } = useLocale();
  const s = v.status;
  const requestButton = (label: string) =>
    canRequest ? (
      <Button onClick={onRequest} icon={<Send aria-hidden className="size-4" />}>
        {label}
      </Button>
    ) : (
      <p className="text-small text-muted">{t("estimate.saveToAsk", { vendor: v.vendorName })}</p>
    );
  if (s.kind === "confirmed") return <p className="text-small text-success">{t("estimate.confirmedBy", { vendor: v.vendorName })}</p>;
  if (s.kind === "expired")
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-small text-error">{t("estimate.expiredOn", { date: date(s.validUntilMs) })}</p>
        {requestButton(t("estimate.requestNew"))}
      </div>
    );
  if (s.kind === "changed")
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-small text-warning">{t("estimate.changedAfter", { vendor: v.vendorName })}</p>
        {requestButton(t("estimate.requestNew"))}
      </div>
    );
  if (s.pendingLeadId)
    return (
      <p className="flex items-center gap-2 text-small text-muted">
        <Clock aria-hidden className="size-4" /> {t("estimate.waitingFor", { vendor: v.vendorName })}
      </p>
    );
  return requestButton(t("estimate.requestConfirmed"));
}

type LeadDraft = Omit<Parameters<typeof requestConfirmation>[0], "contact">;

function RequestModal({ vendor, onClose, build }: { vendor: ResolvedVendor; onClose: () => void; build: () => LeadDraft }) {
  const t = useT();
  const toast = useToast();
  const [name, setName] = useState("");
  const [reachAt, setReachAt] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function send() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t("estimate.errName");
    if (!reachAt.trim()) e.reachAt = t("estimate.errReachAt");
    if (!consent) e.consent = t("estimate.errConsent");
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await requestConfirmation({ ...build(), contact: { name: name.trim(), reachAt: reachAt.trim(), eventDate: eventDate.slice(0, 20), message: message.trim() } });
      toast({ title: t("estimate.requestSent", { vendor: vendor.vendorName }), tone: "success" });
      onClose();
    } catch {
      setErrors({ form: t("estimate.errSend") });
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={t("estimate.askToConfirm", { vendor: vendor.vendorName })}
      description={t("estimate.askDescription")}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={busy} onClick={send}>
            {t("estimate.sendRequest")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label={t("estimate.nameForVendor")} maxLength={LEAD_LIMITS.nameMax} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" />
        <Input label={t("estimate.emailOrPhone")} maxLength={LEAD_LIMITS.reachAtMax} value={reachAt} onChange={(e) => setReachAt(e.target.value)} error={errors.reachAt} />
        <Input label={t("estimate.weddingDate")} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        <Textarea label={t("estimate.message")} maxLength={LEAD_LIMITS.messageMax} value={message} onChange={(e) => setMessage(e.target.value)} className="[&_textarea]:min-h-24" />
        <Checkbox label={t("estimate.consent", { vendor: vendor.vendorName })} checked={consent} onCheckedChange={setConsent} />
        {errors.consent && <p className="text-small text-error">{errors.consent}</p>}
        {errors.form && (
          <p role="alert" className="text-small text-error">
            {errors.form}
          </p>
        )}
      </div>
    </Modal>
  );
}

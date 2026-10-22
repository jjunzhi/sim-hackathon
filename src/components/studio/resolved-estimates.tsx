"use client";

import { CircleAlert, Clock, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { EstimateView } from "@/components/estimate/estimate-view";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { requestConfirmation, type ConfirmationRow, type LeadRow } from "@/lib/data/leads";
import { LEAD_LIMITS, selectionsForVendor } from "@/lib/leads/model";
import { resolvePlan, type ResolvedVendor } from "@/lib/leads/resolve";
import { formatSGD } from "@/lib/money";
import type { PlanEstimates } from "@/lib/plans/estimates";
import type { PlanDraft } from "@/lib/plans/model";
import type { CatalogVenue } from "@/lib/venues/catalog";
import type { Space } from "@/lib/venues/model";

const money = (c: number) => formatSGD(c);
export const sgDate = (ms: number) => new Date(ms).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" });

export function confirmedBadge(v: ResolvedVendor) {
  if (v.status.kind === "confirmed") return <Badge tone="confirmed">Vendor Confirmed · Valid until {sgDate(v.status.validUntilMs)}</Badge>;
  if (v.status.kind === "expired") return <Badge tone="expired">Expired</Badge>;
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
          {live.unavailable.length === 1 ? "1 item you chose is" : `${live.unavailable.length} items you chose are`} no longer offered, so not in this estimate.
        </p>
      )}
      {live.errors.map((e) => (
        <p key={e.vendorName} role="alert" className="text-small text-error">
          {e.vendorName}: {e.message}
        </p>
      ))}

      {resolved.vendors.map((v) => (
        <div key={v.vendorUid} className="flex flex-col gap-3">
          <EstimateView estimate={v.estimate} title={multi ? `${v.vendorName}${v.isVenue ? " (venue)" : ""}` : v.vendorName} badge={confirmedBadge(v)} />
          <StatusLine v={v} canRequest={!!planId && !!coupleUid} onRequest={() => setAsking(v)} />
        </div>
      ))}

      {multi && (
        <section aria-label="Total across vendors" className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-col">
            <span className="text-small text-muted">Total across {resolved.vendors.length} vendors</span>
            <span className="font-display text-h1 leading-none">
              <AnimatedNumber value={resolved.combinedTotalCents} format={money} />
            </span>
            {resolved.combinedPerGuestCents !== null && (
              <span className="num text-small text-muted">
                about <AnimatedNumber value={resolved.combinedPerGuestCents} format={money} /> per guest
              </span>
            )}
          </div>
          {resolved.confirmedCount === resolved.vendors.length ? (
            <Badge tone="confirmed">All vendors confirmed</Badge>
          ) : (
            <Badge tone="estimate">Estimate</Badge>
          )}
          <p className="w-full text-small text-muted">
            {resolved.confirmedCount > 0 ? `${resolved.confirmedCount} of ${resolved.vendors.length} vendors confirmed. ` : ""}Each vendor confirms only its own estimate.
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
  const s = v.status;
  const requestButton = (label: string) =>
    canRequest ? (
      <Button onClick={onRequest} icon={<Send aria-hidden className="size-4" />}>
        {label}
      </Button>
    ) : (
      <p className="text-small text-muted">Save your plan to ask {v.vendorName} to confirm this estimate.</p>
    );
  if (s.kind === "confirmed") return <p className="text-small text-success">Confirmed by {v.vendorName}. Later price changes don&apos;t affect this.</p>;
  if (s.kind === "expired")
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-small text-error">The confirmation expired on {sgDate(s.validUntilMs)}. Prices above are today&apos;s Estimate.</p>
        {requestButton("Request a new confirmation")}
      </div>
    );
  if (s.kind === "changed")
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-small text-warning">You changed this part of your plan after {v.vendorName} confirmed it. The confirmation covers the earlier version.</p>
        {requestButton("Request a new confirmation")}
      </div>
    );
  if (s.pendingLeadId)
    return (
      <p className="flex items-center gap-2 text-small text-muted">
        <Clock aria-hidden className="size-4" /> Waiting for {v.vendorName} to confirm.
      </p>
    );
  return requestButton("Request a confirmed estimate");
}

type LeadDraft = Omit<Parameters<typeof requestConfirmation>[0], "contact">;

function RequestModal({ vendor, onClose, build }: { vendor: ResolvedVendor; onClose: () => void; build: () => LeadDraft }) {
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
    if (!name.trim()) e.name = "Add a name the vendor can use.";
    if (!reachAt.trim()) e.reachAt = "Add an email or phone number.";
    if (!consent) e.consent = "Please agree to share these details.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await requestConfirmation({ ...build(), contact: { name: name.trim(), reachAt: reachAt.trim(), eventDate: eventDate.slice(0, 20), message: message.trim() } });
      toast({ title: `Request sent to ${vendor.vendorName}`, tone: "success" });
      onClose();
    } catch {
      setErrors({ form: "We couldn't send the request. Please try again." });
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={`Ask ${vendor.vendorName} to confirm`}
      description="They'll see your guests, room, chosen items, saved renders and the details below."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={send}>
            Send request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Name for the vendor" maxLength={LEAD_LIMITS.nameMax} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" />
        <Input label="Email or phone" maxLength={LEAD_LIMITS.reachAtMax} value={reachAt} onChange={(e) => setReachAt(e.target.value)} error={errors.reachAt} />
        <Input label="Wedding date (optional)" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        <Textarea label="Message (optional)" maxLength={LEAD_LIMITS.messageMax} value={message} onChange={(e) => setMessage(e.target.value)} className="[&_textarea]:min-h-24" />
        <Checkbox label={`Share these details and this part of my plan with ${vendor.vendorName}`} checked={consent} onCheckedChange={setConsent} />
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

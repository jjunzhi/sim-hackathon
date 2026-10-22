"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { LeadStatusBadge } from "@/components/vendor/lead-status";
import { EmptyState, SkeletonList } from "@/components/ui/skeleton";
import { getVendorCatalog } from "@/lib/data/catalog";
import { watchConfirmationsBy, watchVendorLeads, type ConfirmationRow, type LeadRow } from "@/lib/data/leads";
import { TIER_LABELS } from "@/lib/estimate/build";
import { useLeadEstimate } from "@/lib/leads/use-lead-estimate";
import { formatSGD } from "@/lib/money";
import type { VendorCatalog } from "@/lib/plans/estimates";
import { useVendor } from "@/lib/vendors/vendor-context";

export default function LeadsPage() {
  const vendor = useVendor();
  const uid = vendor.status === "ready" ? vendor.uid : null;
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [catalog, setCatalog] = useState<VendorCatalog | null>(null);
  const [confs, setConfs] = useState<ConfirmationRow[]>([]);

  useEffect(() => {
    if (!uid) return;
    getVendorCatalog(uid).then(setCatalog);
    const subs = [watchVendorLeads(uid, setLeads), watchConfirmationsBy("vendorUid", uid, setConfs)];
    return () => subs.forEach((u) => u());
  }, [uid]);
  const confirmationOf = (l: LeadRow) => (l.status === "confirmed" ? confs.find((c) => c.id === l.confirmationId) : undefined);

  return (
    <main className="container-page flex flex-col gap-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Leads</h1>
        <p className="max-w-2xl text-muted">Couples who asked you to confirm an estimate. Totals use your current prices until you confirm.</p>
      </div>
      {!leads && <SkeletonList rows={3} label="Loading leads" />}
      {leads?.length === 0 && (
        <EmptyState icon={<Inbox aria-hidden className="size-8" />} title="No requests yet">
          When a couple asks you to confirm their estimate, it appears here with their guests, choices and renders.
        </EmptyState>
      )}
      {leads && leads.length > 0 && (
        <>
          {/* Table from tablet up; cards on phones (no sideways scrolling). */}
          <table className="hidden w-full border-collapse text-left md:table">
            <caption className="sr-only">Estimate requests</caption>
            <thead>
              <tr className="border-b border-line text-small text-muted">
                <th scope="col" className="py-2 font-semibold">Received</th>
                <th scope="col" className="py-2 font-semibold">Couple</th>
                <th scope="col" className="py-2 font-semibold">Guests</th>
                <th scope="col" className="py-2 font-semibold">Room</th>
                <th scope="col" className="py-2 font-semibold">Items</th>
                <th scope="col" className="py-2 text-right font-semibold">Total</th>
                <th scope="col" className="py-2 pl-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <LeadTableRow key={l.id} lead={l} catalog={catalog} confirmation={confirmationOf(l)} />
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 md:hidden">
            {leads.map((l) => (
              <LeadCard key={l.id} lead={l} catalog={catalog} confirmation={confirmationOf(l)} />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

const received = (ms: number) => new Date(ms).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
type RowProps = { lead: LeadRow; catalog: VendorCatalog | null; confirmation: ConfirmationRow | undefined };

/** A confirmed lead shows what was confirmed; anything else is priced from today's catalog. */
function useRowTotal({ lead, catalog, confirmation }: RowProps) {
  const { estimate } = useLeadEstimate(lead, catalog);
  if (confirmation) return formatSGD(confirmation.snapshot.totalCents);
  return estimate ? formatSGD(estimate.totalCents) : "...";
}

const room = (l: LeadRow) => `${l.spaceName || "Decor only"}${l.tierKey && TIER_LABELS[l.tierKey] ? ` · ${TIER_LABELS[l.tierKey]}` : ""}`;

function LeadTableRow(props: RowProps) {
  const { lead } = props;
  const total = useRowTotal(props);
  return (
    <tr className="border-b border-line">
      <td className="num py-3">{received(lead.createdAtMs)}</td>
      <td className="py-3">
        <Link href={`/vendor/leads/${lead.id}`} className="font-semibold text-accent-text underline underline-offset-4">
          {lead.contact?.name ?? "Account deleted"}
        </Link>
      </td>
      <td className="num py-3">{lead.headcount}</td>
      <td className="py-3">{room(lead)}</td>
      <td className="num py-3">{Object.keys(lead.selections).length}</td>
      <td className="num py-3 text-right">{total}</td>
      <td className="py-3 pl-4"><LeadStatusBadge status={lead.status} /></td>
    </tr>
  );
}

function LeadCard(props: RowProps) {
  const { lead } = props;
  const total = useRowTotal(props);
  return (
    <li>
      <Link href={`/vendor/leads/${lead.id}`} className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold">{lead.contact?.name ?? "Account deleted"}</span>
          <LeadStatusBadge status={lead.status} />
        </span>
        <span className="num text-small text-muted">
          {received(lead.createdAtMs)} · {lead.headcount} guests · {room(lead)}
        </span>
        <span className="num font-semibold">{total}</span>
      </Link>
    </li>
  );
}

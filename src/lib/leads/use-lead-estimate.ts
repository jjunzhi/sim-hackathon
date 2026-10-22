"use client";

import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { Estimate } from "@/lib/estimate/engine";
import { getFirebase } from "@/lib/firebase/client";
import { buildPlanEstimates, type VendorCatalog } from "@/lib/plans/estimates";
import type { Space } from "@/lib/venues/model";
import type { Lead } from "./model";

/** The vendor's own part of a lead, priced from its current catalog (live, not confirmed). */
export function useLeadEstimate(lead: (Lead & { id: string }) | null, catalog: VendorCatalog | null): { estimate: Estimate | null; space: Space | null; problem: string | null } {
  const [space, setSpace] = useState<{ key: string; space: Space | null } | null>(null);
  const key = lead && lead.spaceId ? `${lead.venueId}/${lead.spaceId}` : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    getDoc(doc(getFirebase().db, `venues/${key.split("/")[0]}/spaces/${key.split("/")[1]}`))
      .then((s) => !cancelled && setSpace({ key, space: s.exists() ? (s.data() as Space) : null }))
      .catch(() => !cancelled && setSpace({ key, space: null }));
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!lead || !catalog) return { estimate: null, space: null, problem: null };
  const isVenue = lead.vendorUid === lead.venueOwnerUid;
  const s = key && space?.key === key ? space.space : null;
  if (isVenue && key && space?.key !== key) return { estimate: null, space: null, problem: null };
  const r = buildPlanEstimates({
    plan: { headcount: lead.headcount, tierKey: lead.tierKey, selections: lead.selections },
    venueOwnerUid: lead.venueOwnerUid,
    space: s,
    catalogs: [catalog],
  });
  const mine = r.vendors.find((v) => v.vendorUid === lead.vendorUid) ?? null;
  return {
    estimate: mine?.estimate ?? null,
    space: s,
    problem: r.errors[0]?.message ?? (r.unavailable.length ? `${r.unavailable.length} requested item(s) are no longer active in your inventory.` : null),
  };
}

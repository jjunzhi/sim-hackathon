"use client";

import { useEffect, useState } from "react";
import { getPublishedVenue, loadVenueCatalogs } from "@/lib/data/catalog";
import { watchSpaces, type WithId } from "@/lib/data/venues";
import type { CatalogVenue } from "@/lib/venues/catalog";
import type { Space } from "@/lib/venues/model";
import { buildPlanEstimates, type PlanEstimates, type VendorCatalog } from "./estimates";
import type { Plan } from "./model";

export interface PlanContext {
  venue: CatalogVenue | null;
  space: WithId<Space> | null;
  estimates: PlanEstimates | null;
  loading: boolean;
}

/** Venue, room and live estimate for a saved plan (prices are always current). */
export function usePlanEstimate(plan: Pick<Plan, "venueId" | "spaceId" | "headcount" | "tierKey" | "selections"> | null): PlanContext {
  const venueId = plan?.venueId ?? null;
  const [data, setData] = useState<{ venueId: string; venue: CatalogVenue | null; spaces: WithId<Space>[]; catalogs: VendorCatalog[] } | null>(null);

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    let spaces: WithId<Space>[] = [];
    let base: { venue: CatalogVenue | null; catalogs: VendorCatalog[] } | null = null;
    const emit = () => base && !cancelled && setData({ venueId, ...base, spaces });
    const unsub = watchSpaces(
      venueId,
      (s) => {
        spaces = s;
        emit();
      },
      () => emit(),
    );
    getPublishedVenue(venueId).then(async (venue) => {
      const catalogs = venue ? await loadVenueCatalogs(venue) : [];
      base = { venue, catalogs };
      emit();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [venueId]);

  if (!plan || !data || data.venueId !== venueId) return { venue: null, space: null, estimates: null, loading: true };
  const space = data.spaces.find((s) => s.id === plan.spaceId) ?? null;
  const estimates = data.venue ? buildPlanEstimates({ plan, venueOwnerUid: data.venue.ownerUid, space, catalogs: data.catalogs }) : null;
  return { venue: data.venue, space, estimates, loading: false };
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Accessibility, ArrowLeft, ArrowUpDown, BadgeCheck, Flower2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { StorageImage } from "@/components/photos/storage-image";
import { Card, CardBody } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { getPublishedVenue, loadVenueCatalogs } from "@/lib/data/catalog";
import { watchSpaces, type WithId } from "@/lib/data/venues";
import { tierKeys, tierOf, TIER_LABELS } from "@/lib/estimate/build";
import { formatSGD } from "@/lib/money";
import type { VendorCatalog } from "@/lib/plans/estimates";
import type { CatalogVenue } from "@/lib/venues/catalog";
import type { Space } from "@/lib/venues/model";

export default function VenuePage() {
  const { venueId } = useParams<{ venueId: string }>();
  const [venue, setVenue] = useState<CatalogVenue | null | undefined>(undefined);
  const [spaces, setSpaces] = useState<WithId<Space>[] | null>(null);
  const [catalogs, setCatalogs] = useState<VendorCatalog[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublishedVenue(venueId).then((v) => {
      if (cancelled) return;
      setVenue(v);
      if (v) loadVenueCatalogs(v).then((c) => !cancelled && setCatalogs(c));
    });
    const unsub = watchSpaces(venueId, setSpaces, () => setSpaces([]));
    return () => {
      cancelled = true;
      unsub();
    };
  }, [venueId]);

  return (
    <>
      <AppHeader />
      <main className="container-page flex flex-col gap-8 py-8 pb-28 sm:pb-12">
        <Link href="/venues" className="inline-flex min-h-11 w-fit items-center gap-2 text-small font-semibold text-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" />
          All venues
        </Link>
        {venue === undefined && <SkeletonList rows={2} label="Loading venue" />}
        {venue === null && (
          <p role="alert" className="text-muted">
            This venue isn&apos;t available. It may have been unpublished.
          </p>
        )}
        {venue && (
          <>
            <div className="grid items-start gap-8 lg:grid-cols-[1.3fr_1fr]">
              {venue.coverPhoto && <StorageImage photo={venue.coverPhoto} alt={`${venue.name}, cover photo`} aspect="3 / 2" sizes="(min-width: 64rem) 680px, 100vw" />}
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-h1">{venue.name}</h1>
                  {venue.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success px-2 py-0.5 text-small font-semibold text-success">
                      <BadgeCheck aria-hidden className="size-3.5" />
                      Verified
                    </span>
                  )}
                </div>
                {venue.address && <p className="text-muted">{venue.address}</p>}
                {venue.description && <p>{venue.description}</p>}
                <ul className="flex flex-wrap gap-1.5" aria-label="Style and culture">
                  {[...venue.styleTags, ...venue.cultureTags].map((t) => (
                    <li key={t} className="rounded-full bg-subtle px-2.5 py-0.5 text-small">
                      {t}
                    </li>
                  ))}
                </ul>
                <ul className="flex flex-col gap-1 text-small" aria-label="Access">
                  <li className="flex items-center gap-2">
                    <Accessibility aria-hidden className="size-4 text-muted" />
                    {venue.wheelchairAccess ? "Wheelchair access" : "No wheelchair access listed"}
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowUpDown aria-hidden className="size-4 text-muted" />
                    {venue.liftAccess ? "Lift access" : "No lift listed"}
                  </li>
                </ul>
                <Link
                  href={`/studio/${venue.id}`}
                  className="mt-2 inline-flex min-h-13 w-fit items-center rounded-full bg-accent px-7 font-semibold text-on-accent shadow-soft transition-colors hover:bg-accent-hover"
                >
                  Plan here
                </Link>
              </div>
            </div>

            <section aria-labelledby="rooms" className="flex flex-col gap-4">
              <h2 id="rooms" className="text-h2">
                Rooms
              </h2>
              {!spaces && <SkeletonList rows={1} label="Loading rooms" />}
              <ul className="grid gap-5 md:grid-cols-2">
                {spaces?.map((s) => (
                  <li key={s.id}>
                    <Card className="h-full">
                      {s.photo && <StorageImage photo={s.photo} alt={`${s.name}, empty room`} aspect="4 / 3" className="rounded-none" sizes="(min-width: 48rem) 50vw, 100vw" />}
                      <CardBody className="flex flex-col gap-2">
                        <h3 className="font-display text-h3">{s.name}</h3>
                        <p className="num flex items-center gap-1.5">
                          <Users aria-hidden className="size-4 text-muted" />
                          {s.capacityMin} to {s.capacityMax} guests · tables of {s.seatsPerTable}
                        </p>
                        <dl className="num grid grid-cols-[auto_1fr] gap-x-4 text-small">
                          {tierKeys(s).map((k) => {
                            const t = tierOf(s, k)!;
                            return (
                              <div key={k} className="contents">
                                <dt className="text-muted">{TIER_LABELS[k] || "Room rental"}</dt>
                                <dd>
                                  {formatSGD(t.roomRentalCents)}
                                  {t.minimumSpendCents !== null && <span className="text-muted"> · minimum spend {formatSGD(t.minimumSpendCents)}</span>}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      </CardBody>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>

            {catalogs && catalogs.some((c) => c.uid !== venue.ownerUid) && (
              <section aria-labelledby="decorators" className="flex flex-col gap-3">
                <h2 id="decorators" className="text-h2">
                  Decorators who work here
                </h2>
                <ul className="flex flex-wrap gap-3">
                  {catalogs
                    .filter((c) => c.uid !== venue.ownerUid)
                    .map((c) => (
                      <li key={c.uid} className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2">
                        <Flower2 aria-hidden className="size-4 text-gold" />
                        {c.profile.businessName}
                        <span className="num text-small text-muted">· {c.items.length} items</span>
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

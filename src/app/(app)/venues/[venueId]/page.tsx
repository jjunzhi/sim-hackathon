"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Accessibility, ArrowLeft, ArrowUpDown, BadgeCheck, CircleCheck, Flower2, Minus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { VenueMap } from "@/components/venue-map";
import { StorageImage } from "@/components/photos/storage-image";
import { Card, CardBody } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { getPublishedVenue, loadVenueCatalogs } from "@/lib/data/catalog";
import { watchBlockedDates, type BlockedDate } from "@/lib/data/vendors";
import { watchSpaces, type WithId } from "@/lib/data/venues";
import { tierKeys, tierOf, type TierKey } from "@/lib/estimate/build";
import type { TKey } from "@/lib/i18n/dictionaries/types";
import { useLocale } from "@/lib/i18n/provider";
import { formatSGD } from "@/lib/money";
import type { VendorCatalog } from "@/lib/plans/estimates";
import type { CatalogVenue } from "@/lib/venues/catalog";
import { ACCESS_KEYS, DIET_KEYS, MUIS_HALAL_SEARCH_URL, type DietTag } from "@/lib/venues/inclusion";
import type { Space } from "@/lib/venues/model";
import { tagLabel } from "@/lib/venues/tag-labels";

/** Mirrors TIER_LABELS in build.ts; "standard" shows as "Room rental". */
const TIER_KEYS: Record<TierKey, TKey> = { standard: "tier.roomRental", peak: "tier.peak", offPeak: "tier.offPeak" };

export default function VenuePage() {
  const { t, date } = useLocale();
  const { venueId } = useParams<{ venueId: string }>();
  const [venue, setVenue] = useState<CatalogVenue | null | undefined>(undefined);
  const [spaces, setSpaces] = useState<WithId<Space>[] | null>(null);
  const [catalogs, setCatalogs] = useState<VendorCatalog[] | null>(null);
  const [blocked, setBlocked] = useState<WithId<BlockedDate>[] | null>(null);

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
  useEffect(() => {
    if (!venue) return;
    return watchBlockedDates(venue.ownerUid, setBlocked, () => setBlocked([]));
  }, [venue]);

  return (
    <>
      <AppHeader />
      <main className="container-page flex flex-col gap-8 py-8 pb-28 sm:pb-12">
        <Link href="/venues" className="inline-flex min-h-11 w-fit items-center gap-2 text-small font-semibold text-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" />
          {t("catalog.allVenues")}
        </Link>
        {venue === undefined && <SkeletonList rows={2} label={t("catalog.loadingVenue")} />}
        {venue === null && (
          <p role="alert" className="text-muted">
            {t("catalog.notAvailable")}
          </p>
        )}
        {venue && (
          <>
            <div className="grid items-start gap-8 lg:grid-cols-[1.3fr_1fr]">
              {venue.coverPhoto && <StorageImage photo={venue.coverPhoto} alt={t("catalog.coverAlt", { name: venue.name })} aspect="3 / 2" sizes="(min-width: 64rem) 680px, 100vw" eager />}
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-h1">{venue.name}</h1>
                  {venue.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success px-2 py-0.5 text-small font-semibold text-success">
                      <BadgeCheck aria-hidden className="size-3.5" />
                      {t("badge.verified")}
                    </span>
                  )}
                </div>
                {venue.address && <p className="text-muted">{venue.address}</p>}
                {venue.description && <p>{venue.description}</p>}
                <ul className="flex flex-wrap gap-1.5" aria-label={t("catalog.styleAndCulture")}>
                  {[...venue.styleTags, ...venue.cultureTags].map((tag) => (
                    <li key={tag} className="rounded-full bg-subtle px-2.5 py-0.5 text-small">
                      {tagLabel(t, tag)}
                    </li>
                  ))}
                </ul>
                <ul className="flex flex-col gap-1 text-small" aria-label={t("catalog.access")}>
                  <li className="flex items-center gap-2">
                    <Accessibility aria-hidden className="size-4 text-muted" />
                    {venue.wheelchairAccess ? t("access.wheelchair") : t("catalog.noWheelchair")}
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowUpDown aria-hidden className="size-4 text-muted" />
                    {venue.liftAccess ? t("access.lift") : t("catalog.noLift")}
                  </li>
                  {(["stepFreeEntrance", "accessibleToilet", "accessibleParking"] as const).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      {venue[f] ? <CircleCheck aria-hidden className="size-4 text-success" /> : <Minus aria-hidden className="size-4 text-muted" />}
                      {venue[f] ? t(ACCESS_KEYS[f]) : t("venue.notListed", { item: t(ACCESS_KEYS[f]) })}
                    </li>
                  ))}
                  <li className="text-muted">{t("access.asStated")}</li>
                </ul>
                <div className="flex flex-col gap-1 text-small" aria-label={t("venue.menusHeading")}>
                  <p className="font-semibold">{t("venue.menusHeading")}</p>
                  {(venue.menuOptions ?? []).length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {(venue.menuOptions ?? []).map((m) => (
                        <li key={m} className="rounded-full bg-subtle px-2.5 py-0.5">
                          {t(DIET_KEYS[m as DietTag] ?? "diet.menus")}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">{t("venue.menusNone")}</p>
                  )}
                  {(venue.menuOptions ?? []).includes("halal") && (
                    <a href={MUIS_HALAL_SEARCH_URL} target="_blank" rel="noopener noreferrer" className="w-fit font-semibold text-accent-text underline underline-offset-4">
                      {t("venue.checkMuis")}
                    </a>
                  )}
                </div>
                <Link
                  href={`/studio/${venue.id}`}
                  className="mt-2 inline-flex min-h-13 w-fit items-center rounded-full bg-accent px-7 font-semibold text-on-accent shadow-soft transition-colors hover:bg-accent-hover"
                >
                  {t("catalog.planHere")}
                </Link>
              </div>
            </div>

            <section aria-labelledby="rooms" className="flex flex-col gap-4">
              <h2 id="rooms" className="text-h2">
                {t("catalog.rooms")}
              </h2>
              {!spaces && <SkeletonList rows={1} label={t("catalog.loadingRooms")} />}
              <ul className="grid gap-5 md:grid-cols-2">
                {spaces?.map((s) => (
                  <li key={s.id}>
                    <Card className="h-full">
                      {s.photo && <StorageImage photo={s.photo} alt={t("catalog.roomAlt", { name: s.name })} aspect="4 / 3" className="rounded-none" sizes="(min-width: 48rem) 50vw, 100vw" />}
                      <CardBody className="flex flex-col gap-2">
                        <h3 className="font-display text-h3">{s.name}</h3>
                        <p className="num flex items-center gap-1.5">
                          <Users aria-hidden className="size-4 text-muted" />
                          {t("catalog.capacityLine", { min: s.capacityMin, max: s.capacityMax, seats: s.seatsPerTable })}
                        </p>
                        <dl className="num grid grid-cols-[auto_1fr] gap-x-4 text-small">
                          {tierKeys(s).map((k) => {
                            const tier = tierOf(s, k)!;
                            return (
                              <div key={k} className="contents">
                                <dt className="text-muted">{t(TIER_KEYS[k])}</dt>
                                <dd>
                                  {formatSGD(tier.roomRentalCents)}
                                  {tier.minimumSpendCents !== null && <span className="text-muted"> {t("catalog.minimumSpend", { amount: formatSGD(tier.minimumSpendCents) })}</span>}
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

            <VenueMap name={venue.name} address={venue.address} postalCode={venue.postalCode} />

            <section aria-labelledby="booked" className="flex flex-col gap-2">
              <h2 id="booked" className="text-h2">
                {t("date.blockedHeading")}
              </h2>
              {blocked === null ? (
                <SkeletonList rows={1} label={t("common.loading")} />
              ) : blocked.length === 0 ? (
                <p className="text-muted">{t("date.blockedNone")}</p>
              ) : (
                <ul className="flex flex-wrap gap-2" aria-label={t("date.blockedHeading")}>
                  {blocked.map((b) => (
                    <li key={b.id} className="num rounded-full border border-line bg-surface px-3 py-1 text-small">
                      {date(new Date(`${b.date}T12:00:00+08:00`).getTime(), { day: "numeric", month: "short", year: "numeric" })}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-small text-muted">{t("date.blockedNote")}</p>
            </section>

            {catalogs && catalogs.some((c) => c.uid !== venue.ownerUid) && (
              <section aria-labelledby="decorators" className="flex flex-col gap-3">
                <h2 id="decorators" className="text-h2">
                  {t("catalog.decorators")}
                </h2>
                <ul className="flex flex-wrap gap-3">
                  {catalogs
                    .filter((c) => c.uid !== venue.ownerUid)
                    .map((c) => (
                      <li key={c.uid} className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2">
                        <Flower2 aria-hidden className="size-4 text-gold" />
                        {c.profile.businessName}
                        <span className="num text-small text-muted">{t("catalog.itemCount", { count: c.items.length })}</span>
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

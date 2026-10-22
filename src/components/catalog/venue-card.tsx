"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Accessibility, ArrowUpDown, BadgeCheck, Building2, Users } from "lucide-react";
import { StorageImage } from "@/components/photos/storage-image";
import { Card, CardBody } from "@/components/ui/card";
import { formatSGD } from "@/lib/money";
import { revealItem } from "@/lib/motion";
import type { CatalogVenue } from "@/lib/venues/catalog";

export function VenueCard({ venue }: { venue: CatalogVenue }) {
  const s = venue.capacitySummary;
  return (
    <motion.li variants={revealItem}>
      <Link href={`/venues/${venue.id}`} className="block h-full rounded-card" aria-label={`${venue.name}${s ? `, ${s.min} to ${s.max} guests` : ""}`}>
        <Card interactive className="flex h-full flex-col">
          {venue.coverPhoto ? (
            <StorageImage photo={venue.coverPhoto} alt="" aspect="3 / 2" className="rounded-none" sizes="(min-width: 64rem) 380px, (min-width: 40rem) 50vw, 100vw" />
          ) : (
            <div className="flex items-center justify-center bg-subtle text-muted" style={{ aspectRatio: "3 / 2" }}>
              <Building2 aria-hidden className="size-8" />
            </div>
          )}
          <CardBody className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-h3">{venue.name}</h2>
                {/* Only an admin can set this. */}
                {venue.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success px-2 py-0.5 text-small font-semibold text-success">
                    <BadgeCheck aria-hidden className="size-3.5" />
                    Verified
                  </span>
                )}
              </div>
              {venue.address && <p className="text-small text-muted">{venue.address}</p>}
            </div>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-small">
              {s && (
                <div className="flex items-center gap-1.5">
                  <dt>
                    <Users aria-hidden className="size-4 text-muted" />
                    <span className="sr-only">Guests</span>
                  </dt>
                  <dd className="num">
                    {s.min} to {s.max} guests
                  </dd>
                </div>
              )}
              {s?.fromRentalCents != null && (
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted">Room from</dt>
                  <dd className="num font-semibold">{formatSGD(s.fromRentalCents, { showCents: false })}</dd>
                </div>
              )}
            </dl>
            <ul className="flex flex-wrap gap-1.5" aria-label="Style and culture">
              {[...venue.styleTags, ...venue.cultureTags].map((t) => (
                <li key={t} className="rounded-full bg-subtle px-2.5 py-0.5 text-small text-ink">
                  {t}
                </li>
              ))}
            </ul>
            <ul className="mt-auto flex flex-wrap gap-3 text-small text-muted" aria-label="Access">
              {venue.wheelchairAccess && (
                <li className="flex items-center gap-1">
                  <Accessibility aria-hidden className="size-4" /> Wheelchair access
                </li>
              )}
              {venue.liftAccess && (
                <li className="flex items-center gap-1">
                  <ArrowUpDown aria-hidden className="size-4" /> Lift
                </li>
              )}
              {!venue.wheelchairAccess && !venue.liftAccess && <li>No step-free access listed</li>}
            </ul>
          </CardBody>
        </Card>
      </Link>
    </motion.li>
  );
}

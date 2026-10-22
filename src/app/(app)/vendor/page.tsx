"use client";

import Link from "next/link";
import { ArrowRight, Building2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { StorageImage } from "@/components/photos/storage-image";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, SkeletonList } from "@/components/ui/skeleton";
import { SetupChecklist } from "@/components/vendor/setup-checklist";
import { watchVendorLeads, type LeadRow } from "@/lib/data/leads";
import { watchVendorUsage } from "@/lib/data/renders";
import { watchItems, watchPackages } from "@/lib/data/vendors";
import { watchMyVenues, type WithId } from "@/lib/data/venues";
import type { InventoryItem, InventoryPackage } from "@/lib/inventory/model";
import type { Venue } from "@/lib/venues/model";
import { useVendor } from "@/lib/vendors/vendor-context";

const primaryLink =
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-on-accent transition-colors hover:bg-accent-hover";
const textLink = "inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent-text hover:underline underline-offset-4";

export default function VendorOverview() {
  const vendor = useVendor();
  const uid = vendor.status === "ready" ? vendor.uid : null;
  const [venues, setVenues] = useState<WithId<Venue>[] | null>(null);
  const [items, setItems] = useState<WithId<InventoryItem>[] | null>(null);
  const [packages, setPackages] = useState<WithId<InventoryPackage>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [leads, setLeads] = useState<LeadRow[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    const onErr = () => setError("We couldn't load everything. Please refresh the page.");
    const subs = [
      watchMyVenues(uid, setVenues, onErr),
      watchItems(uid, setItems, onErr),
      watchPackages(uid, setPackages, onErr),
      watchVendorUsage(uid, setUsage),
      watchVendorLeads(uid, setLeads),
    ];
    return () => subs.forEach((u) => u());
  }, [uid]);

  if (vendor.status !== "ready") return null;
  const { profile } = vendor;
  const isVenue = profile.kinds.includes("venue");
  const activeItems = items?.filter((i) => i.active).length ?? 0;

  return (
    <main className="container-page flex flex-col gap-10 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1">{profile.businessName}</h1>
          {profile.published ? <Badge tone="confirmed">Published</Badge> : <Badge tone="neutral">Not published yet</Badge>}
        </div>
        <p className="text-muted">
          {profile.kinds.map((k) => (k === "venue" ? "Venue" : "Decorator")).join(" and ")}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}

      <SetupChecklist uid={vendor.uid} profile={profile} />

      <section aria-labelledby="inv-h" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <h2 id="inv-h" className="sr-only">
          Inventory
        </h2>
        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="text-small text-muted">Inventory</p>
            <p className="num font-display text-h2">{items ? `${items.length} ${items.length === 1 ? "item" : "items"}` : "..."}</p>
            <p className="num text-small text-muted">{activeItems} available to couples</p>
            <Link href="/vendor/inventory" className={textLink}>
              Manage inventory <ArrowRight aria-hidden className="size-4" />
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="text-small text-muted">Packages</p>
            <p className="num font-display text-h2">{packages ? `${packages.length} ${packages.length === 1 ? "package" : "packages"}` : "..."}</p>
            <p className="text-small text-muted">Bundles of items at one price.</p>
            <Link href="/vendor/packages" className={textLink}>
              Manage packages <ArrowRight aria-hidden className="size-4" />
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="text-small text-muted">Estimate requests</p>
            <p className="num font-display text-h2">{leads ? `${leads.filter((l) => l.status === "new").length} new` : "..."}</p>
            <p className="num text-small text-muted">{leads ? `${leads.length} in total` : ""}</p>
            <Link href="/vendor/leads" className={textLink}>
              See leads <ArrowRight aria-hidden className="size-4" />
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="text-small text-muted">AI renders this month</p>
            <p className="num font-display text-h2">{usage ? `${usage.used} of ${usage.limit}` : "..."}</p>
            {usage && (
              <div
                role="meter"
                aria-label="Renders used this month"
                aria-valuemin={0}
                aria-valuemax={usage.limit}
                aria-valuenow={usage.used}
                className="h-2 overflow-hidden rounded-full bg-subtle"
              >
                <div
                  className="h-full origin-left rounded-full bg-accent transition-transform duration-300"
                  style={{ transform: `scaleX(${usage.limit ? Math.min(1, usage.used / usage.limit) : 0})` }}
                />
              </div>
            )}
            <p className="text-small text-muted">Counts renders of your rooms by anyone. Saved renders that are reused don&apos;t count.</p>
          </CardBody>
        </Card>
      </section>

      {isVenue && (
        <section aria-labelledby="venues-h" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="venues-h" className="text-h2">
              Your venues
            </h2>
            {venues && venues.length > 0 && (
              <Link href="/vendor/venues/new" className={primaryLink}>
                <Plus aria-hidden className="size-5" />
                Add a venue
              </Link>
            )}
          </div>
          {!venues && !error && <SkeletonList rows={2} label="Loading your venues" />}
          {venues?.length === 0 && (
            <EmptyState
              icon={<Building2 aria-hidden className="size-8" />}
              title="List your first venue"
              action={
                <Link href="/vendor/venues/new" className={primaryLink}>
                  <Plus aria-hidden className="size-5" />
                  Add a venue
                </Link>
              }
            >
              It takes about ten minutes. You can save a draft and come back.
            </EmptyState>
          )}
          {venues && venues.length > 0 && (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((v) => (
                <li key={v.id}>
                  <Link href={`/vendor/venues/${v.id}`} className="block rounded-card">
                    <Card interactive>
                      {v.coverPhoto ? (
                        <StorageImage
                          photo={v.coverPhoto}
                          alt=""
                          aspect="3 / 2"
                          className="rounded-none"
                          sizes="(min-width: 64rem) 33vw, (min-width: 40rem) 50vw, 100vw"
                        />
                      ) : (
                        <div className="flex items-center justify-center bg-subtle text-muted" style={{ aspectRatio: "3 / 2" }}>
                          <Building2 aria-hidden className="size-8" />
                        </div>
                      )}
                      <CardBody className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          {v.status === "active" ? <Badge tone="confirmed">Published</Badge> : <Badge tone="neutral">Draft</Badge>}
                          {v.verified && <Badge tone="confirmed">Verified</Badge>}
                        </div>
                        <p className="font-display text-h3">{v.name}</p>
                        {v.address && <p className="text-small text-muted">{v.address}</p>}
                      </CardBody>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

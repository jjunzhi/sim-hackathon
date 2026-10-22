"use client";

import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { StorageImage } from "@/components/photos/storage-image";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, SkeletonList } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { watchMyVenues, type WithId } from "@/lib/data/venues";
import type { Venue } from "@/lib/venues/model";

const primaryLink =
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-on-accent transition-colors hover:bg-accent-hover";

export default function VendorDashboard() {
  const auth = useAuth();
  const uid = auth.status === "ready" ? auth.user.uid : null;
  const [venues, setVenues] = useState<WithId<Venue>[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return watchMyVenues(uid, setVenues, () => setError("We couldn't load your venues. Please refresh the page."));
  }, [uid]);

  return (
    <main className="container-page flex flex-col gap-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">Your venues</h1>
          <p className="text-muted">Add your spaces, capacities and prices. Couples see a venue once you publish it.</p>
        </div>
        {venues && venues.length > 0 && (
          <Link href="/vendor/venues/new" className={primaryLink}>
            <Plus aria-hidden className="size-5" />
            Add a venue
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
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
                    <StorageImage photo={v.coverPhoto} alt="" aspect="3 / 2" className="rounded-none" sizes="(min-width: 64rem) 33vw, (min-width: 40rem) 50vw, 100vw" />
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
    </main>
  );
}

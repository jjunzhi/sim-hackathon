"use client";

import { motion } from "motion/react";
import { SearchX, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { FilterControls } from "@/components/catalog/filter-controls";
import { VenueCard } from "@/components/catalog/venue-card";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/modal";
import { EmptyState, Skeleton } from "@/components/ui/skeleton";
import { watchCatalog } from "@/lib/data/catalog";
import { revealContainer } from "@/lib/motion";
import { activeFilterCount, matchesFilters, NO_FILTERS, type CatalogFilters, type CatalogVenue } from "@/lib/venues/catalog";

export default function CatalogPage() {
  const [venues, setVenues] = useState<CatalogVenue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CatalogFilters>(NO_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => watchCatalog(setVenues, () => setError("We couldn't load venues. Please refresh the page.")), []);

  const shown = useMemo(() => (venues ?? []).filter((v) => matchesFilters(v, filters)), [venues, filters]);
  const count = activeFilterCount(filters);
  const summary = venues ? `${shown.length} ${shown.length === 1 ? "venue" : "venues"}` : "";

  return (
    <>
      <AppHeader />
      <main className="container-page flex flex-col gap-6 py-10 pb-28 sm:pb-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1">Venues</h1>
          <p className="max-w-2xl text-muted">Every venue lists its real rooms, guest numbers and prices.</p>
        </div>

        <div className="flex items-center justify-between gap-3 lg:hidden">
          <p className="num text-small text-muted" aria-live="polite">
            {summary}
          </p>
          <Button onClick={() => setSheetOpen(true)} icon={<SlidersHorizontal aria-hidden className="size-4" />}>
            Filters{count ? ` (${count})` : ""}
          </Button>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[17rem_1fr]">
          <aside aria-label="Filters" className="hidden flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-soft lg:flex">
            <div className="flex items-center justify-between">
              <h2 className="text-h3">Filters</h2>
              {count > 0 && (
                <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
                  Clear
                </Button>
              )}
            </div>
            <FilterControls value={filters} onChange={setFilters} />
          </aside>

          <section aria-label="Venues" className="flex flex-col gap-4">
            <p className="num hidden text-small text-muted lg:block" aria-live="polite">
              {summary}
            </p>
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            {!venues && !error && (
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading venues">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="overflow-hidden rounded-card border border-line bg-surface">
                    <Skeleton className="rounded-none" style={{ aspectRatio: "3 / 2" }} />
                    <div className="flex flex-col gap-2 p-5">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {venues && shown.length === 0 && (
              <EmptyState
                icon={<SearchX aria-hidden className="size-8" />}
                title="No venues match all of these"
                action={count > 0 ? <Button onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button> : undefined}
              >
                {count > 0 ? "Try removing a filter or changing the number of guests." : "No venues are listed yet. Please check back soon."}
              </EmptyState>
            )}
            {shown.length > 0 && (
              <motion.ul variants={revealContainer} initial="hidden" animate="visible" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((v) => (
                  <VenueCard key={v.id} venue={v} />
                ))}
              </motion.ul>
            )}
          </section>
        </div>
      </main>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Filters"
        footer={
          <>
            {count > 0 && <Button onClick={() => setFilters(NO_FILTERS)}>Clear</Button>}
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              Show {summary || "venues"}
            </Button>
          </>
        }
      >
        <FilterControls value={filters} onChange={setFilters} />
      </BottomSheet>
    </>
  );
}

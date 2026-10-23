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
import { useT } from "@/lib/i18n/provider";
import { revealContainer } from "@/lib/motion";
import { activeFilterCount, matchesFilters, NO_FILTERS, type CatalogFilters, type CatalogVenue } from "@/lib/venues/catalog";

export default function CatalogPage() {
  const t = useT();
  const [venues, setVenues] = useState<CatalogVenue[] | null>(null);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<CatalogFilters>(NO_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => watchCatalog(setVenues, () => setError(true)), []);

  const shown = useMemo(() => (venues ?? []).filter((v) => matchesFilters(v, filters)), [venues, filters]);
  const count = activeFilterCount(filters);
  const summary = venues ? t("catalog.venueCount", { count: shown.length }) : "";

  return (
    <>
      <AppHeader />
      <main className="container-page flex flex-col gap-6 py-10 pb-28 sm:pb-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1">{t("nav.venues")}</h1>
          <p className="max-w-2xl text-muted">{t("catalog.intro")}</p>
        </div>

        <div className="flex items-center justify-between gap-3 lg:hidden">
          <p className="num text-small text-muted" aria-live="polite">
            {summary}
          </p>
          <Button onClick={() => setSheetOpen(true)} icon={<SlidersHorizontal aria-hidden className="size-4" />}>
            {count ? t("catalog.filtersWithCount", { n: count }) : t("catalog.filters")}
          </Button>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[17rem_1fr]">
          <aside aria-label={t("catalog.filters")} className="hidden flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-soft lg:flex">
            <div className="flex items-center justify-between">
              <h2 className="text-h3">{t("catalog.filters")}</h2>
              {count > 0 && (
                <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
                  {t("catalog.clear")}
                </Button>
              )}
            </div>
            <FilterControls value={filters} onChange={setFilters} />
          </aside>

          <section aria-label={t("nav.venues")} className="flex flex-col gap-4">
            <p className="num hidden text-small text-muted lg:block" aria-live="polite">
              {summary}
            </p>
            {error && (
              <p role="alert" className="text-error">
                {t("catalog.loadError")}
              </p>
            )}
            {!venues && !error && (
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label={t("catalog.loadingVenues")}>
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
                title={count > 0 ? t("catalog.noMatch") : t("catalog.noneListedTitle")}
                action={count > 0 ? <Button onClick={() => setFilters(NO_FILTERS)}>{t("catalog.clearFilters")}</Button> : undefined}
              >
                {count > 0 ? t("catalog.noMatchHint") : t("catalog.noneListed")}
              </EmptyState>
            )}
            {shown.length > 0 && (
              <motion.ul variants={revealContainer} initial="hidden" animate="visible" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {/* The first row is in view on load; don't make it wait on lazy loading. */}
                {shown.map((v, i) => (
                  <VenueCard key={v.id} venue={v} eager={i < 3} />
                ))}
              </motion.ul>
            )}
          </section>
        </div>
      </main>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={t("catalog.filters")}
        footer={
          <>
            {count > 0 && <Button onClick={() => setFilters(NO_FILTERS)}>{t("catalog.clear")}</Button>}
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              {venues ? t("catalog.showCount", { count: shown.length }) : t("catalog.showVenues")}
            </Button>
          </>
        }
      >
        <FilterControls value={filters} onChange={setFilters} />
      </BottomSheet>
    </>
  );
}

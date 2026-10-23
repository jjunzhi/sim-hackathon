"use client";

import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

/**
 * Where the venue is. With a Maps Embed API key (public, restricted to this
 * site's referrers and to the Embed API in Google Cloud) an iframe shows the
 * place; without one, only the links. Both link forms are Google's documented
 * Maps URLs and need no key. We never geocode or store coordinates.
 */
export function VenueMap({ name, address, postalCode }: { name: string; address: string; postalCode: string }) {
  const t = useT();
  const key = process.env.NEXT_PUBLIC_MAPS_EMBED_KEY;
  const query = [name, address, postalCode ? `Singapore ${postalCode}` : "Singapore"].filter(Boolean).join(", ");
  const q = encodeURIComponent(query);
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${q}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-small font-semibold hover:bg-subtle";

  return (
    <section aria-labelledby="map-h" className="flex flex-col gap-3">
      <h2 id="map-h" className="text-h2">
        {t("map.heading")}
      </h2>
      {address && (
        <p className="flex items-start gap-2 text-muted">
          <MapPin aria-hidden className="mt-1 size-4 shrink-0" />
          <span>
            {address}
            {postalCode && !address.includes(postalCode) ? ` ${postalCode}` : ""}
          </span>
        </p>
      )}
      {key && (
        <iframe
          title={t("map.title", { name })}
          src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${q}&region=SG`}
          className="aspect-[16/9] w-full rounded-xl border border-line"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <ExternalLink aria-hidden className="size-4" />
          {t("map.open")}
        </a>
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <Navigation aria-hidden className="size-4" />
          {t("map.directions")}
        </a>
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TKey } from "@/lib/i18n/dictionaries/types";
import { useT } from "@/lib/i18n/provider";

/** Licensed stock photos of the listed rooms (credits: scripts/sample-venues/photos/CREDITS.md). */
const PHOTOS: Array<{ src: string; label: TKey; alt: TKey }> = [
  { src: "/venues/garden-pavilion--glasshouse.webp", label: "landing.hero.glasshouse", alt: "landing.hero.glasshouseAlt" },
  { src: "/venues/grand-orchard--grand-ballroom.webp", label: "landing.hero.ballroom", alt: "landing.hero.ballroomAlt" },
  { src: "/venues/kampong-garden--lawn.webp", label: "landing.hero.lawn", alt: "landing.hero.lawnAlt" },
  { src: "/venues/rooftop-loft--skyline.webp", label: "landing.hero.rooftop", alt: "landing.hero.rooftopAlt" },
];

/**
 * Landing hero: a quiet loop through real room photos, using opacity only.
 * Pauses on hover, focus or touch. With reduced motion it stays still and
 * offers a button instead.
 */
export function HeroCrossfade() {
  const t = useT();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const photo = PHOTOS[index]!;

  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % PHOTOS.length), 4200);
    return () => window.clearInterval(id);
  }, [reduce, paused]);

  return (
    <figure
      className="flex flex-col gap-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="relative overflow-hidden rounded-xl border border-line bg-subtle shadow-lift" style={{ aspectRatio: "4 / 3" }}>
        <AnimatePresence initial={false}>
          <motion.div key={photo.src} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeInOut" }}>
            <Image src={photo.src} alt={t(photo.alt)} fill priority={index === 0} sizes="(min-width: 64rem) 560px, 100vw" className="object-cover" />
          </motion.div>
        </AnimatePresence>
        {/* Not a live region: a looping label shouldn't keep interrupting screen readers. */}
        <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-3 py-1 text-small font-semibold text-ink shadow-soft" aria-hidden>
          {t(photo.label)}
        </span>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-small text-muted">
        <span>{t("landing.hero.caption")}</span>
        {(reduce || paused) && (
          <Button variant="ghost" onClick={() => setIndex((i) => (i + 1) % PHOTOS.length)}>
            {t("landing.hero.next")}
          </Button>
        )}
      </figcaption>
    </figure>
  );
}

"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const BEFORE = { src: "/samples/hall-before.svg", alt: "SAMPLE illustration of an empty function hall" };
const AFTER = { src: "/samples/hall-after.svg", alt: "SAMPLE illustration of the same hall decorated with a floral arch, draped tables and warm lights" };

/**
 * Landing hero: a quiet loop between the empty room and the decorated one,
 * using opacity only. Pauses on hover, focus or touch. With reduced motion it
 * stays still and offers a button instead.
 */
export function HeroCrossfade() {
  const reduce = useReducedMotion();
  const [showAfter, setShowAfter] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setInterval(() => setShowAfter((s) => !s), 3600);
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
        <Image src={BEFORE.src} alt={BEFORE.alt} fill priority unoptimized sizes="(min-width: 64rem) 560px, 100vw" className="object-cover" />
        <AnimatePresence initial={false}>
          {showAfter && (
            <motion.div key="after" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeInOut" }}>
              <Image src={AFTER.src} alt={AFTER.alt} fill priority unoptimized sizes="(min-width: 64rem) 560px, 100vw" className="object-cover" />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Not a live region: a looping label shouldn't keep interrupting screen readers. */}
        <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-3 py-1 text-small font-semibold text-ink shadow-soft" aria-hidden>
          {showAfter ? "Decorated" : "Today"}
        </span>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-small text-muted">
        <span>SAMPLE illustration. Real renders use the venue&apos;s own photos and decor.</span>
        {(reduce || paused) && (
          <Button variant="ghost" onClick={() => setShowAfter((s) => !s)} aria-pressed={showAfter}>
            {showAfter ? "Show the room before" : "Show it decorated"}
          </Button>
        )}
      </figcaption>
    </figure>
  );
}

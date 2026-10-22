"use client";

import Image from "next/image";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ChevronsLeftRight } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface BeforeAfterSliderProps {
  before: { src: string; alt: string };
  after: { src: string; alt: string };
  beforeLabel?: string;
  afterLabel?: string;
  /** Initial divider position, 0-100. */
  initial?: number;
  /** CSS aspect-ratio, reserved up front so nothing jumps (CLS). */
  aspect?: string;
  sizes?: string;
  priority?: boolean;
  /** Needed for SVG sources. */
  unoptimized?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Drag anywhere on the image (pointer capture) or focus the handle and use
 * arrow keys: 5% per press, 1% with Shift, Home/End for the ends.
 */
export function BeforeAfterSlider({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
  initial = 50,
  aspect = "4 / 3",
  sizes = "(min-width: 75rem) 1200px, 100vw",
  priority,
  unoptimized,
  className,
  children,
}: BeforeAfterSliderProps) {
  const [pos, setPos] = useState(clamp(initial));
  const [touched, setTouched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const inView = useInView(containerRef, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();

  const setFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setPos(clamp(((clientX - rect.left) / rect.width) * 100));
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    dragging.current = true;
    setTouched(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current) setFromClientX(e.clientX);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 1 : 5;
    const keys: Record<string, (p: number) => number> = {
      ArrowLeft: (p) => p - step,
      ArrowDown: (p) => p - step,
      ArrowRight: (p) => p + step,
      ArrowUp: (p) => p + step,
      PageDown: (p) => p - 10,
      PageUp: (p) => p + 10,
      Home: () => 0,
      End: () => 100,
    };
    const fn = keys[e.key];
    if (!fn) return;
    e.preventDefault();
    setTouched(true);
    setPos((p) => clamp(fn(p)));
  }

  const rounded = Math.round(pos);
  const pulse = inView && !touched && !reduce;

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full select-none overflow-hidden rounded-xl bg-subtle", className)}
      style={{ aspectRatio: aspect, touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Image src={before.src} alt={before.alt} fill sizes={sizes} priority={priority} unoptimized={unoptimized} draggable={false} className="object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <Image src={after.src} alt={after.alt} fill sizes={sizes} priority={priority} unoptimized={unoptimized} draggable={false} className="object-cover" />
      </div>

      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-surface/90 px-3 py-1 text-small font-semibold text-ink shadow-soft">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-surface/90 px-3 py-1 text-small font-semibold text-ink shadow-soft">
        {afterLabel}
      </span>

      {/* Divider line + handle, positioned with transform only */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-full"
        style={{ transform: `translateX(${pos}%)` }}
      >
        <div className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-white/90 shadow-[0_0_0_1px_rgb(0_0_0/0.15)]" />
        <motion.div
          role="slider"
          tabIndex={0}
          aria-label={`Compare ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}`}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rounded}
          aria-valuetext={`${100 - rounded}% ${afterLabel.toLowerCase()} showing`}
          onKeyDown={onKeyDown}
          animate={pulse ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={pulse ? { duration: 0.9, ease: "easeInOut", delay: 0.4 } : { duration: 0.15 }}
          className={cn(
            "pointer-events-auto absolute left-0 top-1/2 -ml-6 -mt-6 flex size-12 cursor-ew-resize items-center justify-center",
            "rounded-full border border-line bg-surface text-ink shadow-lift",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <ChevronsLeftRight aria-hidden className="size-5" />
        </motion.div>
      </div>
      {children}
    </div>
  );
}

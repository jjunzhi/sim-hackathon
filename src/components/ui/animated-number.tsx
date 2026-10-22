"use client";

import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

export interface AnimatedNumberProps {
  /** Integer value (cents for money, guests for headcount). */
  value: number;
  /** Formats a rounded integer for display, e.g. formatSGD. */
  format?: (value: number) => string;
  className?: string;
}

const defaultFormat = (n: number) => n.toLocaleString("en-SG");

/**
 * Smoothly springs between values. The animated text is aria-hidden; screen
 * readers get the final value only, so they are not flooded mid-animation.
 * With reduced motion the number jumps straight to the new value.
 */
export function AnimatedNumber({ value, format = defaultFormat, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 140, damping: 24, mass: 0.8 });
  const display = useTransform(spring, (v) => format(Math.round(v)));

  useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, reduce, spring]);

  return (
    <span className={cn("num relative inline-block", className)}>
      <motion.span aria-hidden>{display}</motion.span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

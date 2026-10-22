/**
 * Central motion definitions. Durations 150-300ms; ease-out for entering,
 * ease-in-out for moving. Only transform and opacity are animated.
 * Reduced motion: <MotionConfig reducedMotion="user"> (in Providers) strips
 * transform animations automatically; components that do count-ups or pulses
 * also check useReducedMotion() and skip them.
 */
import type { Transition, Variants } from "motion/react";

export const duration = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3,
} as const;

export const ease = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  in: [0.7, 0, 0.84, 0],
} as const;

export const transition = {
  enter: { duration: duration.base, ease: ease.out },
  exit: { duration: duration.fast, ease: ease.in },
  move: { duration: duration.slow, ease: ease.inOut },
  fade: { duration: duration.base, ease: "linear" },
  /** Bottom sheets and mobile toasts. */
  spring: { type: "spring", stiffness: 420, damping: 38, mass: 0.9 },
  /** Small vote bounce: springs take two keyframes, so start a little small and overshoot into place. */
  bounce: { type: "spring", stiffness: 600, damping: 15 },
} satisfies Record<string, Transition>;

/** Journey step change: fade plus 12px slide. Pass custom={direction}. */
export const stepVariants: Variants = {
  initial: (dir: number = 1) => ({ opacity: 0, x: 12 * dir }),
  animate: { opacity: 1, x: 0, transition: transition.enter },
  exit: (dir: number = 1) => ({ opacity: 0, x: -12 * dir, transition: transition.exit }),
};

/** Scroll reveal container: children fade up with a 60ms stagger, once. */
export const revealContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
};

export const revealViewport = { once: true, amount: 0.2 } as const;

/** Cards and buttons. Hover lift only applies on hover-capable pointers (see CSS). */
export const pressable = {
  whileTap: { scale: 0.98 },
  transition: { duration: duration.fast, ease: ease.out },
} as const;

export const liftable = {
  ...pressable,
  whileHover: { y: -2 },
} as const;

/** Desktop modal: scale-fade. */
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transition.enter },
  exit: { opacity: 0, scale: 0.98, transition: transition.exit },
};

/** Mobile sheet and toast: from the bottom. */
export const sheetVariants: Variants = {
  hidden: { y: "100%" },
  visible: { y: 0, transition: transition.spring },
  exit: { y: "100%", transition: { duration: duration.base, ease: ease.in } },
};

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.fade },
  exit: { opacity: 0, transition: { duration: duration.fast } },
};

/** Slide-down message (capacity warnings). */
export const slideDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: transition.enter },
  exit: { opacity: 0, y: -4, transition: transition.exit },
};

/** Cross-fade (render reveal). */
export const crossFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.slow, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: duration.slow } },
};

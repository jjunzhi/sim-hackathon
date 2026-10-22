"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { checkCapacity } from "@/lib/capacity";
import { slideDown } from "@/lib/motion";

/** "Within capacity" or a warning that slides in. Announced only when the status changes. */
export function CapacityStatus({ headcount, range }: { headcount: number; range: { min: number; max: number } }) {
  const { status } = checkCapacity(headcount, range);
  const message =
    status === "over"
      ? `Over this room's maximum of ${range.max} guests. Trim the guest list or choose a larger room.`
      : status === "under"
        ? `Below this room's minimum of ${range.min} guests. Check with the venue before booking.`
        : null;
  return (
    <div aria-live="polite" aria-atomic="true">
      <AnimatePresence initial={false} mode="wait">
        {message ? (
          <motion.p
            key={status}
            variants={slideDown}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-start gap-2 rounded-lg border border-warning-icon bg-surface p-3 text-small font-medium text-warning transition-colors"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-icon" />
            {message}
          </motion.p>
        ) : (
          <motion.p key="within" variants={slideDown} initial="hidden" animate="visible" exit="exit" className="flex items-center gap-2 text-small font-semibold text-success">
            <CircleCheck aria-hidden className="size-4" />
            Within capacity
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

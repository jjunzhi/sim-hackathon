"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";
import { liftable } from "@/lib/motion";

export interface CardProps extends HTMLMotionProps<"div"> {
  /** Adds the hover lift and press scale (for clickable cards). */
  interactive?: boolean;
}

export function Card({ interactive, className, ...props }: CardProps) {
  return (
    <motion.div
      {...(interactive ? liftable : {})}
      className={cn(
        "overflow-hidden rounded-card border border-line bg-surface shadow-soft",
        interactive && "cursor-pointer transition-shadow duration-200 hover:shadow-lift",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

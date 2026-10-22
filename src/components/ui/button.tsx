"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { pressable } from "@/lib/motion";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  // One primary per screen.
  primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-soft",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-subtle",
  ghost: "bg-transparent text-accent-text hover:bg-accent-tint",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-body gap-2",
  lg: "min-h-13 px-7 text-body gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, icon, className, children, disabled, type = "button", ...props },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      whileTap={isDisabled ? undefined : pressable.whileTap}
      transition={pressable.transition}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-semibold",
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" /> : icon}
      {children}
    </motion.button>
  );
});

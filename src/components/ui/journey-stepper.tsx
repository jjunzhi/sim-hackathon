"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import { transition } from "@/lib/motion";

export interface JourneyStep {
  id: string;
  label: string;
}

export interface JourneyStepperProps {
  steps: JourneyStep[];
  current: number;
  /** When provided, completed and current steps become buttons. */
  onStepChange?: (index: number) => void;
  /** Also let people jump ahead (editing flows where order doesn't matter). */
  allowForward?: boolean;
  /** Accessible name for the navigation landmark. */
  label?: string;
  className?: string;
}

/**
 * Desktop: full labelled row. Mobile: compact bar with the current step name,
 * meant to sit in a sticky bottom area so nothing scrolls sideways.
 */
export function JourneyStepper({
  steps,
  current,
  onStepChange,
  allowForward,
  label,
  className,
}: JourneyStepperProps) {
  const t = useT();
  const progress = steps.length > 1 ? current / (steps.length - 1) : 1;
  const currentStep = steps[current];

  return (
    <nav aria-label={label ?? t("ui.stepper.label")} className={cn("w-full", className)}>
      {/* Mobile compact */}
      <div className="flex flex-col gap-2 sm:hidden">
        <p className="flex items-baseline justify-between text-small">
          <span className="font-semibold text-ink">{currentStep?.label}</span>
          <span className="num text-muted">{t("common.stepOf", { n: current + 1, total: steps.length })}</span>
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
          <motion.div
            className="h-full origin-left rounded-full bg-accent"
            initial={false}
            animate={{ scaleX: (current + 1) / steps.length }}
            transition={transition.move}
          />
        </div>
      </div>

      {/* Desktop and tablet */}
      <div className="relative hidden sm:block">
        {/* Equal columns, so the track runs from the first dot's centre to the last. */}
        <div
          aria-hidden
          className="absolute top-5 h-0.5 -translate-y-1/2 bg-line"
          style={{ insetInline: `calc(100% / ${steps.length * 2})` }}
        >
          <motion.div
            className="h-full origin-left bg-accent"
            initial={false}
            animate={{ scaleX: progress }}
            transition={transition.move}
          />
        </div>
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((step, i) => {
            const state = i < current ? "done" : i === current ? "current" : "upcoming";
            const clickable = onStepChange && (allowForward || i <= current);
            const dot = (
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border-2 text-small font-semibold transition-colors duration-200",
                  state === "done" && "border-accent bg-accent text-on-accent",
                  state === "current" && "border-accent bg-surface text-accent-text",
                  state === "upcoming" && "border-line-strong bg-surface text-muted",
                )}
              >
                {state === "done" ? <Check aria-hidden className="size-4" strokeWidth={3} /> : <span className="num">{i + 1}</span>}
              </span>
            );
            const content = (
              <>
                {dot}
                <span className={cn("text-small", state === "current" ? "font-semibold text-ink" : "text-muted")}>
                  {step.label}
                  {state === "done" && <span className="sr-only"> {t("ui.stepper.completed")}</span>}
                </span>
              </>
            );
            return (
              <li key={step.id} aria-current={state === "current" ? "step" : undefined} className="flex flex-col items-center">
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => onStepChange(i)}
                    className="flex min-h-11 flex-col items-center gap-2 rounded-lg px-2 text-center"
                  >
                    {content}
                  </button>
                ) : (
                  <span className="flex flex-col items-center gap-2 px-2 text-center">{content}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

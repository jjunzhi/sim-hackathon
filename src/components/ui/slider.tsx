"use client";

import { Slider as RSlider } from "radix-ui";
import { useId } from "react";
import { cn } from "@/lib/cn";

export interface SliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Screen-reader text for the current value, e.g. "185 guests". */
  valueText?: (value: number) => string;
  /** Visible value next to the label. */
  displayValue?: React.ReactNode;
  /** Content under the track (helper line, warnings). */
  children?: React.ReactNode;
  tone?: "default" | "warning";
  className?: string;
}

export function Slider({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  valueText,
  displayValue,
  children,
  tone = "default",
  className,
}: SliderProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <span id={`${id}-label`} className="text-small font-semibold text-ink">
          {label}
        </span>
        {displayValue !== undefined && <span className="num text-h3 font-display text-ink">{displayValue}</span>}
      </div>
      <RSlider.Root
        value={[value]}
        onValueChange={(v) => v[0] !== undefined && onValueChange(v[0])}
        min={min}
        max={max}
        step={step}
        aria-labelledby={`${id}-label`}
        className="relative flex h-11 w-full touch-none select-none items-center"
      >
        <RSlider.Track className="relative h-2 grow overflow-hidden rounded-full bg-subtle ring-1 ring-line-strong ring-inset">
          <RSlider.Range
            className={cn(
              "absolute h-full rounded-full transition-colors duration-300",
              tone === "warning" ? "bg-warning-icon" : "bg-accent",
            )}
          />
        </RSlider.Track>
        <RSlider.Thumb
          aria-labelledby={`${id}-label`}
          aria-valuetext={valueText?.(value)}
          className={cn(
            "block size-7 rounded-full border-2 bg-surface shadow-soft transition-[border-color] duration-300",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            tone === "warning" ? "border-warning-icon" : "border-accent",
          )}
        />
      </RSlider.Root>
      <div className="num flex justify-between text-small text-muted" aria-hidden>
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {children}
    </div>
  );
}

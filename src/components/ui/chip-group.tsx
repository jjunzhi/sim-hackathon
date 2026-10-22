"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** Multi-select as toggle chips. Native checkboxes underneath for keyboard and screen readers. */
export function ChipGroup({
  legend,
  options,
  value,
  onChange,
  hint,
  label,
}: {
  legend: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  /** Display text for an option; the option value itself is used when omitted. */
  label?: (option: string) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-small font-semibold text-ink">{legend}</legend>
      {hint && <p className="-mt-1 text-small text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <label
              key={o}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-small font-semibold transition-colors duration-150",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                on ? "border-accent bg-accent-tint text-accent-text" : "border-line-strong bg-surface text-ink hover:bg-subtle",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
              />
              {on && <Check aria-hidden className="size-4" />}
              {label ? label(o) : o}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

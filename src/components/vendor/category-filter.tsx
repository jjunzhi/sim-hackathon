"use client";

import { cn } from "@/lib/cn";

/** Single-choice filter as chips (native radios underneath). */
export function CategoryFilter({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Filter by category</legend>
      <div className="flex flex-wrap gap-2">
        {["All", ...options].map((o) => (
          <label
            key={o}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-small font-semibold transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              value === o ? "border-accent bg-accent-tint text-accent-text" : "border-line-strong bg-surface text-ink hover:bg-subtle",
            )}
          >
            <input type="radio" name="category-filter" className="sr-only" checked={value === o} onChange={() => onChange(o)} />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

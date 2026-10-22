"use client";

import { cn } from "@/lib/cn";
import { UNIT_LABELS, UNITS, type Unit } from "@/lib/inventory/model";

const HINTS: Record<Unit, string> = {
  piece: "One price per piece, for example an arch.",
  table: "Multiplied by the number of tables.",
  guest: "Multiplied by the number of guests.",
};

export function UnitPicker({ value, onChange, name }: { value: Unit; onChange: (u: Unit) => void; name: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-small font-semibold text-ink">Priced</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {UNITS.map((u) => (
          <label
            key={u}
            className={cn(
              "flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border px-4 py-2 transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              value === u ? "border-accent bg-accent-tint" : "border-line-strong bg-surface hover:bg-subtle",
            )}
          >
            <input type="radio" name={name} checked={value === u} onChange={() => onChange(u)} className="sr-only" />
            <span className="font-semibold text-ink">{UNIT_LABELS[u]}</span>
            <span className="text-small text-muted">{HINTS[u]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

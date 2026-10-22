"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import type { CatalogFilters } from "@/lib/venues/catalog";
import { CULTURE_TAGS, STYLE_TAGS } from "@/lib/venues/model";

/** The same controls in the desktop sidebar and the mobile bottom sheet. */
export function FilterControls({ value, onChange }: { value: CatalogFilters; onChange: (f: CatalogFilters) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <Input
        label="Number of guests"
        inputMode="numeric"
        className="num"
        placeholder="For example, 180"
        hint="Shows venues with a room that fits."
        value={value.guests === null ? "" : String(value.guests)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          onChange({ ...value, guests: digits ? Number(digits) : null });
        }}
      />
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-small font-semibold text-ink">Access</legend>
        <Checkbox label="Wheelchair access" checked={value.wheelchair} onCheckedChange={(c) => onChange({ ...value, wheelchair: c })} />
        <Checkbox label="Lift access" checked={value.lift} onCheckedChange={(c) => onChange({ ...value, lift: c })} />
      </fieldset>
      <ChipGroup legend="Style" options={STYLE_TAGS} value={value.styles} onChange={(styles) => onChange({ ...value, styles })} />
      <ChipGroup legend="Culture and traditions" options={CULTURE_TAGS} value={value.cultures} onChange={(cultures) => onChange({ ...value, cultures })} />
    </div>
  );
}

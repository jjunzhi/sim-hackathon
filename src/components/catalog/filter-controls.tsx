"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/provider";
import type { CatalogFilters } from "@/lib/venues/catalog";
import { DIET_KEYS, DIET_TAGS, type DietTag } from "@/lib/venues/inclusion";
import { CULTURE_TAGS, STYLE_TAGS } from "@/lib/venues/model";
import { tagLabel } from "@/lib/venues/tag-labels";

/** The same controls in the desktop sidebar and the mobile bottom sheet. */
export function FilterControls({ value, onChange }: { value: CatalogFilters; onChange: (f: CatalogFilters) => void }) {
  const t = useT();
  const label = (o: string) => tagLabel(t, o);
  return (
    <div className="flex flex-col gap-6">
      <Input
        label={t("catalog.filterGuests")}
        inputMode="numeric"
        className="num"
        placeholder={t("catalog.filterGuestsPlaceholder")}
        hint={t("catalog.filterGuestsHint")}
        value={value.guests === null ? "" : String(value.guests)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          onChange({ ...value, guests: digits ? Number(digits) : null });
        }}
      />
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-small font-semibold text-ink">{t("catalog.filterAccess")}</legend>
        <Checkbox label={t("access.wheelchair")} checked={value.wheelchair} onCheckedChange={(c) => onChange({ ...value, wheelchair: c })} />
        <Checkbox label={t("access.lift")} checked={value.lift} onCheckedChange={(c) => onChange({ ...value, lift: c })} />
        <Checkbox label={t("access.stepFree")} checked={value.stepFree} onCheckedChange={(c) => onChange({ ...value, stepFree: c })} />
        <Checkbox label={t("access.toilet")} checked={value.toilet} onCheckedChange={(c) => onChange({ ...value, toilet: c })} />
        <Checkbox label={t("access.parking")} checked={value.parking} onCheckedChange={(c) => onChange({ ...value, parking: c })} />
        <p className="mt-1 text-small text-muted">{t("access.asStated")}</p>
      </fieldset>
      <div className="flex flex-col gap-1">
        <ChipGroup legend={t("filters.menus")} options={DIET_TAGS} label={(o) => t(DIET_KEYS[o as DietTag])} value={value.menus} onChange={(menus) => onChange({ ...value, menus })} />
        <p className="text-small text-muted">{t("filters.menusHint")}</p>
      </div>
      <ChipGroup legend={t("catalog.filterStyle")} options={STYLE_TAGS} label={label} value={value.styles} onChange={(styles) => onChange({ ...value, styles })} />
      <ChipGroup legend={t("catalog.filterCulture")} options={CULTURE_TAGS} label={label} value={value.cultures} onChange={(cultures) => onChange({ ...value, cultures })} />
    </div>
  );
}

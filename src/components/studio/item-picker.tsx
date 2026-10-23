"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { StorageImage } from "@/components/photos/storage-image";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/provider";
import type { Unit } from "@/lib/inventory/model";
import { formatSGD } from "@/lib/money";
import type { VendorCatalog } from "@/lib/plans/estimates";
import { selectionKey } from "@/lib/plans/model";
import { matchesDiet } from "@/lib/venues/diet-filter";
import { DIET_KEYS, DIET_TAGS, type DietTag } from "@/lib/venues/inclusion";

const UNIT_KEYS = { piece: "unit.perPiece", table: "unit.perTable", guest: "unit.perGuest" } as const satisfies Record<Unit, string>;

/**
 * Only items vendors can really deliver: the venue's own decor, then each
 * decorator who works at this venue. A chosen package locks the items it
 * already includes, so nothing is charged twice.
 */
export function ItemPicker({
  catalogs,
  venueOwnerUid,
  selections,
  onChange,
}: {
  catalogs: VendorCatalog[];
  venueOwnerUid: string;
  selections: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const t = useT();
  const unitLabel = (u: Unit) => t(UNIT_KEYS[u]);
  // A browsing aid, not saved: chosen items stay chosen even if a filter would hide them.
  const [diet, setDiet] = useState<string[]>([]);
  const dietLabel = (o: string) => t(DIET_KEYS[o as DietTag]);
  const hasFood = catalogs.some((c) => c.items.some((i) => i.category === "Food and drink"));
  const hidden = catalogs.reduce((n, c) => n + c.items.filter((i) => !matchesDiet(i, diet) && selections[selectionKey("item", c.uid, i.id)] === undefined).length, 0);
  function toggle(key: string, on: boolean, includes: string[] = []) {
    const next = { ...selections };
    if (on) {
      next[key] = 1;
      includes.forEach((k) => delete next[k]);
    } else delete next[key];
    onChange(next);
  }

  const ordered = [...catalogs].sort((a, b) => (a.uid === venueOwnerUid ? -1 : b.uid === venueOwnerUid ? 1 : a.profile.businessName.localeCompare(b.profile.businessName)));

  return (
    <div className="flex flex-col gap-8">
      {hasFood && (
        <div className="flex flex-col gap-1">
          <ChipGroup legend={t("studio.dietaryFilter")} options={DIET_TAGS} label={dietLabel} value={diet} onChange={setDiet} />
          <p className="text-small text-muted" aria-live="polite">
            {hidden > 0 ? t("studio.dietaryHidden", { count: hidden }) : ""} {t("access.asStated")}
          </p>
        </div>
      )}
      {ordered.map((cat) => {
        const isVenue = cat.uid === venueOwnerUid;
        const chosenPackages = cat.packages.filter((p) => selections[selectionKey("package", cat.uid, p.id)] !== undefined);
        const lockedBy = (itemId: string) => chosenPackages.find((p) => p.itemIds.includes(itemId));
        if (cat.items.length === 0 && cat.packages.length === 0) return null;
        return (
          <fieldset key={cat.uid} className="flex flex-col gap-2">
            <legend className="mb-2 flex flex-col">
              <span className="font-display text-h3">{cat.profile.businessName}</span>
              <span className="text-small text-muted">{isVenue ? t("studio.venueOwnDecor") : t("studio.decoratorAtVenue")}</span>
            </legend>
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cat.items.map((i) => {
                const key = selectionKey("item", cat.uid, i.id);
                const pkg = lockedBy(i.id);
                const on = selections[key] !== undefined;
                if (!on && !matchesDiet(i, diet)) return null;
                const tags = i.dietaryTags ?? [];
                return (
                  // The photo leads the card, large enough to show what guests will see.
                  <li key={i.id} className={cn("flex flex-col overflow-hidden rounded-xl border bg-surface", on ? "border-accent ring-2 ring-accent" : "border-line")}>
                    {i.photo ? (
                      <StorageImage photo={i.photo} alt="" aspect="3 / 2" sizes="(min-width: 48rem) 50vw, 100vw" />
                    ) : (
                      <div className="flex items-center justify-center bg-subtle text-muted" style={{ aspectRatio: "3 / 2" }}>
                        <ImageOff aria-hidden className="size-6" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-3">
                      <Checkbox
                        label={i.name}
                        description={
                          pkg
                            ? t("studio.includedIn", { package: pkg.name })
                            : t(i.photo ? "studio.priceUnit" : "studio.priceUnitNoRender", { price: formatSGD(i.priceCents), unit: unitLabel(i.unit) })
                        }
                        checked={on || !!pkg}
                        disabled={!!pkg}
                        onCheckedChange={(c) => toggle(key, c)}
                      />
                      {tags.length > 0 && (
                        <ul className="ml-9 flex flex-wrap gap-1" aria-label={t("studio.dietaryFilter")}>
                          {tags.map((tag) => (
                            <li key={tag} className="rounded-full bg-subtle px-2 py-0.5 text-small">
                              {dietLabel(tag)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {on && i.unit === "piece" && (
                        <Input
                          label={t("studio.howMany", { item: i.name })}
                          inputMode="numeric"
                          className="num w-40"
                          value={String(selections[key])}
                          onChange={(e) => {
                            const n = Math.min(999, Number(e.target.value.replace(/\D/g, "") || "0"));
                            onChange({ ...selections, [key]: n });
                          }}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
              {cat.packages.map((p) => {
                const key = selectionKey("package", cat.uid, p.id);
                const includes = p.itemIds.map((id) => selectionKey("item", cat.uid, id));
                const names = p.itemIds.map((id) => cat.items.find((i) => i.id === id)?.name).filter(Boolean);
                return (
                  <li key={p.id} className="rounded-xl border border-gold bg-surface p-3">
                    <Checkbox
                      label={t("studio.packageName", { name: p.name })}
                      description={t("studio.packageDesc", { price: formatSGD(p.priceCents), unit: unitLabel(p.unit), items: names.join(", ") || t("studio.items") })}
                      checked={selections[key] !== undefined}
                      onCheckedChange={(c) => toggle(key, c, includes)}
                    />
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}

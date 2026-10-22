"use client";

import { ImageOff } from "lucide-react";
import { StorageImage } from "@/components/photos/storage-image";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { UNIT_LABELS } from "@/lib/inventory/model";
import { formatSGD } from "@/lib/money";
import type { VendorCatalog } from "@/lib/plans/estimates";
import { selectionKey } from "@/lib/plans/model";

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
      {ordered.map((cat) => {
        const isVenue = cat.uid === venueOwnerUid;
        const chosenPackages = cat.packages.filter((p) => selections[selectionKey("package", cat.uid, p.id)] !== undefined);
        const lockedBy = (itemId: string) => chosenPackages.find((p) => p.itemIds.includes(itemId));
        if (cat.items.length === 0 && cat.packages.length === 0) return null;
        return (
          <fieldset key={cat.uid} className="flex flex-col gap-2">
            <legend className="mb-2 flex flex-col">
              <span className="font-display text-h3">{cat.profile.businessName}</span>
              <span className="text-small text-muted">{isVenue ? "The venue's own decor" : "Decorator who works at this venue"}</span>
            </legend>
            <ul className="grid gap-3 md:grid-cols-2">
              {cat.items.map((i) => {
                const key = selectionKey("item", cat.uid, i.id);
                const pkg = lockedBy(i.id);
                const on = selections[key] !== undefined;
                return (
                  <li key={i.id} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
                    <div className="w-20 shrink-0">
                      {i.photo ? (
                        <StorageImage photo={i.photo} alt="" aspect="4 / 3" className="rounded-lg" sizes="80px" />
                      ) : (
                        <div className="flex items-center justify-center rounded-lg bg-subtle text-muted" style={{ aspectRatio: "4 / 3" }}>
                          <ImageOff aria-hidden className="size-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col">
                      <Checkbox
                        label={i.name}
                        description={pkg ? `Included in ${pkg.name}` : `${formatSGD(i.priceCents)} ${UNIT_LABELS[i.unit]}${i.photo ? "" : " · not shown in renders"}`}
                        checked={on || !!pkg}
                        disabled={!!pkg}
                        onCheckedChange={(c) => toggle(key, c)}
                      />
                      {on && i.unit === "piece" && (
                        <Input
                          label={`How many: ${i.name}`}
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
                      label={`${p.name} (package)`}
                      description={`${formatSGD(p.priceCents)} ${UNIT_LABELS[p.unit]} · includes ${names.join(", ") || "items"}`}
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

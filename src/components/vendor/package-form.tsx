"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PackageInput } from "@/lib/data/vendors";
import type { WithId } from "@/lib/data/venues";
import { INVENTORY_LIMITS, UNIT_LABELS, type InventoryItem, type Unit } from "@/lib/inventory/model";
import { validatePackage, type Errors } from "@/lib/inventory/validation";
import { centsToInput, formatSGD, parseDollarsToCents } from "@/lib/money";
import { UnitPicker } from "./unit-picker";

export function PackageForm({
  items,
  initial,
  submitLabel,
  onSave,
  onCancel,
}: {
  items: WithId<InventoryItem>[];
  initial?: PackageInput;
  submitLabel: string;
  onSave: (input: PackageInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? "table");
  const [price, setPrice] = useState(initial ? centsToInput(initial.priceCents) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  // Drop ids of items that were deleted since.
  const [itemIds, setItemIds] = useState<string[]>((initial?.itemIds ?? []).filter((x) => items.some((i) => i.id === x)));
  const [active, setActive] = useState(initial?.active ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const input: PackageInput = {
      name: name.trim(),
      unit,
      priceCents: parseDollarsToCents(price) ?? Number.NaN,
      description: description.trim(),
      itemIds,
      active,
    };
    const e = validatePackage(input);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await onSave(input);
    } catch {
      setErrors({ form: "We couldn't save this package. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Input label="Package name" placeholder="For example, Garden romance" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={INVENTORY_LIMITS.nameMax} />
      <fieldset className="flex flex-col" aria-describedby={errors.itemIds ? `${id}-items-error` : undefined}>
        <legend className="mb-1 text-small font-semibold text-ink">What&apos;s included</legend>
        <p className="mb-2 text-small text-muted">Couples can&apos;t add these items separately while the package is selected, so nothing is charged twice.</p>
        {items.length === 0 && <p className="text-small text-muted">Add items to your inventory first.</p>}
        {items.map((i) => (
          <Checkbox
            key={i.id}
            label={i.name}
            description={`${formatSGD(i.priceCents)} ${UNIT_LABELS[i.unit]} on its own`}
            checked={itemIds.includes(i.id)}
            onCheckedChange={(c) => setItemIds((prev) => (c ? [...prev, i.id] : prev.filter((x) => x !== i.id)))}
          />
        ))}
        {errors.itemIds && (
          <p id={`${id}-items-error`} className="text-small font-medium text-error">
            {errors.itemIds}
          </p>
        )}
      </fieldset>
      <UnitPicker value={unit} onChange={setUnit} name={`${id}-unit`} />
      <Input label="Package price" prefix="S$" inputMode="decimal" className="num md:max-w-xs" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.priceCents} />
      <Textarea label="Description" hint="Optional." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={INVENTORY_LIMITS.descriptionMax} error={errors.description} />
      <Checkbox label="Available to couples" checked={active} onCheckedChange={setActive} />
      {errors.form && (
        <p role="alert" className="text-small font-medium text-error">
          {errors.form}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" loading={busy}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

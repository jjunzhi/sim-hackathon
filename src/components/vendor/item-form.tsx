"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ItemInput } from "@/lib/data/vendors";
import { CATEGORIES, INVENTORY_LIMITS, type Category, type Unit } from "@/lib/inventory/model";
import { validateItem, type Errors } from "@/lib/inventory/validation";
import { centsToInput, parseDollarsToCents } from "@/lib/money";
import { DIET_TAGS } from "@/lib/venues/inclusion";
import { UnitPicker } from "./unit-picker";

const DIET_LABELS: Record<string, string> = { halal: "Halal", vegetarian: "Vegetarian", vegan: "Vegan", "no-beef": "No beef", "no-pork": "No pork" };

export function ItemForm({
  initial,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial?: ItemInput;
  submitLabel: string;
  onSave: (input: ItemInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "Florals");
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? "piece");
  const [price, setPrice] = useState(initial ? centsToInput(initial.priceCents) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [dietaryTags, setDietaryTags] = useState<string[]>(initial?.dietaryTags ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const input: ItemInput = {
      name: name.trim(),
      category,
      unit,
      priceCents: parseDollarsToCents(price) ?? Number.NaN,
      description: description.trim(),
      active,
      // Dietary tags only mean something on food; drop them if the category changes away.
      dietaryTags: category === "Food and drink" ? dietaryTags : [],
    };
    const e = validateItem(input);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await onSave(input);
    } catch {
      setErrors({ form: "We couldn't save this item. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Item name" placeholder="For example, Peony arch" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={INVENTORY_LIMITS.nameMax} />
        <Select label="Category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} value={category} onValueChange={(v) => setCategory(v as Category)} />
      </div>
      <UnitPicker value={unit} onChange={setUnit} name={`${id}-unit`} />
      <Input label="Price" prefix="S$" inputMode="decimal" className="num md:max-w-xs" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.priceCents} />
      {category === "Food and drink" && (
        <div className="flex flex-col gap-2">
          <ChipGroup legend="Dietary" options={DIET_TAGS} label={(o) => DIET_LABELS[o] ?? o} value={dietaryTags} onChange={setDietaryTags} />
          <p className="text-small text-muted">Shown to couples as your statement, and used in their filters.</p>
        </div>
      )}
      <Textarea label="Description" hint="Optional. Size, colours, what's included." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={INVENTORY_LIMITS.descriptionMax} error={errors.description} />
      <Checkbox label="Available to couples" description="Turn off to hide it without deleting it." checked={active} onCheckedChange={setActive} />
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

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { VenueProfileInput } from "@/lib/data/venues";
import { DIET_TAGS } from "@/lib/venues/inclusion";
import { CULTURE_TAGS, LIMITS, STYLE_TAGS } from "@/lib/venues/model";
import { hasErrors, validateVenueProfile, type Errors } from "@/lib/venues/validation";

export const emptyVenueProfile: VenueProfileInput = {
  name: "",
  address: "",
  postalCode: "",
  description: "",
  styleTags: [],
  cultureTags: [],
  wheelchairAccess: false,
  liftAccess: false,
  stepFreeEntrance: false,
  accessibleToilet: false,
  accessibleParking: false,
  menuOptions: [],
};

/** Only the fields this form edits (never ownerUid, verified, status, timestamps). Venues from before Phase 6 lack the new fields. */
export function pickProfile(v: VenueProfileInput): VenueProfileInput {
  return {
    name: v.name,
    address: v.address,
    postalCode: v.postalCode,
    description: v.description,
    styleTags: v.styleTags,
    cultureTags: v.cultureTags,
    wheelchairAccess: v.wheelchairAccess,
    liftAccess: v.liftAccess,
    stepFreeEntrance: v.stepFreeEntrance ?? false,
    accessibleToilet: v.accessibleToilet ?? false,
    accessibleParking: v.accessibleParking ?? false,
    menuOptions: v.menuOptions ?? [],
  };
}

const DIET_LABELS: Record<string, string> = { halal: "Halal", vegetarian: "Vegetarian", vegan: "Vegan", "no-beef": "No beef", "no-pork": "No pork" };

export function VenueDetailsForm({
  initial,
  onSave,
  submitLabel,
}: {
  initial: VenueProfileInput;
  onSave: (values: VenueProfileInput) => Promise<void>;
  submitLabel: string;
}) {
  const [v, setV] = useState(() => pickProfile(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const set = <K extends keyof VenueProfileInput>(k: K, value: VenueProfileInput[K]) => setV((prev) => ({ ...prev, [k]: value }));

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const values = { ...v, name: v.name.trim(), address: v.address.trim(), postalCode: v.postalCode.trim() };
    const e = validateVenueProfile(values);
    setErrors(e);
    if (hasErrors(e)) return;
    setBusy(true);
    setFormError(null);
    try {
      await onSave(values);
    } catch {
      setFormError("We couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Input label="Venue name" value={v.name} onChange={(e) => set("name", e.target.value)} error={errors.name} maxLength={LIMITS.nameMax} autoComplete="organization" />
      <div className="grid gap-6 md:grid-cols-[1fr_12rem]">
        <Input label="Address" value={v.address} onChange={(e) => set("address", e.target.value)} error={errors.address} autoComplete="street-address" />
        <Input
          label="Postal code"
          inputMode="numeric"
          value={v.postalCode}
          onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 6))}
          error={errors.postalCode}
          autoComplete="postal-code"
          className="num"
        />
      </div>
      <Textarea
        label="Description"
        hint="What makes the venue special? Couples read this first."
        value={v.description}
        onChange={(e) => set("description", e.target.value)}
        maxLength={LIMITS.descriptionMax}
        error={errors.description}
      />
      <ChipGroup legend="Style" options={STYLE_TAGS} value={v.styleTags} onChange={(t) => set("styleTags", t)} />
      <ChipGroup legend="Culture and traditions you host" options={CULTURE_TAGS} value={v.cultureTags} onChange={(t) => set("cultureTags", t)} />
      {errors.tags && <p className="text-small text-error">{errors.tags}</p>}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-small font-semibold text-ink">Access</legend>
        <Checkbox label="Wheelchair access" description="Step-free from the entrance to the event space and toilets." checked={v.wheelchairAccess} onCheckedChange={(c) => set("wheelchairAccess", c)} />
        <Checkbox label="Lift access" checked={v.liftAccess} onCheckedChange={(c) => set("liftAccess", c)} />
        <Checkbox label="Step-free entrance" description="No steps between the street or drop-off point and the door." checked={v.stepFreeEntrance} onCheckedChange={(c) => set("stepFreeEntrance", c)} />
        <Checkbox label="Accessible toilet" checked={v.accessibleToilet} onCheckedChange={(c) => set("accessibleToilet", c)} />
        <Checkbox label="Accessible parking" checked={v.accessibleParking} onCheckedChange={(c) => set("accessibleParking", c)} />
        <p className="mt-1 text-small text-muted">Couples filter by these, so tick only what is really in place. They are shown as your statement.</p>
      </fieldset>
      <ChipGroup
        legend="Menus you can cater for"
        options={DIET_TAGS}
        label={(o) => DIET_LABELS[o] ?? o}
        value={v.menuOptions}
        onChange={(m) => set("menuOptions", m)}
      />
      <p className="-mt-3 text-small text-muted">Shown to couples as your statement. If your kitchen or caterer is halal-certified, couples can check the certificate on the MUIS halal search.</p>
      {formError && (
        <p role="alert" className="text-small font-medium text-error">
          {formError}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" loading={busy} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}

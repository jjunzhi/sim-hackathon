"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tablesLine } from "@/lib/capacity";
import { cn } from "@/lib/cn";
import type { SpaceInput } from "@/lib/data/venues";
import { centsToInput, parseDollarsToCents } from "@/lib/money";
import { isTiered, type Tier, type Tiers } from "@/lib/venues/model";
import { hasErrors, validateSpace, type Errors } from "@/lib/venues/validation";

type TierText = { rental: string; minimum: string };
type Mode = "standard" | "tiered";

const tierToText = (t: Tier | undefined): TierText => ({
  rental: t ? centsToInput(t.roomRentalCents) : "",
  minimum: t ? centsToInput(t.minimumSpendCents) : "",
});

/** Unparseable text becomes NaN so validation reports it. */
function textToTier(t: TierText): Tier {
  return {
    roomRentalCents: parseDollarsToCents(t.rental) ?? Number.NaN,
    minimumSpendCents: t.minimum.trim() === "" ? null : (parseDollarsToCents(t.minimum) ?? Number.NaN),
  };
}

const toInt = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : Number.NaN);

export function SpaceForm({
  initial,
  sortOrder,
  onSave,
  onCancel,
  submitLabel,
}: {
  initial?: SpaceInput;
  sortOrder: number;
  onSave: (input: SpaceInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [min, setMin] = useState(initial ? String(initial.capacityMin) : "");
  const [max, setMax] = useState(initial ? String(initial.capacityMax) : "");
  const [seats, setSeats] = useState(String(initial?.seatsPerTable ?? 10));
  const [mode, setMode] = useState<Mode>(initial && isTiered(initial.tiers) ? "tiered" : "standard");
  const t = initial?.tiers;
  const [standard, setStandard] = useState<TierText>(tierToText(t && !isTiered(t) ? t.standard : undefined));
  const [peak, setPeak] = useState<TierText>(tierToText(t && isTiered(t) ? t.peak : undefined));
  const [offPeak, setOffPeak] = useState<TierText>(tierToText(t && isTiered(t) ? t.offPeak : undefined));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const maxNum = toInt(max);
  const seatsNum = toInt(seats);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const tiers: Tiers = mode === "tiered" ? { peak: textToTier(peak), offPeak: textToTier(offPeak) } : { standard: textToTier(standard) };
    const input: SpaceInput = {
      name: name.trim(),
      capacityMin: toInt(min),
      capacityMax: toInt(max),
      seatsPerTable: toInt(seats),
      tiers,
      sortOrder,
    };
    const e = validateSpace(input);
    setErrors(e);
    if (hasErrors(e)) return;
    setBusy(true);
    setFormError(null);
    try {
      await onSave(input);
    } catch {
      setFormError("We couldn't save this space. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Input label="Space name" placeholder="For example, Grand Ballroom" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-small font-semibold text-ink">Guests</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Input label="Minimum" inputMode="numeric" className="num" value={min} onChange={(e) => setMin(e.target.value)} error={errors.capacityMin} />
          <Input label="Maximum" inputMode="numeric" className="num" value={max} onChange={(e) => setMax(e.target.value)} error={errors.capacityMax} />
          <Input label="Seats per table" inputMode="numeric" className="num col-span-2 sm:col-span-1" value={seats} onChange={(e) => setSeats(e.target.value)} error={errors.seatsPerTable} />
        </div>
        {Number.isSafeInteger(maxNum) && maxNum > 0 && Number.isSafeInteger(seatsNum) && seatsNum > 0 && (
          <p className="num text-small text-muted">At full capacity: {tablesLine(maxNum, seatsNum)}</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-small font-semibold text-ink">Room rental</legend>
        <div role="radiogroup" aria-label="Pricing" className="inline-flex w-fit rounded-full border border-line-strong bg-surface p-1">
          {(
            [
              ["standard", "One price"],
              ["tiered", "Peak and Off-Peak"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-small font-semibold transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                mode === value ? "bg-ink text-bg" : "text-muted hover:text-ink",
              )}
            >
              <input type="radio" name="pricing-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
        {mode === "standard" ? (
          <TierFields value={standard} onChange={setStandard} errors={errors} prefix="standard" />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <TierFields title="Peak" value={peak} onChange={setPeak} errors={errors} prefix="peak" />
            <TierFields title="Off-Peak" value={offPeak} onChange={setOffPeak} errors={errors} prefix="offPeak" />
          </div>
        )}
        <p className="text-small text-muted">
          Minimum spend is optional. If an estimate falls below it, couples see the shortfall as its own line.
        </p>
      </fieldset>

      {formError && (
        <p role="alert" className="text-small font-medium text-error">
          {formError}
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

function TierFields({
  title,
  value,
  onChange,
  errors,
  prefix,
}: {
  title?: string;
  value: TierText;
  onChange: (t: TierText) => void;
  errors: Errors;
  prefix: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {title && <p className="font-semibold text-ink">{title}</p>}
      <Input
        label={title ? `${title} room rental` : "Room rental"}
        prefix="S$"
        inputMode="decimal"
        className="num"
        value={value.rental}
        onChange={(e) => onChange({ ...value, rental: e.target.value })}
        error={errors[`${prefix}.roomRentalCents`]}
      />
      <Input
        label={title ? `${title} minimum spend (optional)` : "Minimum spend (optional)"}
        prefix="S$"
        inputMode="decimal"
        className="num"
        value={value.minimum}
        onChange={(e) => onChange({ ...value, minimum: e.target.value })}
        error={errors[`${prefix}.minimumSpendCents`]}
      />
    </div>
  );
}

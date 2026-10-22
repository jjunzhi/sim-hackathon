"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { updateVenue } from "@/lib/data/venues";
import { formatBps, type Bps } from "@/lib/money";
import { LIMITS, type TaxSettings } from "@/lib/venues/model";

function Choice({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: Bps;
  onChange: (v: Bps) => void;
  options: Array<{ value: Bps; label: string; description: string }>;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-small font-semibold text-ink">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl border p-4 transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              value === o.value ? "border-accent bg-accent-tint" : "border-line-strong bg-surface hover:bg-subtle",
            )}
          >
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            <span className="font-semibold text-ink">{o.label}</span>
            <span className="text-small text-muted">{o.description}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TaxForm({ venueId, initial }: { venueId: string; initial: TaxSettings }) {
  const [tax, setTax] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateVenue(venueId, { tax: { ...tax, noGstNote: tax.noGstNote.trim(), noServiceChargeNote: tax.noServiceChargeNote.trim() } });
      toast({ title: "Tax settings saved", tone: "success" });
    } catch {
      setError("We couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-8">
      <Choice
        legend="Service charge"
        name="service-charge"
        value={tax.serviceChargeBps}
        onChange={(v) => setTax({ ...tax, serviceChargeBps: v })}
        options={[
          { value: 1000, label: `Charge ${formatBps(1000)}`, description: "Added before GST on every estimate." },
          { value: 0, label: "No service charge", description: "The line is hidden on estimates." },
        ]}
      />
      {tax.serviceChargeBps === 0 && (
        <Input
          label="Note shown instead"
          value={tax.noServiceChargeNote}
          maxLength={LIMITS.noteMax}
          onChange={(e) => setTax({ ...tax, noServiceChargeNote: e.target.value })}
          hint="Leave empty to show nothing."
        />
      )}
      <Choice
        legend="GST"
        name="gst"
        value={tax.gstBps}
        onChange={(v) => setTax({ ...tax, gstBps: v })}
        options={[
          { value: 900, label: `GST-registered (${formatBps(900)})`, description: "GST is added after the service charge." },
          { value: 0, label: "Not GST-registered", description: "The GST line is hidden on estimates." },
        ]}
      />
      {tax.gstBps === 0 && (
        <Input
          label="Note shown instead"
          value={tax.noGstNote}
          maxLength={LIMITS.noteMax}
          onChange={(e) => setTax({ ...tax, noGstNote: e.target.value })}
          hint="Check this wording is right for your business."
        />
      )}
      {error && (
        <p role="alert" className="text-small font-medium text-error">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={busy} className="self-start">
        Save tax settings
      </Button>
    </form>
  );
}

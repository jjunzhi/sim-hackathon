"use client";

import { Building2, Flower2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import type { BusinessInput } from "@/lib/data/vendors";
import { VENDOR_LIMITS, type VendorKind } from "@/lib/vendors/model";

const KINDS: Array<{ value: VendorKind; title: string; body: string; icon: React.ReactNode }> = [
  { value: "venue", title: "Venue", body: "You rent out spaces for weddings.", icon: <Building2 aria-hidden className="size-5" /> },
  { value: "decorator", title: "Decorator", body: "You supply decor, florals, lighting or styling.", icon: <Flower2 aria-hidden className="size-5" /> },
];

export function BusinessFields({
  value,
  onChange,
  errors,
}: {
  value: BusinessInput;
  onChange: (v: BusinessInput) => void;
  errors: Partial<Record<string, string>>;
}) {
  function toggle(kind: VendorKind) {
    const kinds = value.kinds.includes(kind) ? value.kinds.filter((k) => k !== kind) : [...value.kinds, kind];
    onChange({ ...value, kinds });
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3" aria-describedby={errors.kinds ? "kinds-error" : undefined}>
        <legend className="mb-1 text-small font-semibold text-ink">What does your business do? Choose one or both.</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {KINDS.map((k) => {
            const on = value.kinds.includes(k.value);
            return (
              <label
                key={k.value}
                className={cn(
                  "flex min-h-11 cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  on ? "border-accent bg-accent-tint" : "border-line-strong bg-surface hover:bg-subtle",
                )}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(k.value)} className="sr-only" />
                <span className={cn("mt-0.5", on ? "text-accent-text" : "text-muted")}>{k.icon}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold text-ink">{k.title}</span>
                  <span className="text-small text-muted">{k.body}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.kinds && (
          <p id="kinds-error" className="text-small font-medium text-error">
            {errors.kinds}
          </p>
        )}
      </fieldset>
      <Input
        label="Business name"
        value={value.businessName}
        maxLength={VENDOR_LIMITS.businessNameMax}
        onChange={(e) => onChange({ ...value, businessName: e.target.value })}
        error={errors.businessName}
        autoComplete="organization"
      />
      <Textarea
        label="About your business"
        hint="Optional. Couples see this next to your items."
        value={value.description}
        maxLength={VENDOR_LIMITS.descriptionMax}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        error={errors.description}
      />
    </div>
  );
}

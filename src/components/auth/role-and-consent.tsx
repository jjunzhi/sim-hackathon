"use client";

import { Heart, Store } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/data/users";
import { CONSENT_IS_DRAFT, consentCopy } from "@/lib/legal";

const ROLES: Array<{ value: Role; title: string; body: string; icon: React.ReactNode }> = [
  {
    value: "couple",
    title: "We're planning a wedding",
    body: "Compare venues, see decorated rooms and share options with family.",
    icon: <Heart aria-hidden className="size-5" />,
  },
  {
    value: "vendor",
    title: "I'm a vendor",
    body: "List your venue, spaces and prices, and receive enquiries.",
    icon: <Store aria-hidden className="size-5" />,
  },
];

export function RolePicker({ value, onChange, error }: { value: Role | null; onChange: (r: Role) => void; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={error ? "role-error" : "role-hint"}>
      <legend className="mb-1 text-small font-semibold text-ink">How will you use WeddingVista?</legend>
      <p id="role-hint" className="-mt-1 text-small text-muted">
        This can&apos;t be changed later.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ROLES.map((r) => {
          const checked = value === r.value;
          return (
            <label
              key={r.value}
              className={cn(
                "relative flex min-h-11 cursor-pointer gap-3 rounded-xl border bg-surface p-4 transition-colors duration-150",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                checked ? "border-accent bg-accent-tint" : "border-line-strong hover:bg-subtle",
              )}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={checked}
                onChange={() => onChange(r.value)}
                className="sr-only"
              />
              <span className={cn("mt-0.5", checked ? "text-accent-text" : "text-muted")}>{r.icon}</span>
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold text-ink">{r.title}</span>
                <span className="text-small text-muted">{r.body}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id="role-error" className="text-small font-medium text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function ConsentField({ checked, onChange, error }: { checked: boolean; onChange: (c: boolean) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-subtle p-4">
      <p className="text-small text-ink">{consentCopy.summary}</p>
      {CONSENT_IS_DRAFT && <p className="text-small font-semibold text-warning">{consentCopy.draftNotice}</p>}
      <Checkbox label={consentCopy.label} checked={checked} onCheckedChange={onChange} />
      {error && <p className="text-small font-medium text-error">{error}</p>}
    </div>
  );
}

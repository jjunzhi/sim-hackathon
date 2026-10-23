"use client";

import { Heart, Store } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/data/users";
import { useT } from "@/lib/i18n/provider";

export function RolePicker({ value, onChange, error }: { value: Role | null; onChange: (r: Role) => void; error?: string }) {
  const t = useT();
  const roles: Array<{ value: Role; title: string; body: string; icon: React.ReactNode }> = [
    {
      value: "couple",
      title: t("auth.role.coupleTitle"),
      body: t("auth.role.coupleBody"),
      icon: <Heart aria-hidden className="size-5" />,
    },
    {
      value: "vendor",
      title: t("auth.role.vendorTitle"),
      body: t("auth.role.vendorBody"),
      icon: <Store aria-hidden className="size-5" />,
    },
  ];
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={error ? "role-error" : "role-hint"}>
      <legend className="mb-1 text-small font-semibold text-ink">{t("auth.role.legend")}</legend>
      <p id="role-hint" className="-mt-1 text-small text-muted">
        {t("auth.role.hint")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {roles.map((r) => {
          const checked = value === r.value;
          return (
            <label
              key={r.value}
              className={cn(
                "relative flex min-h-11 cursor-pointer gap-3 rounded-xl border bg-surface p-4 transition-colors duration-150",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                checked ? "border-accent bg-accent-tint ring-2 ring-accent" : "border-line-strong hover:bg-subtle",
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

/** Consent wording is in the dictionary (auth.consent.*); its version is CONSENT_VERSION in src/lib/legal.ts. */
export function ConsentField({ checked, onChange, error }: { checked: boolean; onChange: (c: boolean) => void; error?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-subtle p-4">
      <p className="text-small text-ink">
        {t("auth.consent.summary")}{" "}
        <a href="/privacy" target="_blank" rel="noopener" className="font-semibold text-accent-text underline underline-offset-4">
          {t("auth.consent.privacyLink")}
        </a>
      </p>
      <Checkbox label={t("auth.consent.label")} checked={checked} onCheckedChange={onChange} />
      {error && <p className="text-small font-medium text-error">{error}</p>}
    </div>
  );
}

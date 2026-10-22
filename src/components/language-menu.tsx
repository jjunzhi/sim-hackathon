"use client";

import { DropdownMenu } from "radix-ui";
import { Check, Languages } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/cn";
import { setProfileLocale } from "@/lib/data/users";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { readStoredLocale, useLocale } from "@/lib/i18n/provider";

/**
 * Language switcher for couple and family screens. Each language is listed in
 * itself, so a reader can always find their own. Signed-in couples also keep
 * the choice on their profile so it follows them to another device.
 */
export function LanguageMenu({ className, withAuth = true }: { className?: string; withAuth?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const current = LOCALES.find((l) => l.code === locale)!;
  const choose = (next: Locale) => setLocale(next);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`${t("lang.menu")}: ${current.label}`}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-small font-semibold text-muted transition-colors hover:text-ink",
          className,
        )}
      >
        <Languages aria-hidden className="size-4" />
        {/* Icon only on phones so the header fits at 390px; the trigger keeps its accessible name. */}
        <span lang={current.lang} className="hidden sm:inline">
          {current.label}
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-lift">
          <DropdownMenu.RadioGroup value={locale} onValueChange={(v) => choose(v as Locale)}>
            {LOCALES.map((l) => (
              <DropdownMenu.RadioItem
                key={l.code}
                value={l.code}
                lang={l.lang}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-ink outline-none data-[highlighted]:bg-subtle"
              >
                {l.label}
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden className="size-4 text-accent-text" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
      {withAuth && <ProfileSync />}
    </DropdownMenu.Root>
  );
}

/**
 * Keeps users/{uid}.locale and the local choice in step. A profile language
 * wins on a device where nothing was chosen yet; otherwise the device's choice
 * is written to the profile. Renders nothing.
 */
function ProfileSync() {
  const auth = useAuth();
  const { locale, setLocale } = useLocale();
  const uid = auth.status === "ready" ? auth.user.uid : null;
  const onProfile = auth.status === "ready" ? (auth.profile.locale ?? null) : null;
  useEffect(() => {
    if (!uid) return;
    if (onProfile && onProfile !== locale && !readStoredLocale()) setLocale(onProfile);
    else if (onProfile !== locale) void setProfileLocale(uid, locale).catch(() => undefined);
  }, [uid, onProfile, locale, setLocale]);
  return null;
}

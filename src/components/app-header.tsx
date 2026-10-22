"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutList, LogIn, LogOut, MapPinned, UserRound, Users } from "lucide-react";
import { LanguageMenu } from "@/components/language-menu";
import { TranslationNote } from "@/components/translation-note";
import { signOut, useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";

const isActive = (pathname: string, href: string) => pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

export function AppHeader() {
  const t = useT();
  const auth = useAuth();
  const pathname = usePathname();
  const role = auth.status === "ready" ? auth.profile.role : null;
  const signedOut = auth.status === "signed-out";

  const coupleLinks = [
    { href: "/venues", label: t("nav.venues"), icon: MapPinned },
    { href: "/plans", label: t("nav.plans"), icon: LayoutList },
    { href: "/guests", label: t("nav.guests"), icon: Users },
    { href: "/checklists", label: t("nav.checklists"), icon: ClipboardList },
    signedOut
      ? { href: `/sign-in?next=${encodeURIComponent(pathname)}`, label: t("nav.signIn"), icon: LogIn }
      : { href: "/account", label: t("nav.account"), icon: UserRound },
  ];
  // On phones vendor "Account" shrinks to an icon (label kept for screen readers) so the bar fits at 390px.
  const vendorLinks = [
    { href: "/vendor", label: t("ui.header.vendorHome"), icon: null },
    { href: "/account", label: t("nav.account"), icon: UserRound },
  ];

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="container-page flex min-h-16 items-center justify-between gap-4">
          <Link href={role === "vendor" ? "/vendor" : "/"} className="shrink-0 whitespace-nowrap font-display text-h3 text-ink">
            WeddingVista
            {role === "vendor" && <span className="ml-2 hidden align-middle font-sans text-small font-semibold text-muted md:inline">{t("ui.header.forVendors")}</span>}
          </Link>
          {role === "vendor" ? (
            <nav aria-label={t("nav.main")} className="flex items-center gap-1">
              {vendorLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(pathname, href) ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-full px-3 text-small font-semibold transition-colors",
                    isActive(pathname, href) ? "bg-accent-tint text-accent-text" : "text-muted hover:text-ink",
                  )}
                >
                  {Icon && <Icon aria-hidden className="size-4 sm:hidden" />}
                  <span className={Icon ? "sr-only sm:not-sr-only" : undefined}>{label}</span>
                </Link>
              ))}
              <SignOutButton />
            </nav>
          ) : (
            // The language menu sits outside the nav so it stays in the top bar on phones, where the links move to the bottom bar.
            <div className="flex items-center gap-1">
              <nav aria-label={t("nav.main")} className="hidden items-center gap-1 sm:flex">
                {coupleLinks.map(({ href, label }) => (
                  <Link
                    key={label}
                    href={href}
                    aria-current={isActive(pathname, href) ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-small font-semibold transition-colors",
                      isActive(pathname, href) ? "bg-accent-tint text-accent-text" : "text-muted hover:text-ink",
                    )}
                  >
                    {label}
                  </Link>
                ))}
                {role && <SignOutButton />}
              </nav>
              <LanguageMenu />
            </div>
          )}
        </div>
      </header>
      <TranslationNote />

      {role !== "vendor" && (
        // Bottom navigation on phones: thumb-reachable, never scrolls sideways.
        <nav
          aria-label={t("nav.main")}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
          <ul className="grid grid-cols-5">
            {coupleLinks.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href.split("?")[0]!);
              return (
                <li key={label} className="min-w-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      // Five slots at 390px: labels may wrap between words (Malay runs long); Tamil gets slightly smaller type in globals.css.
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-center text-[0.75rem] font-semibold leading-tight",
                      active ? "text-accent-text" : "text-muted",
                    )}
                  >
                    <Icon aria-hidden className="size-5 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}

function SignOutButton() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => signOut("/")}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-small font-semibold text-muted hover:text-ink"
    >
      <LogOut aria-hidden className="size-4" />
      <span className="sr-only sm:not-sr-only">{t("nav.signOut")}</span>
    </button>
  );
}

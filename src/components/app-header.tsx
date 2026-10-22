"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { signOut, useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/cn";

export function AppHeader() {
  const auth = useAuth();
  const pathname = usePathname();
  const role = auth.status === "ready" ? auth.profile.role : null;

  // On phones "Account" shrinks to an icon (label kept for screen readers) so the bar fits at 390px.
  const links: Array<{ href: string; label: string; icon?: React.ReactNode }> = [
    ...(role === "vendor" ? [{ href: "/vendor", label: "Vendor home" }] : []),
    { href: "/account", label: "Account", icon: <UserRound aria-hidden className="size-4 sm:hidden" /> },
  ];

  return (
    <header className="border-b border-line bg-surface">
      <div className="container-page flex min-h-16 items-center justify-between gap-4">
        <Link href={role === "vendor" ? "/vendor" : "/"} className="shrink-0 whitespace-nowrap font-display text-h3 text-ink">
          WeddingVista
          {role === "vendor" && (
            <span className="ml-2 hidden align-middle font-sans text-small font-semibold text-muted md:inline">for vendors</span>
          )}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href + "/"));
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-full px-3 text-small font-semibold transition-colors",
                  active ? "bg-accent-tint text-accent-text" : "text-muted hover:text-ink",
                )}
              >
                {l.icon}
                <span className={l.icon ? "sr-only sm:not-sr-only" : undefined}>{l.label}</span>
              </Link>
            );
          })}
          {role && (
            <button
              type="button"
              onClick={() => signOut("/")}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-small font-semibold text-muted hover:text-ink"
            >
              <LogOut aria-hidden className="size-4" />
              <span className="sr-only sm:not-sr-only">Sign out</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Calculator, CircleHelp, CreditCard, Home, Inbox, Package, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Section links for the vendor area. Wraps on phones; never scrolls sideways.
 * Venue-only vendors get inventory too: it holds their in-house decor.
 */
export function VendorNav() {
  const pathname = usePathname();
  const links = [
    { href: "/vendor", label: "Overview", icon: Home, exact: true },
    { href: "/vendor/leads", label: "Leads", icon: Inbox },
    { href: "/vendor/business", label: "Business", icon: Building2 },
    { href: "/vendor/inventory", label: "Inventory", icon: Sparkles },
    { href: "/vendor/packages", label: "Packages", icon: Package },
    { href: "/vendor/estimate-preview", label: "Estimate preview", icon: Calculator },
    { href: "/vendor/billing", label: "Plan", icon: CreditCard },
    { href: "/vendor/help", label: "Help", icon: CircleHelp },
  ];

  return (
    <nav aria-label="Vendor sections" className="border-b border-line bg-surface">
      <ul className="container-page flex flex-wrap gap-1 py-2">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-small font-semibold whitespace-nowrap transition-colors",
                  active ? "bg-accent-tint text-accent-text" : "text-muted hover:text-ink",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

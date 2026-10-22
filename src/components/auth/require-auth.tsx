"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Role } from "@/lib/data/users";
import { takeSignOutDestination, useAuth } from "@/lib/auth/auth-provider";
import { useT } from "@/lib/i18n/provider";
import { LoadingScreen } from "./auth-shell";

/**
 * Client-side routing guard only. Real protection is in the security rules;
 * this just sends people to the right screen.
 */
export function RequireAuth({ role, children }: { role?: Role; children: React.ReactNode }) {
  const t = useT();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (auth.status === "signed-out") {
      router.replace(takeSignOutDestination() ?? `/sign-in?next=${encodeURIComponent(pathname)}`);
    }
    if (auth.status === "needs-profile") router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
  }, [auth.status, pathname, router]);

  if (auth.status !== "ready") return <LoadingScreen />;

  if (role && auth.profile.role !== role) {
    return (
      <main className="container-page flex min-h-[60dvh] flex-col justify-center gap-4 py-16">
        <h1 className="text-h2">{role === "vendor" ? t("ui.requireAuth.areaForVendors") : t("ui.requireAuth.areaForCouples")}</h1>
        <p className="max-w-lg text-muted">
          {auth.profile.role === "vendor" ? t("ui.requireAuth.createdAsVendor") : t("ui.requireAuth.createdAsCouple")}
        </p>
        <Link href="/account" className="w-fit font-semibold text-accent-text underline underline-offset-4">
          {t("ui.requireAuth.goToAccount")}
        </Link>
      </main>
    );
  }

  return <>{children}</>;
}

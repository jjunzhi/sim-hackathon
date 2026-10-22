"use client";

import dynamic from "next/dynamic";
import { SkeletonList } from "@/components/ui/skeleton";

// Auth state only exists in the browser, so these screens render client-side.
const AuthShell = dynamic(() => import("./auth-shell"), {
  ssr: false,
  loading: () => (
    <main className="container-page py-16">
      <SkeletonList rows={3} label="Loading" />
    </main>
  ),
});

export function ClientAuthShell({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}

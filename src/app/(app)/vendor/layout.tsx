"use client";

import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/auth/require-auth";
import { VendorTheme } from "@/components/theme-scope";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="vendor">
      <VendorTheme />
      <AppHeader />
      {children}
    </RequireAuth>
  );
}

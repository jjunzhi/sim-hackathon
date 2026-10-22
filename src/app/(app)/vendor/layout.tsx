"use client";

import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/auth/require-auth";
import { VendorTheme } from "@/components/theme-scope";
import { SkeletonList } from "@/components/ui/skeleton";
import { BusinessSetup } from "@/components/vendor/business-setup";
import { VendorNav } from "@/components/vendor/vendor-nav";
import { useVendor, VendorProvider } from "@/lib/vendors/vendor-context";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="vendor">
      <VendorTheme />
      <AppHeader />
      <VendorProvider>
        <VendorGate>{children}</VendorGate>
      </VendorProvider>
    </RequireAuth>
  );
}

/** Every vendor screen needs a business profile; first-time vendors set one up here. */
function VendorGate({ children }: { children: React.ReactNode }) {
  const vendor = useVendor();
  if (vendor.status === "loading") {
    return (
      <main className="container-page py-10">
        <SkeletonList rows={2} label="Loading your business" />
      </main>
    );
  }
  if (vendor.status === "error") {
    return (
      <main className="container-page py-10">
        <p role="alert" className="text-error">
          We couldn&apos;t load your business. Please refresh the page.
        </p>
      </main>
    );
  }
  if (vendor.status === "none") return <BusinessSetup uid={vendor.uid} />;
  return (
    <>
      <VendorNav />
      {children}
    </>
  );
}

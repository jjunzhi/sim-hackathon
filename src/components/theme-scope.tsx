"use client";

import { useEffect } from "react";

/** Applies the vendor dark theme to <html> while mounted, so portals follow it. */
export function VendorTheme() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("vendor-dark");
    return () => root.classList.remove("vendor-dark");
  }, []);
  return null;
}

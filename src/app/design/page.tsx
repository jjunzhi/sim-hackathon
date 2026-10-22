import type { Metadata } from "next";
import { DesignShowcase } from "./showcase";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false },
};

// ?theme=vendor opens the dark theme directly (used by scripts/screenshots.mjs).
export default async function DesignPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const { theme } = await searchParams;
  return <DesignShowcase initialTheme={theme === "vendor" ? "vendor" : "couple"} />;
}

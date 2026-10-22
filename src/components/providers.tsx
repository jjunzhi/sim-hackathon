"use client";

import { MotionConfig } from "motion/react";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // "user" follows the device Reduced Motion setting: transform animations
    // are skipped, opacity fades remain.
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}

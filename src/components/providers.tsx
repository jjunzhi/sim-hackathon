"use client";

import { MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import { AriaProvider } from "@/components/aria/aria-context";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { LocaleProvider } from "@/lib/i18n/provider";

// Aria floats over every page; she needs the browser (auth, Firebase), so she renders client-side only.
const AriaHost = dynamic(() => import("@/components/aria/aria-host").then((m) => m.AriaHost), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // "user" follows the device Reduced Motion setting: transform animations
    // are skipped, opacity fades remain.
    <MotionConfig reducedMotion="user">
      <LocaleProvider>
        <ToastProvider>
          <AuthProvider>
            <AriaProvider>
              {children}
              <AriaHost />
            </AriaProvider>
          </AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </MotionConfig>
  );
}

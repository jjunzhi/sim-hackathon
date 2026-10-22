"use client";

import { Toast as RToast } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { modalVariants, sheetVariants } from "@/lib/motion";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";

type ToastTone = "info" | "success" | "error";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms before auto-dismiss. Default 5000. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}

const icons: Record<ToastTone, React.ReactNode> = {
  info: <Info aria-hidden className="size-5 text-accent-text" />,
  success: <CircleCheck aria-hidden className="size-5 text-success" />,
  error: <CircleAlert aria-hidden className="size-5 text-error" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const desktop = useMediaQuery(DESKTOP_QUERY, true);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { ...options, id }]);
  }, []);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      <RToast.Provider swipeDirection={desktop ? "right" : "down"} label="Notification">
        {children}
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <RToast.Root
              key={t.id}
              asChild
              forceMount
              duration={t.duration ?? 5000}
              type={t.tone === "error" ? "foreground" : "background"}
              onOpenChange={(open) => !open && dismiss(t.id)}
            >
              <motion.li
                layout
                variants={desktop ? modalVariants : sheetVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  "pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 text-ink shadow-lift",
                )}
              >
                <span className="mt-0.5">{icons[t.tone ?? "info"]}</span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <RToast.Title className="font-semibold">{t.title}</RToast.Title>
                  {t.description && <RToast.Description className="text-small text-muted">{t.description}</RToast.Description>}
                </div>
                <RToast.Close
                  aria-label="Dismiss"
                  className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-ink"
                >
                  <X aria-hidden className="size-4" />
                </RToast.Close>
              </motion.li>
            </RToast.Root>
          ))}
        </AnimatePresence>
        <RToast.Viewport
          className={cn(
            "fixed z-[60] flex flex-col gap-3 outline-none",
            "inset-x-0 bottom-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
            "sm:inset-x-auto sm:right-0 sm:w-[24rem] sm:p-6",
          )}
        />
      </RToast.Provider>
    </ToastContext.Provider>
  );
}

"use client";

import { Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useT } from "@/lib/i18n/provider";
import { useAria } from "./aria-context";
import { AriaGeneral } from "./aria-general";

/** Pages where Aria stays out of the way: vendor tools, sign-in steps, print and family links. */
const HIDDEN = [/^\/vendor(\/|$)/, /^\/s\//, /^\/plans\/[^/]+\/print/, /^\/sign-in/, /^\/sign-up/, /^\/welcome/, /^\/design/];

/**
 * The floating Aria: a round button in the bottom-right corner that opens her
 * panel. In the Studio the page renders its plan tools into the panel;
 * everywhere else she is a wedding planner. Not shown to vendors.
 */
export function AriaHost() {
  const t = useT();
  const auth = useAuth();
  const pathname = usePathname() ?? "/";
  const { open, setOpen, planMode, setSlot } = useAria();
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hidden = HIDDEN.some((re) => re.test(pathname)) || (auth.status === "ready" && auth.profile.role === "vendor");

  // Escape closes; focus moves into the panel when it opens and back to the button when it closes.
  useEffect(() => {
    if (!open) return;
    const field = panel.current?.querySelector<HTMLElement>("textarea") ?? panel.current?.querySelector<HTMLElement>("button");
    field?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog][aria-modal=true], [role=listbox]")) {
        setOpen(false);
        launcher.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (hidden) return null;

  return (
    <>
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-modal="false"
          aria-labelledby="aria-panel-title"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden border-line bg-surface text-ink shadow-lift sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(44rem,calc(100dvh-8rem))] sm:w-[26rem] sm:rounded-xl sm:border"
        >
          <div className="flex items-center gap-3 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
              <Sparkles className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 id="aria-panel-title" className="font-display text-h3 leading-tight">
                {t("assistant.title")}
              </h2>
              <p className="truncate text-small text-muted">{planMode ? t("aria.planSubtitle") : t("aria.subtitle")}</p>
            </div>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={() => {
                setOpen(false);
                launcher.current?.focus();
              }}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {planMode ? <div ref={setSlot} className="flex min-h-0 flex-1 flex-col" /> : <AriaGeneral />}
        </div>
      )}
      <button
        ref={launcher}
        type="button"
        aria-label={t("aria.launcher")}
        aria-expanded={open}
        title={t("aria.launcher")}
        onClick={() => setOpen(!open)}
        className={
          "fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 inline-flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lift transition-transform hover:scale-105 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:right-6 sm:bottom-6" +
          (open ? " max-sm:hidden" : "")
        }
      >
        {open ? <X aria-hidden className="size-6" /> : <Sparkles aria-hidden className="size-6" />}
      </button>
    </>
  );
}

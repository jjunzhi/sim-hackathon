"use client";

import { Dialog } from "radix-ui";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { modalVariants, overlayVariants, sheetVariants } from "@/lib/motion";
import { useT } from "@/lib/i18n/provider";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";

interface OverlayBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Buttons row. Keep to one primary. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Radix only restores focus to its own Dialog.Trigger. Our overlays are
 * opened from state, so remember whatever had focus as the overlay opens
 * (layout effect runs before Radix moves focus inside) and return to it.
 */
function useReturnFocus(open: boolean) {
  const returnTo = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) returnTo.current = document.activeElement;
  }, [open]);
  return (event: Event) => {
    event.preventDefault();
    returnTo.current?.focus();
  };
}

function CloseButton() {
  const t = useT();
  return (
    <Dialog.Close
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink"
      aria-label={t("common.close")}
    >
      <X aria-hidden className="size-5" />
    </Dialog.Close>
  );
}

function Overlay() {
  return (
    <Dialog.Overlay asChild forceMount>
      <motion.div
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-40 bg-[var(--overlay)]"
      />
    </Dialog.Overlay>
  );
}

function Header({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1 pt-1.5">
        <Dialog.Title className="text-h3">{title}</Dialog.Title>
        {description && <Dialog.Description className="text-muted">{description}</Dialog.Description>}
      </div>
      <CloseButton />
    </div>
  );
}

/**
 * Centered dialog on desktop (scale-fade); slides up from the bottom on
 * mobile (spring). Radix handles focus trap, Escape, and focus restore.
 */
export function Modal({ open, onOpenChange, title, description, children, footer, className }: OverlayBaseProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const onCloseAutoFocus = useReturnFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Overlay />
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
              <Dialog.Content
                asChild
                forceMount
                onCloseAutoFocus={onCloseAutoFocus}
                {...(description ? {} : { "aria-describedby": undefined })}
              >
                <motion.div
                  variants={desktop ? modalVariants : sheetVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className={cn(
                    "pointer-events-auto flex max-h-[90dvh] w-full flex-col gap-5 overflow-y-auto border border-line bg-surface p-5 text-ink shadow-lift",
                    "rounded-t-xl pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-xl sm:p-6",
                    className,
                  )}
                >
                  <Header title={title} description={description} />
                  {children && <div className="text-body">{children}</div>}
                  {footer && <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/** Bottom sheet at every width. Drag the handle down (or press Escape) to close. */
export function BottomSheet({ open, onOpenChange, title, description, children, footer, className }: OverlayBaseProps) {
  const dragControls = useDragControls();
  const onCloseAutoFocus = useReturnFocus(open);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Overlay />
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center">
              <Dialog.Content
                asChild
                forceMount
                onCloseAutoFocus={onCloseAutoFocus}
                {...(description ? {} : { "aria-describedby": undefined })}
              >
                <motion.div
                  variants={sheetVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  drag="y"
                  dragListener={false}
                  dragControls={dragControls}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.6 }}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "pointer-events-auto flex max-h-[85dvh] w-full max-w-xl flex-col gap-5 overflow-y-auto rounded-t-xl border border-line bg-surface px-5 text-ink shadow-lift",
                    "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
                    className,
                  )}
                >
                  <div
                    className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center pt-2 active:cursor-grabbing"
                    onPointerDown={(e) => dragControls.start(e)}
                    aria-hidden
                  >
                    <span className="h-1.5 w-10 rounded-full bg-line-strong" />
                  </div>
                  <Header title={title} description={description} />
                  {children && <div className="text-body">{children}</div>}
                  {footer && <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

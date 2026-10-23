"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PlannerMessage } from "@/lib/assistant/planner-client";

/**
 * Aria's shared state. One floating Aria for the whole site:
 * - on most pages she is a wedding planner (the conversation lives here, in
 *   memory only, so it survives moving between pages but is never stored);
 * - in the Studio the page takes over her panel (planMode) and renders the
 *   plan tools into `slot` through a portal.
 */
interface AriaState {
  open: boolean;
  /** Increases on every open, so panels can start fresh (e.g. on the Chat tab). */
  openCount: number;
  setOpen: (open: boolean) => void;
  planMode: boolean;
  setPlanMode: (on: boolean) => void;
  /** Where the Studio renders its plan tools while planMode is on. */
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
  messages: PlannerMessage[];
  setMessages: (update: (prev: PlannerMessage[]) => PlannerMessage[]) => void;
}

const AriaContext = createContext<AriaState | null>(null);

export function AriaProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [planMode, setPlanMode] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [messages, setMessagesState] = useState<PlannerMessage[]>([]);
  const setOpen = useCallback((o: boolean) => {
    setOpenState(o);
    if (o) setOpenCount((n) => n + 1);
  }, []);
  const setMessages = useCallback((update: (prev: PlannerMessage[]) => PlannerMessage[]) => setMessagesState(update), []);
  const value = useMemo(
    () => ({ open, openCount, setOpen, planMode, setPlanMode, slot, setSlot, messages, setMessages }),
    [open, openCount, setOpen, planMode, slot, messages, setMessages],
  );
  return <AriaContext.Provider value={value}>{children}</AriaContext.Provider>;
}

export function useAria(): AriaState {
  const ctx = useContext(AriaContext);
  if (!ctx) throw new Error("useAria needs <AriaProvider>");
  return ctx;
}

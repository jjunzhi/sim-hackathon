"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { watchVendor } from "@/lib/data/vendors";
import type { VendorProfile } from "./model";

type VendorState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "none"; uid: string }
  | { status: "ready"; uid: string; profile: VendorProfile };

const VendorContext = createContext<VendorState>({ status: "loading" });

export const useVendor = () => useContext(VendorContext);

/** Subscribes once to vendors/{uid} for the whole vendor area. */
export function VendorProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const uid = auth.status === "ready" ? auth.user.uid : null;
  const [state, setState] = useState<{ uid: string | null; value: VendorState }>({ uid: null, value: { status: "loading" } });

  useEffect(() => {
    if (!uid) return;
    return watchVendor(
      uid,
      (profile) => setState({ uid, value: profile ? { status: "ready", uid, profile } : { status: "none", uid } }),
      () => setState({ uid, value: { status: "error" } }),
    );
  }, [uid]);

  const value: VendorState = state.uid === uid ? state.value : { status: "loading" };
  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>;
}

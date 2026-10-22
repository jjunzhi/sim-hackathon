"use client";

import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import type { Role, UserProfile } from "@/lib/data/users";
import { FirebaseConfigError } from "@/lib/firebase/config";
import { getFirebase } from "@/lib/firebase/client";

export type AuthState =
  | { status: "loading" }
  | { status: "config-error"; error: FirebaseConfigError }
  | { status: "error"; message: string }
  | { status: "signed-out" }
  /** Signed in, but has not chosen a role and given consent yet. */
  | { status: "needs-profile"; user: User }
  | { status: "ready"; user: User; profile: UserProfile & { role: Role } };

const AuthContext = createContext<AuthState>({ status: "loading" });

export function useAuth() {
  return useContext(AuthContext);
}

// Where to go after a deliberate sign-out. Without this, the route guard
// sees "signed-out" first and sends people to the sign-in page instead.
let signOutDestination: string | null = null;

export async function signOut(destination = "/") {
  signOutDestination = destination;
  await fbSignOut(getFirebase().auth);
}

/** Read once by the route guard. */
export function takeSignOutDestination(): string | null {
  const d = signOutDestination;
  signOutDestination = null;
  return d;
}

function initialState(): AuthState {
  if (typeof window === "undefined") return { status: "loading" };
  try {
    getFirebase();
    return { status: "loading" };
  } catch (err) {
    if (err instanceof FirebaseConfigError) return { status: "config-error", error: err };
    throw err;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    let services: ReturnType<typeof getFirebase>;
    try {
      services = getFirebase();
    } catch {
      return; // config-error already in initial state
    }
    let unsubProfile: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(services.auth, (user) => {
      unsubProfile?.();
      // An anonymous session only exists to vote on a family link; to the rest of the app it's signed out.
      if (!user || user.isAnonymous) {
        setState({ status: "signed-out" });
        return;
      }
      unsubProfile = onSnapshot(
        doc(services.db, "users", user.uid),
        (snap) => {
          const data = snap.data() as UserProfile | undefined;
          setState(data?.role ? { status: "ready", user, profile: data } : { status: "needs-profile", user });
        },
        () => setState({ status: "error", message: "We couldn't load your account. Please refresh the page." }),
      );
    });
    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

"use client";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import { CONSENT_VERSION } from "@/lib/legal";

export type Role = "couple" | "vendor";

export interface UserProfile {
  role: Role;
  consent: { version: string; acceptedAt: unknown };
}

/**
 * Written once at sign-up. Security rules refuse any later change to the role,
 * and record consent with the server's clock.
 */
export async function createProfile(uid: string, role: Role): Promise<void> {
  const { db } = getFirebase();
  await setDoc(doc(db, "users", uid), {
    role,
    consent: { version: CONSENT_VERSION, acceptedAt: serverTimestamp() },
    createdAt: serverTimestamp(),
  });
}

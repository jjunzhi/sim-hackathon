"use client";

import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { Locale } from "@/lib/i18n/locales";
import { CONSENT_VERSION } from "@/lib/legal";

export type Role = "couple" | "vendor";

export interface UserProfile {
  role: Role;
  consent: { version: string; acceptedAt: unknown };
  /** The reader's language (Phase 6). Optional; the device choice applies otherwise. */
  locale?: Locale;
}

/** The only profile field a user can change after sign-up (rules allow nothing else). */
export async function setProfileLocale(uid: string, locale: Locale): Promise<void> {
  const { db } = getFirebase();
  await updateDoc(doc(db, "users", uid), { locale });
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

/**
 * Reads Firebase settings from NEXT_PUBLIC_* variables. Missing settings are an
 * error shown on screen; there is no silent fallback.
 *
 * NEXT_PUBLIC_ variables must be referenced literally so Next.js inlines them.
 */

export interface FirebaseSettings {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
  useEmulators: boolean;
  functionsRegion: string;
  /** reCAPTCHA Enterprise site key for App Check. Required outside the emulators. */
  appCheckSiteKey: string | null;
}

export class FirebaseConfigError extends Error {
  constructor(public readonly missing: string[], detail?: string) {
    super(detail ?? `Firebase is not configured. Missing: ${missing.join(", ")}`);
    this.name = "FirebaseConfigError";
  }
}

export function readFirebaseSettings(): FirebaseSettings {
  const raw = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";
  const appCheckSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY || null;

  const missing = Object.entries(raw)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (!useEmulators && !appCheckSiteKey) missing.push("NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY");
  if (missing.length) throw new FirebaseConfigError(missing);

  // Emulator mode only ever talks to a local "demo-" project, never a real one.
  if (useEmulators && !raw.NEXT_PUBLIC_FIREBASE_PROJECT_ID!.startsWith("demo-")) {
    throw new FirebaseConfigError(
      [],
      "Emulator mode needs a project ID starting with \"demo-\" so it can never reach a real Firebase project.",
    );
  }

  return {
    apiKey: raw.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: raw.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: raw.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: raw.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    appId: raw.NEXT_PUBLIC_FIREBASE_APP_ID!,
    useEmulators,
    functionsRegion: process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "asia-southeast1",
    appCheckSiteKey,
  };
}

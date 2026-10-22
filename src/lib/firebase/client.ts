"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { readFirebaseSettings, type FirebaseSettings } from "./config";

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: Functions;
  settings: FirebaseSettings;
}

let services: FirebaseServices | null = null;

/** Initialises Firebase once (browser only). Throws FirebaseConfigError if unconfigured. */
export function getFirebase(): FirebaseServices {
  if (services) return services;
  if (typeof window === "undefined") throw new Error("getFirebase() is browser-only");

  const settings = readFirebaseSettings();
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: settings.apiKey,
      authDomain: settings.authDomain,
      projectId: settings.projectId,
      storageBucket: settings.storageBucket,
      appId: settings.appId,
    });

  if (settings.appCheckSiteKey && !settings.useEmulators) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(settings.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, settings.functionsRegion);

  if (settings.useEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }

  services = { app, auth, db, storage, functions, settings };
  return services;
}

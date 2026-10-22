// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirebaseConfigError, readFirebaseSettings } from "./config";

const full = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "x.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "real-project",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "real-project.appspot.com",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:2:web:3",
  NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY: "site-key",
  NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "false",
};

function setEnv(values: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v as string);
}

describe("readFirebaseSettings", () => {
  beforeEach(() => setEnv(full));
  afterEach(() => vi.unstubAllEnvs());

  it("reads a complete production config", () => {
    const s = readFirebaseSettings();
    expect(s.projectId).toBe("real-project");
    expect(s.useEmulators).toBe(false);
    expect(s.functionsRegion).toBe("asia-southeast1");
  });

  it("names every missing variable instead of falling back", () => {
    setEnv({ NEXT_PUBLIC_FIREBASE_API_KEY: "", NEXT_PUBLIC_FIREBASE_APP_ID: "" });
    try {
      readFirebaseSettings();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(FirebaseConfigError);
      expect((e as FirebaseConfigError).missing).toEqual(["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_APP_ID"]);
    }
  });

  it("requires an App Check key outside the emulators", () => {
    setEnv({ NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY: "" });
    expect(() => readFirebaseSettings()).toThrow(/RECAPTCHA/);
  });

  it("emulator mode refuses a real project ID", () => {
    setEnv({ NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true", NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY: "" });
    expect(() => readFirebaseSettings()).toThrow(/demo-/);
    setEnv({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-weddingvista" });
    expect(readFirebaseSettings().useEmulators).toBe(true);
  });
});

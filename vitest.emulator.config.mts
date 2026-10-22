import { defineConfig } from "vitest/config";

// Tests that need the Firebase emulators. Run through `firebase emulators:exec`
// (npm run test:rules / npm run test:functions), never on their own.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});

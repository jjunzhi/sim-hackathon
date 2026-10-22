import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { BUCKET, COUPLE, OTHER_VENDOR, VENDOR, makeEnv, seedUser, seedVenue } from "./setup";

let env: RulesTestEnvironment;
const storage = (uid?: string) => (uid ? env.authenticatedContext(uid).storage(BUCKET) : env.unauthenticatedContext().storage(BUCKET));
const bytes = (n: number) => new Uint8Array(n).fill(7);
const webp = { contentType: "image/webp" };

beforeAll(async () => {
  env = await makeEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seedUser(env, VENDOR, "vendor");
  await seedUser(env, OTHER_VENDOR, "vendor");
  await seedUser(env, COUPLE, "couple");
  await seedVenue(env, "v1", VENDOR, "draft");
  await seedVenue(env, "live", VENDOR, "active");
});

const path = (venue = "v1", file = "abc.webp") => `venues/${venue}/spaces/s1/${file}`;

describe("venue photos", () => {
  it("the owner can upload WebP and JPEG photos", async () => {
    await assertSucceeds(uploadBytes(ref(storage(VENDOR), path()), bytes(1000), webp));
    await assertSucceeds(uploadBytes(ref(storage(VENDOR), path("v1", "abc.jpg")), bytes(1000), { contentType: "image/jpeg" }));
  });

  it("refuses other file types, even with an image extension", async () => {
    await assertFails(uploadBytes(ref(storage(VENDOR), path()), bytes(1000), { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(storage(VENDOR), path()), bytes(1000), { contentType: "image/heic" }));
    await assertFails(uploadBytes(ref(storage(VENDOR), path()), bytes(1000), { contentType: "text/html" }));
    await assertFails(uploadBytes(ref(storage(VENDOR), path("v1", "evil.svg")), bytes(1000), webp));
  });

  it("refuses files over 3 MB and empty files", async () => {
    await assertFails(uploadBytes(ref(storage(VENDOR), path()), bytes(3 * 1024 * 1024 + 1), webp));
    await assertFails(uploadBytes(ref(storage(VENDOR), path()), bytes(0), webp));
    await assertSucceeds(uploadBytes(ref(storage(VENDOR), path()), bytes(3 * 1024 * 1024), webp));
  });

  it("another vendor or a couple cannot upload or delete", async () => {
    await assertFails(uploadBytes(ref(storage(OTHER_VENDOR), path()), bytes(1000), webp));
    await assertFails(uploadBytes(ref(storage(COUPLE), path()), bytes(1000), webp));
    await assertFails(uploadBytes(ref(storage(), path()), bytes(1000), webp));
    await assertSucceeds(uploadBytes(ref(storage(VENDOR), path()), bytes(1000), webp));
    await assertFails(deleteObject(ref(storage(OTHER_VENDOR), path())));
    await assertSucceeds(deleteObject(ref(storage(VENDOR), path())));
  });

  it("cannot upload into a venue that doesn't exist", async () => {
    await assertFails(uploadBytes(ref(storage(VENDOR), path("nope")), bytes(1000), webp));
  });

  it("draft photos are private; active venue photos are public", async () => {
    await uploadBytes(ref(storage(VENDOR), path("v1")), bytes(1000), webp);
    await uploadBytes(ref(storage(VENDOR), path("live")), bytes(1000), webp);
    await assertFails(getBytes(ref(storage(), path("v1"))));
    await assertFails(getBytes(ref(storage(OTHER_VENDOR), path("v1"))));
    await assertSucceeds(getBytes(ref(storage(VENDOR), path("v1"))));
    await assertSucceeds(getBytes(ref(storage(), path("live"))));
  });

  it("nothing outside venues/ is writable", async () => {
    await assertFails(uploadBytes(ref(storage(VENDOR), `users/${VENDOR}/x.webp`), bytes(10), webp));
    await assertFails(uploadBytes(ref(storage(VENDOR), "anything.webp"), bytes(10), webp));
  });
});

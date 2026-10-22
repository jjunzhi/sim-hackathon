import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  COUPLE,
  OTHER_VENDOR,
  VENDOR,
  fixedTime,
  makeEnv,
  newSpace,
  newVenue,
  seed,
  seedUser,
  seedVenue,
} from "./setup";

let env: RulesTestEnvironment;
const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const profile = (role: string, extra: Record<string, unknown> = {}) => ({
  role,
  consent: { version: "draft-2026-10-22", acceptedAt: serverTimestamp() },
  createdAt: serverTimestamp(),
  ...extra,
});

beforeAll(async () => {
  env = await makeEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

describe("users: role and consent", () => {
  it("lets a person create their own profile as a couple or a vendor", async () => {
    await assertSucceeds(setDoc(doc(db(COUPLE), "users", COUPLE), profile("couple")));
    await assertSucceeds(setDoc(doc(db(VENDOR), "users", VENDOR), profile("vendor")));
  });

  it("refuses unknown roles such as admin", async () => {
    await assertFails(setDoc(doc(db(COUPLE), "users", COUPLE), profile("admin")));
  });

  it("refuses a profile without consent, or with a client-chosen consent time", async () => {
    await assertFails(setDoc(doc(db(COUPLE), "users", COUPLE), { role: "couple", createdAt: serverTimestamp() }));
    await assertFails(
      setDoc(doc(db(COUPLE), "users", COUPLE), profile("couple", { consent: { version: "v1", acceptedAt: fixedTime } })),
    );
  });

  it("refuses extra fields (minimum data)", async () => {
    await assertFails(setDoc(doc(db(COUPLE), "users", COUPLE), profile("couple", { phone: "91234567" })));
  });

  it("refuses creating a profile for someone else", async () => {
    await assertFails(setDoc(doc(db(COUPLE), "users", VENDOR), profile("vendor")));
  });

  it("a couple cannot become a vendor (no updates, no overwrite, no delete)", async () => {
    await seedUser(env, COUPLE, "couple");
    await assertFails(updateDoc(doc(db(COUPLE), "users", COUPLE), { role: "vendor" }));
    await assertFails(setDoc(doc(db(COUPLE), "users", COUPLE), profile("vendor")));
    await assertFails(deleteDoc(doc(db(COUPLE), "users", COUPLE)));
  });

  it("only the owner can read a profile", async () => {
    await seedUser(env, COUPLE, "couple");
    await assertSucceeds(getDoc(doc(db(COUPLE), "users", COUPLE)));
    await assertFails(getDoc(doc(db(VENDOR), "users", COUPLE)));
    await assertFails(getDoc(doc(db(), "users", COUPLE)));
  });
});

describe("venues", () => {
  beforeEach(async () => {
    await seedUser(env, VENDOR, "vendor");
    await seedUser(env, OTHER_VENDOR, "vendor");
    await seedUser(env, COUPLE, "couple");
  });

  it("a vendor can create an unverified draft they own", async () => {
    await assertSucceeds(addDoc(collection(db(VENDOR), "venues"), newVenue(VENDOR)));
  });

  it("a couple cannot create venues", async () => {
    await assertFails(addDoc(collection(db(COUPLE), "venues"), newVenue(COUPLE)));
  });

  it("a signed-in person without a profile cannot create venues", async () => {
    await assertFails(addDoc(collection(db("no-profile"), "venues"), newVenue("no-profile")));
  });

  it("refuses creating a venue for another owner, pre-verified, or already published", async () => {
    await assertFails(addDoc(collection(db(VENDOR), "venues"), newVenue(OTHER_VENDOR)));
    await assertFails(addDoc(collection(db(VENDOR), "venues"), newVenue(VENDOR, { verified: true })));
    await assertFails(addDoc(collection(db(VENDOR), "venues"), newVenue(VENDOR, { status: "active" })));
  });

  it("venues no longer carry tax settings (they live on the business profile)", async () => {
    await assertFails(addDoc(collection(db(VENDOR), "venues"), newVenue(VENDOR, { tax: { serviceChargeBps: 0, gstBps: 0, noServiceChargeNote: "", noGstNote: "" } })));
  });

  it("validates postal code and refuses unknown fields", async () => {
    await assertFails(addDoc(collection(db(VENDOR), "venues"), newVenue(VENDOR, { postalCode: "12345" })));
    await assertFails(addDoc(collection(db(VENDOR), "venues"), newVenue(VENDOR, { rating: 5 })));
  });

  it("the owner can edit and publish; verified and owner never change", async () => {
    await seedVenue(env, "v1", VENDOR);
    const ref = doc(db(VENDOR), "venues", "v1");
    await assertSucceeds(updateDoc(ref, { name: "SAMPLE New Name", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: "active", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { verified: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { ownerUid: OTHER_VENDOR, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { name: "No timestamp" }));
  });

  it("another vendor cannot read a draft, edit, or delete someone else's venue", async () => {
    await seedVenue(env, "v1", VENDOR);
    await assertFails(getDoc(doc(db(OTHER_VENDOR), "venues", "v1")));
    await assertFails(updateDoc(doc(db(OTHER_VENDOR), "venues", "v1"), { name: "Hijack", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db(OTHER_VENDOR), "venues", "v1")));
  });

  it("the owner cannot delete a venue directly (account deletion only)", async () => {
    await seedVenue(env, "v1", VENDOR);
    await assertFails(deleteDoc(doc(db(VENDOR), "venues", "v1")));
  });

  it("anyone can read active venues; drafts are private", async () => {
    await seedVenue(env, "live", VENDOR, "active");
    await seedVenue(env, "draft", VENDOR, "draft");
    await assertSucceeds(getDoc(doc(db(), "venues", "live")));
    await assertSucceeds(getDoc(doc(db(COUPLE), "venues", "live")));
    await assertFails(getDoc(doc(db(), "venues", "draft")));
    await assertFails(getDoc(doc(db(COUPLE), "venues", "draft")));
    await assertSucceeds(getDoc(doc(db(VENDOR), "venues", "draft")));
  });

  it("public listing must be limited to active venues of vendors in good standing (listed)", async () => {
    await seedVenue(env, "live", VENDOR, "active");
    await assertSucceeds(getDocs(query(collection(db(), "venues"), where("status", "==", "active"), where("listed", "==", true))));
    // Phase 7: without the listed filter, the catalog query is refused.
    await assertFails(getDocs(query(collection(db(), "venues"), where("status", "==", "active"))));
    await assertFails(getDocs(collection(db(), "venues")));
    await assertSucceeds(getDocs(query(collection(db(VENDOR), "venues"), where("ownerUid", "==", VENDOR))));
  });
});

describe("spaces", () => {
  beforeEach(async () => {
    await seedUser(env, VENDOR, "vendor");
    await seedUser(env, OTHER_VENDOR, "vendor");
    await seedVenue(env, "v1", VENDOR);
  });

  const spaces = (uid?: string) => collection(db(uid), "venues", "v1", "spaces");

  it("the owner can add a space with one price or with Peak and Off-Peak", async () => {
    await assertSucceeds(addDoc(spaces(VENDOR), newSpace()));
    await assertSucceeds(
      addDoc(
        spaces(VENDOR),
        newSpace({
          tiers: {
            peak: { roomRentalCents: 1_200_000, minimumSpendCents: 5_000_000 },
            offPeak: { roomRentalCents: 600_000, minimumSpendCents: null },
          },
        }),
      ),
    );
  });

  it("enforces capacity min <= max and sensible numbers", async () => {
    await assertFails(addDoc(spaces(VENDOR), newSpace({ capacityMin: 300, capacityMax: 200 })));
    await assertFails(addDoc(spaces(VENDOR), newSpace({ capacityMin: 0 })));
    await assertFails(addDoc(spaces(VENDOR), newSpace({ capacityMax: 99.5 })));
    await assertFails(addDoc(spaces(VENDOR), newSpace({ seatsPerTable: 0 })));
    await assertSucceeds(addDoc(spaces(VENDOR), newSpace({ capacityMin: 100, capacityMax: 100 })));
  });

  it("prices must be whole cents; tiers must be standard alone or both Peak and Off-Peak", async () => {
    await assertFails(addDoc(spaces(VENDOR), newSpace({ tiers: { standard: { roomRentalCents: 10.5, minimumSpendCents: null } } })));
    await assertFails(addDoc(spaces(VENDOR), newSpace({ tiers: { standard: { roomRentalCents: -1, minimumSpendCents: null } } })));
    await assertFails(addDoc(spaces(VENDOR), newSpace({ tiers: { peak: { roomRentalCents: 1, minimumSpendCents: null } } })));
    await assertFails(
      addDoc(
        spaces(VENDOR),
        newSpace({
          tiers: {
            standard: { roomRentalCents: 1, minimumSpendCents: null },
            peak: { roomRentalCents: 1, minimumSpendCents: null },
            offPeak: { roomRentalCents: 1, minimumSpendCents: null },
          },
        }),
      ),
    );
  });

  it("another vendor cannot add, read, edit or delete spaces on someone else's venue", async () => {
    await seed(env, "venues/v1/spaces/s1", { ...newSpace(), createdAt: fixedTime, updatedAt: fixedTime });
    await assertFails(addDoc(spaces(OTHER_VENDOR), newSpace()));
    await assertFails(getDoc(doc(db(OTHER_VENDOR), "venues/v1/spaces/s1")));
    await assertFails(updateDoc(doc(db(OTHER_VENDOR), "venues/v1/spaces/s1"), { name: "x", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db(OTHER_VENDOR), "venues/v1/spaces/s1")));
  });

  it("spaces of a draft venue are private; of an active venue, public", async () => {
    await seed(env, "venues/v1/spaces/s1", { ...newSpace(), createdAt: fixedTime, updatedAt: fixedTime });
    await assertFails(getDoc(doc(db(), "venues/v1/spaces/s1")));
    await seedVenue(env, "v1", VENDOR, "active");
    await assertSucceeds(getDoc(doc(db(), "venues/v1/spaces/s1")));
  });

  it("photoVersion starts at 0 and only goes up by one", async () => {
    await assertFails(addDoc(spaces(VENDOR), newSpace({ photoVersion: 3 })));
    await seed(env, "venues/v1/spaces/s1", { ...newSpace(), createdAt: fixedTime, updatedAt: fixedTime });
    const ref = doc(db(VENDOR), "venues/v1/spaces/s1");
    const photo = { path: "venues/v1/spaces/s1/abc.webp", width: 2048, height: 1536, contentType: "image/webp" };
    await assertSucceeds(updateDoc(ref, { photo, photoVersion: increment(1), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { photoVersion: 10, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { photoVersion: 0, updatedAt: serverTimestamp() }));
  });

  it("photo paths must point inside this venue's folder", async () => {
    await seed(env, "venues/v1/spaces/s1", { ...newSpace(), createdAt: fixedTime, updatedAt: fixedTime });
    const ref = doc(db(VENDOR), "venues/v1/spaces/s1");
    const photo = { path: "venues/other/spaces/s1/abc.webp", width: 2048, height: 1536, contentType: "image/webp" };
    await assertFails(updateDoc(ref, { photo, photoVersion: increment(1), updatedAt: serverTimestamp() }));
  });

  it("the owner can delete a space", async () => {
    await seed(env, "venues/v1/spaces/s1", { ...newSpace(), createdAt: fixedTime, updatedAt: fixedTime });
    await assertSucceeds(deleteDoc(doc(db(VENDOR), "venues/v1/spaces/s1")));
  });
});

describe("everything else is closed", () => {
  it("refuses unknown collections", async () => {
    await assertFails(setDoc(doc(db(COUPLE), "secrets", "x"), { a: 1 }));
    await assertFails(getDoc(doc(db(), "secrets", "x")));
  });
});

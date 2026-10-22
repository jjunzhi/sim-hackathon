import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/inventory/model";
import type { Space, Venue } from "@/lib/venues/model";
import type { VendorProfile } from "./model";
import { readinessProblems, setupSteps, type SetupInput } from "./setup-steps";

const photo = { path: "p.webp", width: 800, height: 600, contentType: "image/webp" as const };
const profile = (o: Partial<VendorProfile> = {}): VendorProfile => ({
  kinds: ["venue"],
  businessName: "SAMPLE Co",
  description: "",
  tax: { serviceChargeBps: 1000, gstBps: 900, noServiceChargeNote: "", noGstNote: "" },
  servesAnyVenue: false,
  servesVenueIds: [],
  published: false,
  ...o,
});
const venue = (o: Partial<Venue> = {}) =>
  ({ id: "v1", ownerUid: "u", status: "draft", verified: false, name: "SAMPLE Hall", address: "", postalCode: "", description: "", styleTags: [], cultureTags: [], wheelchairAccess: false, liftAccess: false, stepFreeEntrance: false, accessibleToilet: false, accessibleParking: false, menuOptions: [], coverPhoto: null, ...o }) as Venue & { id: string };
const space = (o: Partial<Space> = {}) => ({ id: "s1", name: "SAMPLE Room", capacityMin: 10, capacityMax: 100, seatsPerTable: 10, tiers: { standard: { roomRentalCents: 100, minimumSpendCents: null } }, photo: null, photoVersion: 0, sortOrder: 0, ...o }) as Space & { id: string };
const item = (o: Partial<InventoryItem & { id: string }> = {}) => ({ id: "i1", name: "SAMPLE arch", category: "Florals", unit: "piece", priceCents: 100, description: "", photo: null, active: true, dietaryTags: [], ...o }) as InventoryItem & { id: string };

const input = (o: Partial<SetupInput> = {}): SetupInput => ({ profile: profile(), venues: [], spaces: {}, items: [], goodStanding: false, ...o });
const done = (s: ReturnType<typeof setupSteps>) => Object.fromEntries(s.map((x) => [x.id, x.done]));

describe("setupSteps", () => {
  it("a new venue vendor starts with everything to do, each step linking somewhere", () => {
    const s = setupSteps(input());
    expect(s.map((x) => x.id)).toEqual(["details", "venue", "rooms", "items", "plan", "publish"]);
    expect(done(s)).toEqual({ details: false, venue: false, rooms: false, items: true, plan: false, publish: false });
    for (const x of s) expect(x.href.startsWith("/vendor")).toBe(true);
  });

  it("a fully set up, published venue vendor in good standing is done", () => {
    const s = setupSteps(
      input({
        profile: profile({ description: "SAMPLE", published: true }),
        venues: [venue({ address: "1 Road", coverPhoto: photo, status: "active" })],
        spaces: { v1: [space({ photo })] },
        goodStanding: true,
      }),
    );
    expect(s.filter((x) => !x.done).map((x) => x.id)).toEqual([]);
    expect(s.every((x) => x.todo === "")).toBe(true);
  });

  it("decorators need workplaces and at least one item with a photo; no venue steps", () => {
    const s = setupSteps(input({ profile: profile({ kinds: ["decorator"], description: "x" }), items: [item()] }));
    expect(s.map((x) => x.id)).toEqual(["details", "workplaces", "items", "plan", "publish"]);
    expect(done(s)).toMatchObject({ workplaces: false, items: false });
    const ok = setupSteps(input({ profile: profile({ kinds: ["decorator"], description: "x", servesAnyVenue: true }), items: [item({ photo })] }));
    expect(done(ok)).toMatchObject({ workplaces: true, items: true });
  });

  it("rooms without photos say what's missing", () => {
    const s = setupSteps(input({ venues: [venue()], spaces: { v1: [space()] } }));
    expect(s.find((x) => x.id === "rooms")!.todo).toBe("Add a photo of an empty room: renders start from it.");
  });
});

describe("readinessProblems", () => {
  it("lists what would confuse couples", () => {
    const p = readinessProblems(input({ venues: [venue()], spaces: { v1: [space()] }, items: [item(), item({ id: "i2" })] }));
    expect(p).toEqual([
      "SAMPLE Hall has no cover photo.",
      "SAMPLE Hall has no address, so couples can't find it on a map.",
      "SAMPLE Room has no photo, so it can't be shown decorated.",
      "2 active items have no photo and won't appear in renders.",
    ]);
  });

  it("nothing when ready", () => {
    expect(readinessProblems(input({ venues: [venue({ address: "1 Road", coverPhoto: photo })], spaces: { v1: [space({ photo })] }, items: [item({ photo })] }))).toEqual([]);
  });
});

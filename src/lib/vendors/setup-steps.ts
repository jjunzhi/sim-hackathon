import type { InventoryItem } from "@/lib/inventory/model";
import type { Space, Venue } from "@/lib/venues/model";
import type { VendorProfile } from "./model";

/**
 * The vendor's path from sign-up to being found by couples, worked out from
 * their real data, so the Overview checklist and the publish readiness check
 * always agree. Each step names the screen that finishes it.
 */
export type StepId = "details" | "venue" | "rooms" | "workplaces" | "items" | "plan" | "publish";

export interface SetupStep {
  id: StepId;
  title: string;
  /** What's missing, in plain words; empty when done. */
  todo: string;
  href: string;
  done: boolean;
}

export interface SetupInput {
  profile: VendorProfile;
  venues: Array<Venue & { id: string }>;
  /** Spaces per venue id. */
  spaces: Record<string, Array<Space & { id: string }>>;
  items: Array<InventoryItem & { id: string }>;
  goodStanding: boolean;
}

export function setupSteps(x: SetupInput): SetupStep[] {
  const isVenue = x.profile.kinds.includes("venue");
  const isDecorator = x.profile.kinds.includes("decorator");
  const steps: SetupStep[] = [];

  steps.push({
    id: "details",
    title: "Business details",
    todo: x.profile.description.trim() ? "" : "Add a short description of your business.",
    href: "/vendor/business",
    done: !!x.profile.businessName.trim() && !!x.profile.description.trim(),
  });

  if (isVenue) {
    const withAddress = x.venues.filter((v) => v.address.trim() && v.coverPhoto);
    steps.push({
      id: "venue",
      title: "Your venue",
      todo: x.venues.length === 0 ? "Add your venue." : withAddress.length ? "" : "Add the address and a cover photo.",
      href: x.venues[0] ? `/vendor/venues/${x.venues[0].id}` : "/vendor/venues/new",
      done: withAddress.length > 0,
    });
    const roomsReady = x.venues.some((v) => (x.spaces[v.id] ?? []).some((s) => s.photo));
    const anyRooms = x.venues.some((v) => (x.spaces[v.id] ?? []).length > 0);
    steps.push({
      id: "rooms",
      title: "Rooms with photos and prices",
      todo: roomsReady ? "" : anyRooms ? "Add a photo of an empty room: renders start from it." : "Add at least one room with its capacity and price.",
      href: x.venues[0] ? `/vendor/venues/${x.venues[0].id}?step=spaces` : "/vendor/venues/new",
      done: roomsReady,
    });
  }

  if (isDecorator) {
    steps.push({
      id: "workplaces",
      title: "Where you work",
      todo: x.profile.servesAnyVenue || x.profile.servesVenueIds.length ? "" : "Choose the venues where you can decorate.",
      href: "/vendor/business",
      done: x.profile.servesAnyVenue || x.profile.servesVenueIds.length > 0,
    });
  }

  const shownItems = x.items.filter((i) => i.active && i.photo);
  // Venues can rely on their rooms alone; decorators need items to be useful.
  const itemsNeeded = isDecorator;
  steps.push({
    id: "items",
    title: itemsNeeded ? "Your decor items" : "Your in-house decor (optional)",
    // Optional for venues: the title says so, and a done step never shows a to-do.
    todo: shownItems.length || !itemsNeeded ? "" : "Add at least one item with a photo and price.",
    href: "/vendor/inventory",
    done: shownItems.length > 0 || !itemsNeeded,
  });

  steps.push({
    id: "plan",
    title: "Plan",
    todo: x.goodStanding ? "" : "Use your pilot invite or choose the monthly plan.",
    href: "/vendor/billing",
    done: x.goodStanding,
  });

  const published = x.profile.published && (!isVenue || x.venues.some((v) => v.status === "active"));
  steps.push({
    id: "publish",
    title: "Publish",
    todo: published ? "" : "Publish when the steps above are done.",
    href: isVenue && x.venues[0] ? `/vendor/venues/${x.venues[0].id}?step=publish` : "/vendor/business",
    done: published,
  });
  return steps;
}

/**
 * Things that would give couples a broken or confusing experience. Shown
 * before publishing; none of them blocks it except having nothing to show.
 */
export function readinessProblems(x: SetupInput): string[] {
  const out: string[] = [];
  for (const v of x.venues) {
    if (!v.coverPhoto) out.push(`${v.name || "Your venue"} has no cover photo.`);
    if (!v.address.trim()) out.push(`${v.name || "Your venue"} has no address, so couples can't find it on a map.`);
    const rooms = x.spaces[v.id] ?? [];
    if (rooms.length === 0) out.push(`${v.name || "Your venue"} has no rooms yet.`);
    for (const s of rooms) if (!s.photo) out.push(`${s.name} has no photo, so it can't be shown decorated.`);
  }
  const noPhoto = x.items.filter((i) => i.active && !i.photo);
  if (noPhoto.length) out.push(`${noPhoto.length} active ${noPhoto.length === 1 ? "item has" : "items have"} no photo and won't appear in renders.`);
  return out;
}

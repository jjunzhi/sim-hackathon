import type { Space, Venue } from "./model";

export interface PublishCheck {
  id: string;
  label: string;
  done: boolean;
}

/** What a venue needs before couples can see it. Pure, so it is unit-tested. */
export function publishChecklist(venue: Pick<Venue, "name" | "address">, spaces: Pick<Space, "photo">[]): PublishCheck[] {
  return [
    { id: "name", label: "Venue name and address", done: venue.name.trim() !== "" && venue.address.trim() !== "" },
    { id: "spaces", label: "At least one space with capacity and prices", done: spaces.length > 0 },
    { id: "photos", label: "A photo of every space", done: spaces.length > 0 && spaces.every((s) => s.photo !== null) },
  ];
}

export const canPublish = (checks: PublishCheck[]) => checks.every((c) => c.done);

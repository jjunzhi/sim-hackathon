import type { Bps, Cents } from "@/lib/money";

/** Mirrors firestore.rules. Keep both in step. */
export const LIMITS = {
  nameMax: 120,
  addressMax: 300,
  descriptionMax: 2000,
  tagsMax: 12,
  capacityMin: 1,
  capacityMax: 5000,
  seatsPerTableMax: 30,
  moneyMaxCents: 100_000_000_000,
  noteMax: 200,
} as const;

export const SERVICE_CHARGE_OPTIONS: readonly Bps[] = [1000, 0];
export const GST_OPTIONS: readonly Bps[] = [900, 0];

export const STYLE_TAGS = ["Garden", "Ballroom", "Rooftop", "Heritage", "Beach", "Industrial", "Intimate", "Waterfront"] as const;
export const CULTURE_TAGS = ["Chinese", "Malay", "Indian", "Peranakan", "Western", "Fusion", "Halal-friendly"] as const;

export interface StoredPhoto {
  path: string;
  width: number;
  height: number;
  contentType: "image/webp" | "image/jpeg";
}

export interface TaxSettings {
  serviceChargeBps: Bps;
  gstBps: Bps;
  noServiceChargeNote: string;
  noGstNote: string;
}

export interface Venue {
  ownerUid: string;
  status: "draft" | "active";
  /** Set by an admin only. Vendors cannot change it. */
  verified: boolean;
  name: string;
  address: string;
  postalCode: string;
  description: string;
  styleTags: string[];
  cultureTags: string[];
  wheelchairAccess: boolean;
  liftAccess: boolean;
  coverPhoto: StoredPhoto | null;
}

export interface Tier {
  roomRentalCents: Cents;
  /** null = no minimum spend for this tier. */
  minimumSpendCents: Cents | null;
}

/** One standard price, or both Peak and Off-Peak (two tiers only for now). */
export type Tiers = { standard: Tier } | { peak: Tier; offPeak: Tier };

export interface Space {
  name: string;
  capacityMin: number;
  capacityMax: number;
  seatsPerTable: number;
  tiers: Tiers;
  photo: StoredPhoto | null;
  /** Increments on every new photo. Part of the render cache key (Phase 3). */
  photoVersion: number;
  sortOrder: number;
}

export function isTiered(t: Tiers): t is { peak: Tier; offPeak: Tier } {
  return "peak" in t;
}

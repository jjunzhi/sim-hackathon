import type { Cents } from "@/lib/money";
import type { StoredPhoto } from "@/lib/venues/model";

/** Mirrors firestore.rules. Keep both in step. */
export const UNITS = ["piece", "table", "guest"] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  piece: "per piece",
  table: "per table",
  guest: "per guest",
};

export const CATEGORIES = [
  "Florals",
  "Lighting",
  "Backdrops and stage",
  "Table decor",
  "Furniture",
  "Draping",
  "Signage",
  "Food and drink",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const INVENTORY_LIMITS = {
  nameMax: 120,
  descriptionMax: 1000,
  priceMaxCents: 100_000_000_000,
  packageItemsMax: 30,
  quantityMax: 999,
} as const;

export interface InventoryItem {
  name: string;
  category: Category;
  unit: Unit;
  priceCents: Cents;
  description: string;
  photo: StoredPhoto | null;
  active: boolean;
}

/** A named bundle with its own price; lists the items it includes. */
export interface InventoryPackage {
  name: string;
  unit: Unit;
  priceCents: Cents;
  description: string;
  itemIds: string[];
  photo: StoredPhoto | null;
  active: boolean;
}

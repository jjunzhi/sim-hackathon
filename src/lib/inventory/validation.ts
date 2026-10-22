import { INVENTORY_LIMITS, type InventoryItem, type InventoryPackage } from "./model";

export type Errors = Partial<Record<string, string>>;

function checkPrice(cents: number, e: Errors) {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > INVENTORY_LIMITS.priceMaxCents) e.priceCents = "Enter a price, for example 88.00.";
}

function checkName(name: string, e: Errors) {
  const n = name.trim();
  if (!n) e.name = "Add a name.";
  else if (n.length > INVENTORY_LIMITS.nameMax) e.name = `Keep the name under ${INVENTORY_LIMITS.nameMax} characters.`;
}

export function validateItem(i: Pick<InventoryItem, "name" | "priceCents" | "description">): Errors {
  const e: Errors = {};
  checkName(i.name, e);
  checkPrice(i.priceCents, e);
  if (i.description.length > INVENTORY_LIMITS.descriptionMax) e.description = `Keep it under ${INVENTORY_LIMITS.descriptionMax} characters.`;
  return e;
}

export function validatePackage(p: Pick<InventoryPackage, "name" | "priceCents" | "description" | "itemIds">): Errors {
  const e: Errors = {};
  checkName(p.name, e);
  checkPrice(p.priceCents, e);
  if (p.description.length > INVENTORY_LIMITS.descriptionMax) e.description = `Keep it under ${INVENTORY_LIMITS.descriptionMax} characters.`;
  if (p.itemIds.length === 0) e.itemIds = "Choose at least one item this package includes.";
  else if (p.itemIds.length > INVENTORY_LIMITS.packageItemsMax) e.itemIds = `Choose up to ${INVENTORY_LIMITS.packageItemsMax} items.`;
  return e;
}

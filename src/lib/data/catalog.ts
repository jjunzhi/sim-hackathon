"use client";

import { collection, doc, getDoc, getDocs, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { InventoryItem, InventoryPackage } from "@/lib/inventory/model";
import type { VendorCatalog } from "@/lib/plans/estimates";
import type { CatalogVenue } from "@/lib/venues/catalog";
import type { VendorProfile } from "@/lib/vendors/model";

/** Published venues only (the rules refuse anything else to visitors). */
export function watchCatalog(onData: (v: CatalogVenue[]) => void, onError: (e: Error) => void): Unsubscribe {
  const { db } = getFirebase();
  return onSnapshot(
    // Only vendors in good standing are discoverable (listed is server-written; rules require this filter).
    query(collection(db, "venues"), where("status", "==", "active"), where("listed", "==", true)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CatalogVenue, "id">) })).sort((a, b) => a.name.localeCompare(b.name))),
    onError,
  );
}

export async function getPublishedVenue(venueId: string): Promise<CatalogVenue | null> {
  const { db } = getFirebase();
  try {
    const snap = await getDoc(doc(db, "venues", venueId));
    return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<CatalogVenue, "id">) } : null;
  } catch {
    // Drafts are unreadable to others: treat as not found.
    return null;
  }
}

/** A vendor's profile and active items/packages (public once published; always for the owner). */
export async function getVendorCatalog(uid: string): Promise<VendorCatalog | null> {
  const { db } = getFirebase();
  try {
    const profile = await getDoc(doc(db, "vendors", uid));
    if (!profile.exists()) return null;
    const [items, packages] = await Promise.all([
      getDocs(query(collection(db, "vendors", uid, "items"), where("active", "==", true))),
      getDocs(query(collection(db, "vendors", uid, "packages"), where("active", "==", true))),
    ]);
    return {
      uid,
      profile: profile.data() as VendorProfile,
      items: items.docs.map((d) => ({ id: d.id, ...(d.data() as InventoryItem) })).sort((a, b) => a.name.localeCompare(b.name)),
      packages: packages.docs.map((d) => ({ id: d.id, ...(d.data() as InventoryPackage) })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch {
    return null;
  }
}

/**
 * Everything a couple can choose for this venue: the venue's own items, plus
 * published decorators who work at any venue or chose this one.
 */
/**
 * The venue's own catalog plus decorators who work there. `keepVendorUids`
 * are vendors a saved plan already uses: they stay priced even if they are no
 * longer listed, so a lapsed plan never breaks a couple's existing estimate.
 */
export async function loadVenueCatalogs(venue: Pick<CatalogVenue, "id" | "ownerUid">, keepVendorUids: string[] = []): Promise<VendorCatalog[]> {
  const { db } = getFirebase();
  const decorators = await getDocs(
    query(collection(db, "vendors"), where("published", "==", true), where("listed", "==", true), where("kinds", "array-contains", "decorator")),
  );
  const serving = decorators.docs
    .filter((d) => d.id !== venue.ownerUid)
    .filter((d) => {
      const p = d.data() as VendorProfile;
      return p.servesAnyVenue || p.servesVenueIds.includes(venue.id);
    })
    .map((d) => d.id);
  const uids = [...new Set([venue.ownerUid, ...serving, ...keepVendorUids])];
  const all = await Promise.all(uids.map(getVendorCatalog));
  return all.filter((c): c is VendorCatalog => c !== null);
}

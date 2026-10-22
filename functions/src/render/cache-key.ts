import { createHash } from "node:crypto";

export interface RenderKeyParts {
  /** venueId/spaceId */
  spaceId: string;
  spacePhotoVersion: number;
  themeId: string;
  /** vendorUid/itemId@photoRevision, so a replaced item photo is a new render. */
  itemIds: string[];
  promptTemplateVersion: string;
  modelName: string;
}

/**
 * SHA-256 of the render inputs. Item order never matters. Renders contain no
 * personal data, so one cached render can be shared by every couple who asks
 * for the same room, theme and items.
 */
export function renderCacheKey(p: RenderKeyParts): string {
  const canonical = JSON.stringify([
    p.spaceId,
    p.spacePhotoVersion,
    p.themeId,
    [...p.itemIds].sort(),
    p.promptTemplateVersion,
    p.modelName,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

/** The upload id in a photo path ("…/3f9a.webp" -> "3f9a"); changes with every new photo. */
export function photoRevision(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.[a-z0-9]+$/i, "");
}

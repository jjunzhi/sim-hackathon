import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import type { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/https";
import { logger } from "firebase-functions";
import { photoRevision, renderCacheKey } from "./cache-key.js";
import { failure, generateDemo, generateWithGemini, RenderFailure, type GeneratedImage, type ImageInput } from "./generators.js";
import { buildPrompt, MODEL_NAME, nearestAspectRatio, PROMPT_TEMPLATE_VERSION } from "./prompt.js";
import { counterIds, firstExceeded, LIMIT_MESSAGES, resolveLimits } from "./quota.js";
import { themeById } from "./themes.js";

type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

export const MAX_ITEMS = 10;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const PENDING_TIMEOUT_MS = 120_000;
const WAIT_FOR_OTHER_MS = 100_000;

export interface RenderRequest {
  venueId: string;
  spaceId: string;
  themeId: string;
  items: Array<{ vendorUid: string; itemId: string }>;
}

export interface RenderResult {
  key: string;
  path: string;
  cacheHit: boolean;
  demo: boolean;
  model: string;
  themeId: string;
  itemNames: string[];
  createdAt: string;
}

/** Shape and size checks before anything is read. */
export function parseRequest(data: unknown): RenderRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const bad = (m: string) => new HttpsError("invalid-argument", m);
  if (typeof d.venueId !== "string" || !ID.test(d.venueId)) throw bad("Choose a venue.");
  if (typeof d.spaceId !== "string" || !ID.test(d.spaceId)) throw bad("Choose a room.");
  if (typeof d.themeId !== "string" || !themeById(d.themeId)) throw bad("Choose a theme.");
  if (!Array.isArray(d.items) || d.items.length > MAX_ITEMS) throw bad(`Choose up to ${MAX_ITEMS} items for a render.`);
  const items = d.items.map((i) => {
    const x = (i ?? {}) as Record<string, unknown>;
    if (typeof x.vendorUid !== "string" || !ID.test(x.vendorUid) || typeof x.itemId !== "string" || !ID.test(x.itemId)) throw bad("One of the items isn't valid.");
    return { vendorUid: x.vendorUid, itemId: x.itemId };
  });
  if (new Set(items.map((i) => `${i.vendorUid}/${i.itemId}`)).size !== items.length) throw bad("An item is selected twice.");
  return { venueId: d.venueId, spaceId: d.spaceId, themeId: d.themeId, items };
}

interface Deps {
  db: Firestore;
  bucket: Bucket;
  apiKey: string | null;
  now: () => Date;
  emulator: boolean;
}

export async function handleRenderRequest(uid: string, req: RenderRequest, deps: Deps): Promise<RenderResult> {
  const { db, bucket } = deps;

  // ---- who may render this room ----
  const venueSnap = await db.doc(`venues/${req.venueId}`).get();
  if (!venueSnap.exists) throw new HttpsError("not-found", "This venue isn't available.");
  const venue = venueSnap.data() as { ownerUid: string; status: string };
  if (venue.status !== "active" && venue.ownerUid !== uid) throw new HttpsError("permission-denied", "This venue isn't published yet.");

  const spaceSnap = await db.doc(`venues/${req.venueId}/spaces/${req.spaceId}`).get();
  if (!spaceSnap.exists) throw new HttpsError("not-found", "This room isn't available.");
  const space = spaceSnap.data() as { photo: { path: string; width: number; height: number; contentType: string } | null; photoVersion: number };
  if (!space.photo) throw new HttpsError("failed-precondition", "This room has no photo yet, so it can't be rendered.");

  // ---- which items may appear: active, with a photo, from this venue or a decorator who works here ----
  const vendorCache = new Map<string, FirebaseFirestore.DocumentData | undefined>();
  const items: Array<{ ref: string; name: string; category: string; unit: string; description: string; photoPath: string; photoType: string }> = [];
  for (const { vendorUid, itemId } of req.items) {
    const snap = await db.doc(`vendors/${vendorUid}/items/${itemId}`).get();
    const item = snap.data();
    const unavailable = new HttpsError("failed-precondition", "One of the selected items isn't available for renders. It needs to be active and have a photo.");
    if (!item || item.active !== true || !item.photo) throw unavailable;
    if (vendorUid !== venue.ownerUid) {
      if (!vendorCache.has(vendorUid)) vendorCache.set(vendorUid, (await db.doc(`vendors/${vendorUid}`).get()).data());
      const v = vendorCache.get(vendorUid);
      const serves = v && v.published === true && (v.kinds as string[]).includes("decorator") && (v.servesAnyVenue === true || (v.servesVenueIds as string[]).includes(req.venueId));
      if (!serves) throw new HttpsError("permission-denied", "One of the selected items isn't offered at this venue.");
    }
    items.push({
      ref: `${vendorUid}/${itemId}@${photoRevision(item.photo.path)}`,
      name: item.name,
      category: item.category,
      unit: item.unit === "piece" ? "per piece" : item.unit === "table" ? "per table" : "per guest",
      description: item.description ?? "",
      photoPath: item.photo.path,
      photoType: item.photo.contentType,
    });
  }

  const theme = themeById(req.themeId)!;
  const demo = !deps.apiKey;
  const model = demo ? "demo" : MODEL_NAME;
  const key = renderCacheKey({
    spaceId: `${req.venueId}/${req.spaceId}`,
    spacePhotoVersion: space.photoVersion,
    themeId: theme.id,
    itemIds: items.map((i) => i.ref),
    promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
    modelName: model,
  });
  const renderRef = db.doc(`renders/${key}`);

  // ---- cache, with one generator per key ----
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(renderRef);
    const r = snap.data();
    if (r?.status === "ready") return { kind: "hit" as const, data: r };
    const startedAt = (r?.startedAt as Timestamp | undefined)?.toMillis() ?? 0;
    if (r?.status === "pending" && deps.now().getTime() - startedAt < PENDING_TIMEOUT_MS) return { kind: "wait" as const };
    tx.set(renderRef, { status: "pending", startedAt: Timestamp.fromDate(deps.now()) });
    return { kind: "mine" as const };
  });
  if (claim.kind === "hit") return toResult(key, claim.data, true);
  if (claim.kind === "wait") return waitForOther(renderRef, key);

  // ---- quota: reserve before spending; refunded if anything fails ----
  const ids = counterIds(uid, venue.ownerUid, deps.now());
  const counterRefs = {
    userDay: db.doc(`usage/${ids.userDay}`),
    userMonth: db.doc(`usage/${ids.userMonth}`),
    vendorMonth: db.doc(`usage/${ids.vendorMonth}`),
    globalDay: db.doc(`usage/${ids.globalDay}`),
  };
  try {
    await db.runTransaction(async (tx) => {
      const limitsSnap = await tx.get(db.doc("config/renderLimits"));
      const limits = resolveLimits(limitsSnap.data());
      const snaps = await Promise.all(Object.values(counterRefs).map((r) => tx.get(r)));
      const [userDay, userMonth, vendorMonth, globalDay] = snaps.map((s) => (s.get("count") as number | undefined) ?? 0) as [number, number, number, number];
      const exceeded = firstExceeded({ userDay, userMonth, vendorMonth, globalDay }, limits);
      if (exceeded) throw new HttpsError("resource-exhausted", LIMIT_MESSAGES[exceeded], { limit: exceeded });
      const subjects: Record<keyof typeof counterRefs, string> = { userDay: uid, userMonth: uid, vendorMonth: venue.ownerUid, globalDay: "global" };
      for (const [k, ref] of Object.entries(counterRefs) as Array<[keyof typeof counterRefs, FirebaseFirestore.DocumentReference]>) {
        tx.set(ref, { count: FieldValue.increment(1), subject: subjects[k], updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    });
  } catch (err) {
    await renderRef.delete().catch(() => undefined);
    throw err;
  }

  // ---- generate ----
  try {
    if (deps.emulator) await maybeFailForTest(db);
    const room: ImageInput = { data: (await bucket.file(space.photo.path).download())[0], mimeType: space.photo.contentType };
    let image: GeneratedImage;
    if (demo) {
      image = await generateDemo({ room, themeId: theme.id, themeLabel: theme.label, itemNames: items.map((i) => i.name) });
    } else {
      const itemImages = await Promise.all(items.map(async (i) => ({ data: (await bucket.file(i.photoPath).download())[0], mimeType: i.photoType })));
      image = await generateWithGemini({
        apiKey: deps.apiKey!,
        room,
        items: itemImages,
        prompt: buildPrompt(theme, items),
        aspectRatio: nearestAspectRatio(space.photo.width, space.photo.height),
      });
    }

    const path = `renders/${key}.jpg`;
    await bucket.file(path).save(image.bytes, { contentType: image.mimeType, metadata: { cacheControl: "public, max-age=31536000, immutable" } });
    // No personal data: who asked is never stored on the render.
    const doc = {
      status: "ready",
      path,
      venueId: req.venueId,
      spaceId: req.spaceId,
      vendorUid: venue.ownerUid,
      itemVendorUids: [...new Set(req.items.map((i) => i.vendorUid))],
      spacePhotoVersion: space.photoVersion,
      themeId: theme.id,
      itemRefs: items.map((i) => i.ref),
      itemNames: items.map((i) => i.name),
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      model,
      demo,
      createdAt: Timestamp.fromDate(deps.now()),
    };
    await renderRef.set(doc);
    return toResult(key, doc, false);
  } catch (err) {
    // Failures never use up quota.
    await db.runTransaction(async (tx) => {
      for (const ref of Object.values(counterRefs)) tx.set(ref, { count: FieldValue.increment(-1) }, { merge: true });
    });
    await renderRef.delete().catch(() => undefined);
    if (err instanceof RenderFailure) {
      logger.warn("render failed", { key, reason: err.reason });
      throw new HttpsError(err.reason === "unavailable" ? "unavailable" : "failed-precondition", err.message, { reason: err.reason });
    }
    logger.error("render crashed", { key, err: String(err) });
    throw new HttpsError("internal", failure("no_image").message);
  }
}

function toResult(key: string, d: FirebaseFirestore.DocumentData, cacheHit: boolean): RenderResult {
  return {
    key,
    path: d.path,
    cacheHit,
    demo: d.demo === true,
    model: d.model,
    themeId: d.themeId,
    itemNames: d.itemNames ?? [],
    createdAt: (d.createdAt as Timestamp).toDate().toISOString(),
  };
}

async function waitForOther(ref: FirebaseFirestore.DocumentReference, key: string): Promise<RenderResult> {
  const end = Date.now() + WAIT_FOR_OTHER_MS;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 1000));
    const d = (await ref.get()).data();
    if (d?.status === "ready") return toResult(key, d, true);
    if (!d) break;
  }
  throw new HttpsError("unavailable", "This render is taking longer than usual. Please try again in a minute.");
}

/** Emulator only: lets tests force one failure via config/renderTesting { failNext: true }. */
async function maybeFailForTest(db: Firestore) {
  const ref = db.doc("config/renderTesting");
  const fail = await db.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    if (d?.failNext !== true) return false;
    tx.set(ref, { failNext: false }, { merge: true });
    return true;
  });
  if (fail) throw failure("unavailable");
}

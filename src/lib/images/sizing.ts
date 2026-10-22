export const MAX_LONG_SIDE = 2048;
/** Must match storage.rules. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
/** Refuse absurd inputs before decoding (a 50 MB camera RAW would hang a phone). */
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;

export const ACCEPTED_INPUT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

/** Scale (w, h) down so the long side is at most `max`. Never scales up. */
export function fitWithin(width: number, height: number, max = MAX_LONG_SIDE): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new RangeError("Image has no size");
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const scale = max / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function looksLikeHeic(file: Pick<File, "name" | "type">): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** Quality steps tried in order until the file fits under MAX_UPLOAD_BYTES. */
export const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55] as const;

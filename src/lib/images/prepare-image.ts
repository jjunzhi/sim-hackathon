"use client";

import { MAX_INPUT_BYTES, MAX_UPLOAD_BYTES, QUALITY_STEPS, fitWithin, looksLikeHeic } from "./sizing";

export interface PreparedImage {
  blob: Blob;
  contentType: "image/webp" | "image/jpeg";
  extension: "webp" | "jpg";
  width: number;
  height: number;
}

export class ImagePrepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePrepError";
  }
}

/**
 * Decode, resize to 2048px on the long side, and re-encode on the device.
 * HEIC: Safari 17+ decodes it natively; other browsers load heic-to on demand.
 * WebP where the browser can encode it (Safari cannot and returns PNG), else JPEG.
 * Re-encoding also drops EXIF metadata such as GPS location.
 */
export async function prepareImage(input: Blob & { name?: string }): Promise<PreparedImage> {
  if (input.size > MAX_INPUT_BYTES) throw new ImagePrepError("That photo is too large. Please choose one under 40 MB.");

  const bitmap = await decode(input);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImagePrepError("Your browser couldn't process this photo.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of QUALITY_STEPS) {
      const webp = await toBlob(canvas, "image/webp", quality);
      // Safari ignores the WebP request and silently returns PNG.
      const out =
        webp && webp.type === "image/webp"
          ? { blob: webp, contentType: "image/webp" as const, extension: "webp" as const }
          : await jpeg(canvas, quality);
      if (out.blob.size <= MAX_UPLOAD_BYTES) return { ...out, width, height };
    }
    throw new ImagePrepError("We couldn't make this photo small enough. Please try a different one.");
  } finally {
    bitmap.close();
  }
}

async function jpeg(canvas: HTMLCanvasElement, quality: number) {
  const blob = await toBlob(canvas, "image/jpeg", quality);
  if (!blob) throw new ImagePrepError("Your browser couldn't save this photo.");
  return { blob, contentType: "image/jpeg" as const, extension: "jpg" as const };
}

async function decode(input: Blob & { name?: string }): Promise<ImageBitmap> {
  const isHeic = looksLikeHeic({ name: input.name ?? "", type: input.type });
  try {
    return await createImageBitmap(input, { imageOrientation: "from-image" });
  } catch {
    if (!isHeic) throw new ImagePrepError("We couldn't read this photo. Please try a JPEG, PNG or HEIC file.");
  }
  // Native decode failed on a HEIC file: convert on the device.
  try {
    const { heicTo } = await import("heic-to");
    return await heicTo({ blob: input, type: "bitmap", options: { imageOrientation: "from-image" } });
  } catch {
    throw new ImagePrepError(
      "We couldn't convert this HEIC photo on your device. Please export it as JPEG from your Photos app and try again.",
    );
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

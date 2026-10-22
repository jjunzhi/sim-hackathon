import { GoogleGenAI } from "@google/genai";
import sharp, { type Metadata, type Sharp } from "sharp";
import { IMAGE_SIZE, MODEL_NAME } from "./prompt.js";

export interface GeneratedImage {
  bytes: Buffer;
  mimeType: "image/jpeg";
}

export interface ImageInput {
  data: Buffer;
  mimeType: string;
}

/** A render that could not be produced. `reason` is for logs; `message` is safe to show people. */
export class RenderFailure extends Error {
  constructor(
    public readonly reason: "blocked" | "no_image" | "unavailable" | "bad_input",
    message: string,
  ) {
    super(message);
    this.name = "RenderFailure";
  }
}

const FRIENDLY = {
  blocked: "We couldn't create this render. Try a different theme or a different set of items.",
  no_image: "We couldn't create this render this time. Please try again.",
  unavailable: "The render service is busy right now. Please try again in a minute.",
  bad_input: "We couldn't use this room photo. Ask the venue to upload it again.",
} as const;

export const failure = (reason: RenderFailure["reason"]) => new RenderFailure(reason, FRIENDLY[reason]);

// The Interactions API response, narrowed to what we read.
interface InteractionLike {
  status?: string;
  output_image?: { type: "image"; data?: string; mime_type?: string } | undefined;
  steps?: Array<{ type: string; content?: Array<{ type: string; data?: string; mime_type?: string }>; error?: { message?: string } }>;
}

/** Pull the first generated image out of an interaction, or explain why there isn't one. */
export function extractImage(interaction: InteractionLike): GeneratedImage {
  for (const step of interaction.steps ?? []) {
    if (step.type !== "model_output") continue;
    for (const c of step.content ?? []) {
      if (c.type === "image" && c.data) return { bytes: Buffer.from(c.data, "base64"), mimeType: "image/jpeg" };
    }
  }
  if (interaction.output_image?.data) return { bytes: Buffer.from(interaction.output_image.data, "base64"), mimeType: "image/jpeg" };

  const errorText = (interaction.steps ?? []).map((s) => s.error?.message ?? "").join(" ").toLowerCase();
  if (/safety|prohibited|blocklist|recitation|policy/.test(errorText)) throw failure("blocked");
  throw failure("no_image");
}

/** Real render with Gemini. The key is read on the server only. */
export async function generateWithGemini(args: {
  apiKey: string;
  room: ImageInput;
  items: ImageInput[];
  prompt: string;
  aspectRatio: string;
}): Promise<GeneratedImage> {
  const ai = new GoogleGenAI({ apiKey: args.apiKey });
  let interaction: InteractionLike;
  try {
    interaction = (await ai.interactions.create({
      model: MODEL_NAME,
      // Don't keep conversation state on Google's side; each render stands alone.
      store: false,
      input: [
        { type: "image", mime_type: args.room.mimeType, data: args.room.data.toString("base64") },
        ...args.items.map((i) => ({ type: "image" as const, mime_type: i.mimeType, data: i.data.toString("base64") })),
        { type: "text", text: args.prompt },
      ],
      response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: args.aspectRatio, image_size: IMAGE_SIZE },
    })) as InteractionLike;
  } catch (err) {
    const status = (err as { status?: number }).status ?? 0;
    if (status === 400) {
      const text = String((err as Error).message ?? "").toLowerCase();
      throw failure(/safety|prohibited|policy/.test(text) ? "blocked" : "bad_input");
    }
    throw failure("unavailable");
  }
  return extractImage(interaction);
}

// ---------- DEMO mode ----------

const DEMO_TINTS: Record<string, { r: number; g: number; b: number }> = {
  peranakan: { r: 30, g: 160, b: 150 },
  "modern-botanical": { r: 90, g: 150, b: 90 },
  chinese: { r: 190, g: 30, b: 40 },
  "malay-pelamin": { r: 200, g: 160, b: 60 },
  "indian-vivaha": { r: 235, g: 140, b: 20 },
  "fusion-chinese-malay": { r: 195, g: 95, b: 50 },
  "fusion-chinese-indian": { r: 215, g: 85, b: 30 },
  "fusion-malay-indian": { r: 220, g: 150, b: 40 },
};

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/**
 * DEMO render (no API key): the real room photo with a colour wash for the
 * theme and a clear label. It is not an AI image and says so on the picture.
 */
export async function generateDemo(args: { room: ImageInput; themeId: string; themeLabel: string; itemNames: string[] }): Promise<GeneratedImage> {
  let base: Sharp;
  let meta: Metadata;
  try {
    base = sharp(args.room.data).rotate().resize({ width: 1024, height: 1024, fit: "inside" });
    const buf = await base.toBuffer();
    base = sharp(buf);
    meta = await base.metadata();
  } catch {
    throw failure("bad_input");
  }
  const width = meta.width ?? 1024;
  const height = meta.height ?? 768;
  const tint = DEMO_TINTS[args.themeId] ?? { r: 184, g: 76, b: 96 };
  const items = args.itemNames.length ? args.itemNames.slice(0, 6).join(" · ") + (args.itemNames.length > 6 ? ` · +${args.itemNames.length - 6} more` : "") : "No items selected";
  const font = "Arial, Helvetica, sans-serif";
  // Right-aligned: the before/after slider shows this half of the image first.
  const right = width - 28;
  const label = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${height - 150}" width="${width}" height="150" fill="rgba(20,16,18,0.78)"/>
      <text x="${right}" y="${height - 104}" text-anchor="end" font-family="${font}" font-size="30" font-weight="700" fill="#ffffff">DEMO PREVIEW · not an AI render</text>
      <text x="${right}" y="${height - 66}" text-anchor="end" font-family="${font}" font-size="24" fill="#ffffff">Theme: ${xml(args.themeLabel)}</text>
      <text x="${right}" y="${height - 32}" text-anchor="end" font-family="${font}" font-size="20" fill="#e8dcd4">${xml(items)}</text>
    </svg>`,
  );
  const bytes = await base
    .composite([
      { input: { create: { width, height, channels: 4, background: { ...tint, alpha: 0.38 } } }, blend: "over" },
      { input: label, top: 0, left: 0 },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
  return { bytes, mimeType: "image/jpeg" };
}

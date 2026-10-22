import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { extractImage, generateDemo, RenderFailure } from "./generators.js";

// Shapes mirror the Interactions API response (steps of type "model_output").
const png1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

describe("extractImage", () => {
  it("returns the image from a model_output step", () => {
    const img = extractImage({
      status: "completed",
      steps: [
        { type: "thought" },
        { type: "model_output", content: [{ type: "text" }, { type: "image", data: png1x1.toString("base64"), mime_type: "image/jpeg" }] },
      ],
    });
    expect(img.bytes.equals(png1x1)).toBe(true);
  });

  it("falls back to output_image", () => {
    const img = extractImage({ status: "completed", steps: [], output_image: { type: "image", data: png1x1.toString("base64") } });
    expect(img.bytes.length).toBe(png1x1.length);
  });

  it("reports a safety block as 'blocked'", () => {
    try {
      extractImage({ status: "failed", steps: [{ type: "model_output", error: { message: "Response blocked: IMAGE_SAFETY" } }] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(RenderFailure);
      expect((e as RenderFailure).reason).toBe("blocked");
      expect((e as RenderFailure).message).toMatch(/different theme/);
    }
  });

  it("reports text-only output as 'no_image'", () => {
    expect(() => extractImage({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text" }] }] })).toThrow(/try again/);
  });
});

describe("generateDemo", () => {
  it("returns a labelled JPEG no larger than 1024px, from the real room photo", async () => {
    const room = await sharp({ create: { width: 2048, height: 1536, channels: 3, background: "#d9d2ca" } }).jpeg().toBuffer();
    const out = await generateDemo({ room: { data: room, mimeType: "image/jpeg" }, themeId: "chinese", themeLabel: "Chinese", itemNames: ["Floral arch"] });
    const meta = await sharp(out.bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([1024, 768]);
  });

  it("different themes give different images", async () => {
    const room = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#d9d2ca" } }).jpeg().toBuffer();
    const a = await generateDemo({ room: { data: room, mimeType: "image/jpeg" }, themeId: "chinese", themeLabel: "Chinese", itemNames: [] });
    const b = await generateDemo({ room: { data: room, mimeType: "image/jpeg" }, themeId: "peranakan", themeLabel: "Peranakan", itemNames: [] });
    expect(a.bytes.equals(b.bytes)).toBe(false);
  });

  it("refuses an unreadable photo", async () => {
    await expect(generateDemo({ room: { data: Buffer.from("nope"), mimeType: "image/jpeg" }, themeId: "chinese", themeLabel: "Chinese", itemNames: [] })).rejects.toMatchObject({
      reason: "bad_input",
    });
  });
});

"use client";

import { ITINERARY_SIZE, layoutItinerary, PALETTES, type ItineraryInput, type ItineraryStyle, type Palette } from "./layout";

/** The page's own fonts (next/font names), so the image matches the site in every language. */
export function pageFonts(): { display: string; sans: string } {
  const css = getComputedStyle(document.documentElement);
  const display = css.getPropertyValue("--font-display").trim() || "Georgia, serif";
  const sans = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  return { display, sans };
}

/** Frame and corner ornaments for each style. Decorative only; all text comes from the layout. */
function decorate(ctx: CanvasRenderingContext2D, style: ItineraryStyle, p: Palette) {
  const { width: w, height: h } = ITINERARY_SIZE;
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.panel;
  ctx.fillRect(48, 48, w - 96, h - 96);
  ctx.strokeStyle = p.rule;
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, w - 96, h - 96);
  ctx.strokeRect(62, 62, w - 124, h - 124);

  const corners: Array<[number, number, number]> = [
    [62, 62, 0],
    [w - 62, 62, Math.PI / 2],
    [w - 62, h - 62, Math.PI],
    [62, h - 62, (3 * Math.PI) / 2],
  ];
  for (const [x, y, angle] of corners) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = p.accent;
    ctx.fillStyle = p.accent;
    ctx.lineWidth = 2.5;
    if (style === "botanical") {
      // A sprig: a curved stem with leaves.
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.quadraticCurveTo(70, 20, 120, 80);
      ctx.stroke();
      for (const [lx, ly, r] of [
        [40, 18, -0.5],
        [72, 36, -0.2],
        [98, 58, 0.2],
      ] as const) {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(r);
        ctx.beginPath();
        ctx.ellipse(0, -12, 7, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (style === "festive") {
      // A lattice corner with a small diamond.
      for (const d of [18, 34]) {
        ctx.beginPath();
        ctx.moveTo(d, 90);
        ctx.lineTo(d, d);
        ctx.lineTo(90, d);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(50, 40);
      ctx.lineTo(60, 50);
      ctx.lineTo(50, 60);
      ctx.lineTo(40, 50);
      ctx.closePath();
      ctx.fill();
    } else {
      // A classic flourish: two arcs and a dot.
      ctx.beginPath();
      ctx.arc(0, 0, 54, 0.15, Math.PI / 2 - 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0.3, Math.PI / 2 - 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(34, 34, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Draws the itinerary onto a canvas sized 1080 x 1620. Waits for the page fonts first. */
export async function drawItinerary(canvas: HTMLCanvasElement, input: Omit<ItineraryInput, "fonts">): Promise<{ fits: boolean }> {
  await document.fonts.ready;
  canvas.width = ITINERARY_SIZE.width;
  canvas.height = ITINERARY_SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { fits: false };
  const p = PALETTES[input.style];
  decorate(ctx, input.style, p);
  const measure = (text: string, font: string) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
  const layout = layoutItinerary({ ...input, fonts: pageFonts() }, measure);
  ctx.textBaseline = "alphabetic";
  for (const op of layout.ops) {
    if (op.kind === "text") {
      ctx.font = op.font;
      ctx.fillStyle = op.color;
      ctx.textAlign = op.align;
      ctx.fillText(op.text, op.x, op.y);
    } else if (op.kind === "line") {
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.width;
      ctx.beginPath();
      ctx.moveTo(op.x1, op.y1);
      ctx.lineTo(op.x2, op.y2);
      ctx.stroke();
    } else {
      ctx.fillStyle = op.color;
      ctx.beginPath();
      ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return { fits: layout.fits };
}

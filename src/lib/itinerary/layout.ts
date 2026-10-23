/**
 * The itinerary image: a portrait card (1080 x 1620) drawn in the browser
 * from the couple's approved timeline. Layout is pure (text is measured
 * through a function passed in), so it can be tested without a canvas, and
 * every time and word on the image is exactly what the couple approved.
 */
import type { TimelineEntry } from "@/lib/plans/model";

export const ITINERARY_STYLES = ["classic", "botanical", "festive"] as const;
export type ItineraryStyle = (typeof ITINERARY_STYLES)[number];

export const ITINERARY_SIZE = { width: 1080, height: 1620 } as const;
export const ITINERARY_TITLE_MAX = 80;

export interface Palette {
  background: string;
  panel: string;
  ink: string;
  muted: string;
  accent: string;
  rule: string;
}

/** Each style keeps text contrast at 4.5:1 or more against its background. */
export const PALETTES: Record<ItineraryStyle, Palette> = {
  classic: { background: "#FBF7F2", panel: "#FFFFFF", ink: "#2B2320", muted: "#5E534D", accent: "#8C6A35", rule: "#D9C7A7" },
  botanical: { background: "#F2F5EF", panel: "#FBFCF9", ink: "#1F2A22", muted: "#4A5A4D", accent: "#4D6B4A", rule: "#B9CBB4" },
  festive: { background: "#6E1A1F", panel: "#7C2228", ink: "#FBF0DC", muted: "#F0D9B5", accent: "#E2BE78", rule: "#B8894A" },
};

/** The theme's natural look: red and gold for Chinese and fusion themes, greenery for botanical. */
export function styleForTheme(themeId: string): ItineraryStyle {
  if (themeId === "chinese" || themeId.startsWith("fusion-")) return "festive";
  if (themeId === "modern-botanical") return "botanical";
  return "classic";
}

export type Measure = (text: string, font: string) => number;

/** Greedy word wrap; a single word longer than the line is broken by characters (for Chinese and long words). */
export function wrapText(text: string, font: string, maxWidth: number, measure: Measure): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const pushLong = (word: string) => {
    let part = "";
    for (const ch of word) {
      if (part && measure(part + ch, font) > maxWidth) {
        lines.push(part);
        part = ch;
      } else part += ch;
    }
    return part;
  };
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (measure(next, font) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = measure(w, font) <= maxWidth ? w : pushLong(w);
  }
  if (line) lines.push(line);
  return lines;
}

export interface ItineraryInput {
  title: string;
  subtitle: string;
  /** Venue and room, already joined. */
  place: string;
  /** Formatted for display, or "" without a date. */
  date: string;
  entries: TimelineEntry[];
  /** Small print at the bottom. */
  footer: string;
  style: ItineraryStyle;
  fonts: { display: string; sans: string };
}

export type DrawOp =
  | { kind: "text"; text: string; x: number; y: number; font: string; color: string; align: "left" | "center" | "right" }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { kind: "dot"; x: number; y: number; r: number; color: string };

export interface ItineraryLayout {
  ops: DrawOp[];
  /** Font size used for the entries after fitting. */
  entrySize: number;
  /** True if everything fitted; false only if even the smallest size overflows. */
  fits: boolean;
}

const MARGIN = 96;
const MIN_SIZE = 20;
/** Line height and the space between entries, as multiples of the text size. */
const LINE = 1.25;
const GAP = 0.7;
const HEADER_TOP = 170;

/**
 * Positions everything. Entry text starts at 34px and shrinks (to 20px at
 * the least) until the schedule fits between the header and the footer.
 */
export function layoutItinerary(input: ItineraryInput, measure: Measure): ItineraryLayout {
  const { width, height } = ITINERARY_SIZE;
  const p = PALETTES[input.style];
  const cx = width / 2;
  const ops: DrawOp[] = [];
  const text = (t: string, x: number, y: number, font: string, color: string, align: "left" | "center" | "right" = "center") =>
    ops.push({ kind: "text", text: t, x, y, font, color, align });

  // Header: subtitle, title (up to two lines), ornament, place and date.
  let y = HEADER_TOP;
  text(input.subtitle.toUpperCase(), cx, y, `600 26px ${input.fonts.sans}`, p.accent);
  y += 92;
  const titleFont = `500 72px ${input.fonts.display}`;
  const titleLines = wrapText(input.title, titleFont, width - MARGIN * 2, measure).slice(0, 2);
  for (const l of titleLines) {
    text(l, cx, y, titleFont, p.ink);
    y += 86;
  }
  y += 4;
  ops.push({ kind: "line", x1: cx - 150, y1: y, x2: cx - 22, y2: y, color: p.rule, width: 2 });
  ops.push({ kind: "dot", x: cx, y, r: 7, color: p.accent });
  ops.push({ kind: "line", x1: cx + 22, y1: y, x2: cx + 150, y2: y, color: p.rule, width: 2 });
  y += 62;
  for (const l of wrapText(input.place, `500 30px ${input.fonts.sans}`, width - MARGIN * 2, measure).slice(0, 2)) {
    text(l, cx, y, `500 30px ${input.fonts.sans}`, p.muted);
    y += 42;
  }
  if (input.date) {
    text(input.date, cx, y, `600 30px ${input.fonts.sans}`, p.ink);
    y += 42;
  }

  // Schedule: time on the left, a dot on the rule, the event on the right.
  const top = y + 48;
  const bottom = height - 190;
  const timeX = MARGIN + 116;
  const railX = timeX + 30;
  const textX = railX + 30;
  const textWidth = width - MARGIN - textX;
  let size = 34;
  let rows: Array<{ time: string; lines: string[] }> = [];
  let needed = 0;
  for (; size >= MIN_SIZE; size -= 2) {
    const font = `400 ${size}px ${input.fonts.sans}`;
    rows = input.entries.map((e) => ({ time: e.time, lines: wrapText(e.label, font, textWidth, measure) }));
    needed = rows.reduce((h, r) => h + r.lines.length * size * LINE + size * GAP, 0);
    if (needed <= bottom - top) break;
  }
  size = Math.max(size, MIN_SIZE);
  const fits = needed <= bottom - top;
  const lineH = size * LINE;
  const gap = size * GAP;
  // With room to spare, a quarter goes above the schedule and the rest below, so it sits close to the heading.
  let ry = top + Math.max(0, (bottom - top - needed) / 4) + size;
  const firstY = ry - size * 0.35;
  let lastY = firstY;
  for (const r of rows) {
    if (ry > bottom + size) break;
    text(r.time, timeX, ry, `700 ${size}px ${input.fonts.sans}`, p.accent, "right");
    ops.push({ kind: "dot", x: railX, y: ry - size * 0.35, r: Math.max(5, size * 0.2), color: p.accent });
    lastY = ry - size * 0.35;
    r.lines.forEach((l, i) => text(l, textX, ry + i * lineH, `400 ${size}px ${input.fonts.sans}`, p.ink, "left"));
    ry += r.lines.length * lineH + gap;
  }
  if (rows.length > 1) ops.unshift({ kind: "line", x1: railX, y1: firstY, x2: railX, y2: lastY, color: p.rule, width: 3 });

  // Footer.
  for (const [i, l] of wrapText(input.footer, `400 22px ${input.fonts.sans}`, width - MARGIN * 2, measure).slice(0, 2).entries()) {
    text(l, cx, height - 112 + i * 30, `400 22px ${input.fonts.sans}`, p.muted);
  }
  return { ops, entrySize: size, fits };
}

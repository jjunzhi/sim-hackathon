/**
 * A suggested floor plan for a plan: the stage at the top, a dance floor in
 * front of it, numbered round tables (one per table of guests, the nearest
 * to the stage first), a buffet line and dessert table when the menu needs
 * them, and the entrance at the bottom. Not to scale; the venue confirms the
 * real layout. Pure, so it is tested without a browser.
 */
import { tablesForHeadcount } from "@/lib/money";

export const PLAN_W = 1000;
export const PLAN_H = 700;

export interface FloorFeatures {
  /** The chosen stage piece's name (pelamin, mandap, backdrop...), or null for a plain stage. */
  stageItem: string | null;
  arch: boolean;
  buffet: boolean;
  dessert: boolean;
  solemnisation: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorTable {
  n: number;
  cx: number;
  cy: number;
  r: number;
  seats: number;
}

export interface FloorPlan {
  stage: Box;
  danceFloor: Box | null;
  buffet: Box | null;
  dessert: Box | null;
  solemnisation: Box | null;
  entrance: Box;
  tables: FloorTable[];
  tableCount: number;
  /** Tables that didn't fit the drawing (very large weddings): shown as a note, never dropped silently. */
  notDrawn: number;
}

const STAGE_NAMES = /pelamin|mandap|dais|stage|backdrop/i;

/** Which layout pieces the chosen items call for. */
export function featuresFrom(items: Array<{ name: string; category: string }>): FloorFeatures {
  const stage = items.find((i) => STAGE_NAMES.test(i.name) || /backdrop|stage/i.test(i.category));
  const food = items.filter((i) => i.category === "Food and drink");
  return {
    stageItem: stage?.name ?? null,
    arch: items.some((i) => /\barch\b/i.test(i.name)),
    buffet: food.some((i) => /buffet|grill|barbecue|thali/i.test(i.name)),
    dessert: food.some((i) => /dessert|kuih/i.test(i.name)),
    solemnisation: items.some((i) => /solemnisation/i.test(i.name)),
  };
}

const overlaps = (cx: number, cy: number, r: number, b: Box | null, pad: number) =>
  !!b && cx + r + pad > b.x && cx - r - pad < b.x + b.w && cy + r + pad > b.y && cy - r - pad < b.y + b.h;

export function layoutFloorPlan(args: { headcount: number; seatsPerTable: number; features: FloorFeatures }): FloorPlan {
  const seats = Math.max(1, args.seatsPerTable);
  const tableCount = tablesForHeadcount(args.headcount, seats);
  const f = args.features;

  const stage: Box = { x: PLAN_W / 2 - 190, y: 30, w: 380, h: 90 };
  const danceFloor: Box | null = tableCount >= 4 ? { x: PLAN_W / 2 - 130, y: stage.y + stage.h + 24, w: 260, h: 130 } : null;
  const buffet: Box | null = f.buffet ? { x: PLAN_W - 100, y: 150, w: 64, h: 380 } : null;
  const dessert: Box | null = f.dessert ? { x: PLAN_W - 100, y: buffet ? 548 : 300, w: 64, h: 70 } : null;
  const solemnisation: Box | null = f.solemnisation ? { x: stage.x - 150, y: stage.y + 14, w: 120, h: 60 } : null;
  const entrance: Box = { x: PLAN_W / 2 - 90, y: PLAN_H - 22, w: 180, h: 22 };

  // The area tables may use: below the stage, inside the walls, clear of the side pieces and the entrance.
  const area = { x0: 40, x1: (buffet || dessert ? PLAN_W - 120 : PLAN_W - 40), y0: stage.y + stage.h + 24, y1: PLAN_H - 70 };
  const blocked = [danceFloor, solemnisation];

  // The largest table size that fits every table; below the smallest size, draw what fits and say so.
  let placed: Array<{ cx: number; cy: number }> = [];
  let r = 44;
  for (; r >= 9; r -= 1) {
    const cell = 2 * r + Math.max(10, r * 0.55);
    const cols = Math.floor((area.x1 - area.x0) / cell);
    const rows = Math.floor((area.y1 - area.y0) / cell);
    const spots: Array<{ cx: number; cy: number }> = [];
    const offX = area.x0 + ((area.x1 - area.x0) - cols * cell) / 2 + cell / 2;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const cx = offX + col * cell;
        const cy = area.y0 + cell / 2 + row * cell;
        if (!blocked.some((b) => overlaps(cx, cy, r, b, 6))) spots.push({ cx, cy });
      }
    placed = spots;
    if (spots.length >= tableCount) break;
  }
  r = Math.max(r, 9);
  // Nearest the stage first: table 1 is the closest.
  const centre = PLAN_W / 2;
  placed.sort((a, b) => a.cy - b.cy || Math.abs(a.cx - centre) - Math.abs(b.cx - centre));
  const tables = placed.slice(0, tableCount).map((p, i) => ({ n: i + 1, cx: Math.round(p.cx), cy: Math.round(p.cy), r, seats }));

  return { stage, danceFloor, buffet, dessert, solemnisation, entrance, tables, tableCount, notDrawn: tableCount - tables.length };
}

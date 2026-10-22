import { tablesForHeadcount, DEFAULT_SEATS_PER_TABLE } from "./money";

export type CapacityStatus = "within" | "over" | "under";

export interface CapacityResult {
  status: CapacityStatus;
  tables: number;
  /** Seats left before the maximum (negative when over). */
  remaining: number;
}

export function checkCapacity(
  headcount: number,
  range: { min: number; max: number },
  seatsPerTable = DEFAULT_SEATS_PER_TABLE,
): CapacityResult {
  if (range.min > range.max) {
    throw new RangeError(`capacity min (${range.min}) must not exceed max (${range.max})`);
  }
  const tables = tablesForHeadcount(headcount, seatsPerTable);
  const status: CapacityStatus = headcount > range.max ? "over" : headcount < range.min ? "under" : "within";
  return { status, tables, remaining: range.max - headcount };
}

/**
 * Studio headcount slider: from half the room's minimum to 30% above its
 * maximum, so couples can see the warnings on both sides.
 */
export function sliderRange(range: { min: number; max: number }): { min: number; max: number } {
  return { min: Math.max(1, Math.floor(range.min / 2)), max: Math.ceil(range.max * 1.3) };
}

/** Keep a headcount inside the slider when the room changes. */
export function clampHeadcount(headcount: number, range: { min: number; max: number }): number {
  const r = sliderRange(range);
  return Math.min(r.max, Math.max(r.min, Math.round(headcount)));
}

/** "185 guests = 19 tables of 10" */
export function tablesLine(headcount: number, seatsPerTable = DEFAULT_SEATS_PER_TABLE): string {
  const tables = tablesForHeadcount(headcount, seatsPerTable);
  const guests = headcount === 1 ? "guest" : "guests";
  const tableWord = tables === 1 ? "table" : "tables";
  return `${headcount} ${guests} = ${tables} ${tableWord} of ${seatsPerTable}`;
}

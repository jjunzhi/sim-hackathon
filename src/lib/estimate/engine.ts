/**
 * Estimate engine. Pure: no Firebase, no formatting, no clock.
 *
 * Order of calculation (one estimate per vendor):
 *   (a) room rental for the chosen tier (venues only)
 *   (b) each selected line: per piece = price x quantity,
 *       per table = price x ceil(headcount / seatsPerTable), per guest = price x headcount
 *   (c) pre-tax subtotal = (a) + (b)
 *   (d) minimum spend: if the minimum-spend basis is below it, add a separate
 *       "shortfall" line; the amount used from here on includes it
 *   (e) service charge = amount x serviceChargeBps   (rounded half-up)
 *   (f) GST = (amount + service charge) x gstBps     (rounded half-up)
 *   (g) total, and per-guest price                   (rounded half-up)
 * A 0 bps rate omits that line and returns the vendor's note instead.
 */
import type { Category, Unit } from "@/lib/inventory/model";
import { applyBps, assertBps, assertCents, multiplyCents, perGuest, sumCents, tablesForHeadcount, type Bps, type Cents } from "@/lib/money";
import { INVENTORY_LIMITS } from "@/lib/inventory/model";

export class EstimateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EstimateError";
  }
}

export interface EstimateSelection {
  id: string;
  name: string;
  kind: "item" | "package";
  unit: Unit;
  priceCents: Cents;
  category?: Category;
  /** Per-piece only; defaults to 1. */
  quantity?: number;
  /** Packages only: the item ids the package already includes. */
  includesItemIds?: string[];
}

export interface EstimateTax {
  serviceChargeBps: Bps;
  gstBps: Bps;
  noServiceChargeNote: string;
  noGstNote: string;
}

export interface EstimateInput {
  headcount: number;
  seatsPerTable?: number;
  rental?: { label: string; amountCents: Cents } | null;
  /** null or undefined = no minimum spend for this tier. */
  minimumSpendCents?: Cents | null;
  selections: EstimateSelection[];
  tax: EstimateTax;
}

export interface RentalLine {
  kind: "rental";
  label: string;
  amountCents: Cents;
}

export interface SelectionLine {
  kind: "item" | "package";
  id: string;
  label: string;
  unit: Unit;
  category?: Category;
  unitPriceCents: Cents;
  /** How many units were charged: pieces, tables or guests. */
  count: number;
  amountCents: Cents;
}

export type PreTaxLine = RentalLine | SelectionLine;

export interface Estimate {
  headcount: number;
  seatsPerTable: number;
  tables: number;
  lines: PreTaxLine[];
  subtotalCents: Cents;
  /** Present only when a minimum is set and the basis falls below it. */
  minimumSpendShortfall: { minimumCents: Cents; basisCents: Cents; shortfallCents: Cents } | null;
  /** Subtotal plus any shortfall: what service charge and GST apply to. */
  chargeableCents: Cents;
  serviceCharge: { rateBps: Bps; amountCents: Cents } | null;
  gst: { rateBps: Bps; amountCents: Cents } | null;
  /** Vendor notes shown in place of omitted 0% lines. */
  notes: string[];
  totalCents: Cents;
  /** null when headcount is 0. */
  perGuestCents: Cents | null;
}

/**
 * What counts towards the minimum spend. The single place to change if a
 * vendor defines it differently (for example food and drink only).
 */
export function minimumSpendBasis(lines: readonly PreTaxLine[]): Cents {
  return sumCents(lines.map((l) => l.amountCents));
}

function countFor(sel: EstimateSelection, headcount: number, seatsPerTable: number): number {
  switch (sel.unit) {
    case "piece": {
      const q = sel.quantity ?? 1;
      if (!Number.isSafeInteger(q) || q < 1 || q > INVENTORY_LIMITS.quantityMax) {
        throw new EstimateError(`Quantity for "${sel.name}" must be a whole number from 1 to ${INVENTORY_LIMITS.quantityMax}`);
      }
      return q;
    }
    case "table":
      return tablesForHeadcount(headcount, seatsPerTable);
    case "guest":
      return headcount;
  }
}

function checkNoDoubleCounting(selections: readonly EstimateSelection[]) {
  const itemIds = new Set(selections.filter((s) => s.kind === "item").map((s) => s.id));
  const seen = new Set<string>();
  for (const s of selections) {
    const key = `${s.kind}:${s.id}`;
    if (seen.has(key)) throw new EstimateError(`"${s.name}" is selected twice`);
    seen.add(key);
    if (s.kind === "package") {
      const clash = (s.includesItemIds ?? []).find((id) => itemIds.has(id));
      if (clash) throw new EstimateError(`"${s.name}" already includes an item that is also selected on its own`);
    }
  }
}

export function calculateEstimate(input: EstimateInput): Estimate {
  const { headcount, selections, tax } = input;
  const seatsPerTable = input.seatsPerTable ?? 10;
  if (!Number.isSafeInteger(headcount) || headcount < 0) throw new EstimateError("Headcount must be a whole number, 0 or more");
  assertBps(tax.serviceChargeBps, "service charge");
  assertBps(tax.gstBps, "GST");
  checkNoDoubleCounting(selections);

  // (a) rental
  const lines: PreTaxLine[] = [];
  if (input.rental) {
    assertCents(input.rental.amountCents, "room rental");
    lines.push({ kind: "rental", label: input.rental.label, amountCents: input.rental.amountCents });
  }

  // (b) items and packages
  for (const sel of selections) {
    assertCents(sel.priceCents, `price of "${sel.name}"`);
    if (sel.priceCents < 0) throw new EstimateError(`Price of "${sel.name}" can't be negative`);
    const count = countFor(sel, headcount, seatsPerTable);
    lines.push({
      kind: sel.kind,
      id: sel.id,
      label: sel.name,
      unit: sel.unit,
      category: sel.category,
      unitPriceCents: sel.priceCents,
      count,
      amountCents: multiplyCents(sel.priceCents, count),
    });
  }

  // (c) subtotal
  const subtotalCents = sumCents(lines.map((l) => l.amountCents));

  // (d) minimum spend: shown as its own line, never folded in silently
  let minimumSpendShortfall: Estimate["minimumSpendShortfall"] = null;
  const minimum = input.minimumSpendCents ?? null;
  if (minimum !== null) {
    assertCents(minimum, "minimum spend");
    const basisCents = minimumSpendBasis(lines);
    if (basisCents < minimum) {
      minimumSpendShortfall = { minimumCents: minimum, basisCents, shortfallCents: minimum - basisCents };
    }
  }
  const chargeableCents = subtotalCents + (minimumSpendShortfall?.shortfallCents ?? 0);

  // (e) service charge, (f) GST - each rounded half-up
  const notes: string[] = [];
  const serviceAmount = applyBps(chargeableCents, tax.serviceChargeBps);
  const serviceCharge = tax.serviceChargeBps > 0 ? { rateBps: tax.serviceChargeBps, amountCents: serviceAmount } : null;
  if (!serviceCharge && tax.noServiceChargeNote.trim()) notes.push(tax.noServiceChargeNote.trim());

  const gstAmount = applyBps(chargeableCents + serviceAmount, tax.gstBps);
  const gst = tax.gstBps > 0 ? { rateBps: tax.gstBps, amountCents: gstAmount } : null;
  if (!gst && tax.noGstNote.trim()) notes.push(tax.noGstNote.trim());

  // (g) total and per guest
  const totalCents = chargeableCents + serviceAmount + gstAmount;

  return {
    headcount,
    seatsPerTable,
    tables: tablesForHeadcount(headcount, seatsPerTable),
    lines,
    subtotalCents,
    minimumSpendShortfall,
    chargeableCents,
    serviceCharge,
    gst,
    notes,
    totalCents,
    perGuestCents: perGuest(totalCents, headcount),
  };
}

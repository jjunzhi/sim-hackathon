/**
 * Money module. All amounts are integer SGD cents; all rates are basis points
 * (1 bps = 0.01%, so 900 bps = 9%). Rounding is half-up (half away from zero)
 * to the cent. Intermediate products use BigInt so large totals never lose
 * precision. Format only at the UI edge with formatSGD.
 */

export type Cents = number;
export type Bps = number;

export const BPS_DENOMINATOR = 10_000;
export const DEFAULT_SEATS_PER_TABLE = 10;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function assertCents(value: number, label = "amount"): asserts value is Cents {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a whole number of cents, got ${value}`);
  }
}

export function assertBps(value: number, label = "rate"): asserts value is Bps {
  if (!Number.isSafeInteger(value) || value < 0 || value > BPS_DENOMINATOR) {
    throw new MoneyError(`${label} must be an integer between 0 and ${BPS_DENOMINATOR} bps, got ${value}`);
  }
}

function toSafeNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new MoneyError(`${label} is too large to represent safely`);
  }
  return Number(value);
}

/** Integer division rounding half away from zero. */
export function divideRoundHalfUp(numerator: number, denominator: number): number {
  assertCents(numerator, "numerator");
  if (!Number.isSafeInteger(denominator) || denominator === 0) {
    throw new MoneyError(`denominator must be a non-zero integer, got ${denominator}`);
  }
  return toSafeNumber(divBig(BigInt(numerator), BigInt(denominator)), "quotient");
}

function divBig(n: bigint, d: bigint): bigint {
  const negative = n < 0n !== d < 0n;
  const absN = n < 0n ? -n : n;
  const absD = d < 0n ? -d : d;
  const q = (absN * 2n + absD) / (absD * 2n);
  return negative ? -q : q;
}

/** amount x rate, rounded half-up to the cent. */
export function applyBps(amount: Cents, rate: Bps): Cents {
  assertCents(amount);
  assertBps(rate);
  return toSafeNumber(divBig(BigInt(amount) * BigInt(rate), BigInt(BPS_DENOMINATOR)), "result");
}

/** unit price x quantity (quantity must be a non-negative integer). */
export function multiplyCents(unitPrice: Cents, quantity: number): Cents {
  assertCents(unitPrice, "unit price");
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new MoneyError(`quantity must be a non-negative integer, got ${quantity}`);
  }
  return toSafeNumber(BigInt(unitPrice) * BigInt(quantity), "result");
}

export function sumCents(amounts: readonly Cents[]): Cents {
  let total = 0n;
  for (const a of amounts) {
    assertCents(a);
    total += BigInt(a);
  }
  return toSafeNumber(total, "sum");
}

/** Number of tables needed to seat everyone. 0 guests -> 0 tables. */
export function tablesForHeadcount(headcount: number, seatsPerTable = DEFAULT_SEATS_PER_TABLE): number {
  if (!Number.isSafeInteger(headcount) || headcount < 0) {
    throw new MoneyError(`headcount must be a non-negative integer, got ${headcount}`);
  }
  if (!Number.isSafeInteger(seatsPerTable) || seatsPerTable <= 0) {
    throw new MoneyError(`seats per table must be a positive integer, got ${seatsPerTable}`);
  }
  return Math.ceil(headcount / seatsPerTable);
}

/** Per-guest price, rounded half-up. Returns null when there are no guests. */
export function perGuest(total: Cents, headcount: number): Cents | null {
  assertCents(total, "total");
  if (!Number.isSafeInteger(headcount) || headcount < 0) {
    throw new MoneyError(`headcount must be a non-negative integer, got ${headcount}`);
  }
  if (headcount === 0) return null;
  return divideRoundHalfUp(total, headcount);
}

/**
 * Parse a user-typed dollar string ("1,234.5", "$80", "0.05") into cents
 * without floating point. Returns null for anything that is not a valid
 * non-negative amount with at most two decimal places.
 */
export function parseDollarsToCents(input: string): Cents | null {
  const cleaned = input.trim().replace(/^S?\$/i, "").replace(/,/g, "").trim();
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  const dollars = match?.[1];
  if (!match || dollars === undefined) return null;
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const cents = BigInt(dollars) * 100n + BigInt(fraction || "0");
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(cents);
}

const formatters = new Map<string, Intl.NumberFormat>();

/** UI-only formatting. Never feed the result back into calculations. */
export function formatSGD(amount: Cents, options: { locale?: string; showCents?: boolean } = {}): string {
  assertCents(amount);
  const { locale = "en-SG", showCents = true } = options;
  const key = `${locale}|${showCents}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "SGD",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
    formatters.set(key, fmt);
  }
  // Division by 100 for display only; exact for safe integers at 2 dp.
  const value = showCents ? amount / 100 : divideRoundHalfUp(amount, 100);
  return fmt.format(value);
}

/** "9%" / "10%" / "8.25%" for display. */
export function formatBps(rate: Bps): string {
  assertBps(rate);
  const whole = Math.trunc(rate / 100);
  const frac = rate % 100;
  if (frac === 0) return `${whole}%`;
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}%`;
}

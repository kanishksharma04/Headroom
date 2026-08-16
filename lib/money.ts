import Decimal from "decimal.js";

/**
 * The money type used everywhere in application code. A thin semantic
 * alias over decimal.js's Decimal — never a JavaScript `number`.
 */
export type Money = Decimal;

export function toMoney(value: Decimal.Value): Money {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function add(a: Decimal.Value, b: Decimal.Value): Money {
  return toMoney(a).plus(toMoney(b));
}

export function subtract(a: Decimal.Value, b: Decimal.Value): Money {
  return toMoney(a).minus(toMoney(b));
}

export function multiply(a: Decimal.Value, b: Decimal.Value): Money {
  return toMoney(a).times(toMoney(b));
}

export function divide(a: Decimal.Value, b: Decimal.Value): Money {
  return toMoney(a).div(toMoney(b));
}

/** -1 if a < b, 0 if equal, 1 if a > b. */
export function compare(a: Decimal.Value, b: Decimal.Value): -1 | 0 | 1 {
  return toMoney(a).comparedTo(toMoney(b)) as -1 | 0 | 1;
}

export function isZero(a: Decimal.Value): boolean {
  return toMoney(a).isZero();
}

export function isNegative(a: Decimal.Value): boolean {
  return toMoney(a).isNegative() && !toMoney(a).isZero();
}

export function isPositive(a: Decimal.Value): boolean {
  return toMoney(a).isPositive() && !toMoney(a).isZero();
}

export function sum(values: Decimal.Value[]): Money {
  return values.reduce((total: Money, value) => total.plus(toMoney(value)), new Decimal(0));
}

export function min(a: Decimal.Value, b: Decimal.Value): Money {
  return Decimal.min(toMoney(a), toMoney(b));
}

export function max(a: Decimal.Value, b: Decimal.Value): Money {
  return Decimal.max(toMoney(a), toMoney(b));
}

/**
 * Rounds to the given number of decimal places using ROUND_HALF_UP.
 * Per the project's money rules, this belongs only at display or
 * settlement — never applied mid-calculation, where it would compound
 * rounding error across a chain of arithmetic.
 */
export function roundCurrency(value: Decimal.Value, decimalPlaces = 2): Money {
  return toMoney(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
}

/**
 * Splits `total` proportionally across `ratios` so the parts sum back to
 * exactly `total` — no leftover paise, regardless of rounding. Uses the
 * largest-remainder method at the given minor-unit precision (2 decimal
 * places, i.e. paise, by default): each share is floored, and the leftover
 * minor units are handed out one at a time to the shares with the largest
 * truncated remainder.
 */
export function allocate(
  total: Decimal.Value,
  ratios: Decimal.Value[],
  decimalPlaces = 2,
): Money[] {
  if (ratios.length === 0) {
    return [];
  }

  const ratioDecimals = ratios.map(toMoney);
  const ratioSum = sum(ratioDecimals);
  if (ratioSum.isZero()) {
    throw new Error("allocate: ratios must not sum to zero");
  }

  const unit = new Decimal(10).pow(-decimalPlaces);
  const totalMinorUnits = toMoney(total).div(unit).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const rawShares = ratioDecimals.map((ratio) => totalMinorUnits.times(ratio).div(ratioSum));
  const flooredShares = rawShares.map((share) => share.toDecimalPlaces(0, Decimal.ROUND_DOWN));
  const remainders = rawShares.map((share, i) => share.minus(flooredShares[i]));

  const allocatedMinorUnits = sum(flooredShares);
  const leftoverMinorUnits = totalMinorUnits.minus(allocatedMinorUnits).toNumber();

  const orderByLargestRemainder = remainders
    .map((remainder, index) => ({ index, remainder }))
    .sort((a, b) => b.remainder.comparedTo(a.remainder))
    .map(({ index }) => index);

  const finalMinorUnits = [...flooredShares];
  for (let k = 0; k < leftoverMinorUnits; k++) {
    const index = orderByLargestRemainder[k % orderByLargestRemainder.length];
    finalMinorUnits[index] = finalMinorUnits[index].plus(1);
  }

  return finalMinorUnits.map((minorUnits) => minorUnits.times(unit));
}

/**
 * Serialises a money value to a string for storage or transport, at the
 * database's Decimal(18,4) precision by default. Never serialise via a
 * JavaScript number.
 */
export function serializeMoney(value: Decimal.Value, decimalPlaces = 4): string {
  return toMoney(value).toFixed(decimalPlaces);
}

export function parseMoney(value: string): Money {
  return new Decimal(value);
}

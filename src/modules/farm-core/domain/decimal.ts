/**
 * Decimal arithmetic and precision utilities for PalmTrack.
 *
 * Money across TypeScript / server boundary is canonical decimal string with 2 places ("0.00").
 * Quantities, weights, and land areas use 3 decimal places ("0.000").
 * JavaScript floating-point binary operations are avoided to prevent rounding errors.
 */

const ZERO_BIGINT = BigInt(0);
const ONE_BIGINT = BigInt(1);
const TWO_BIGINT = BigInt(2);
const TEN_BIGINT = BigInt(10);

/**
 * Validates and normalizes a string or number into a canonical decimal string with fixed decimal places.
 * Returns null if the value is invalid or has more decimal digits than allowed precision.
 */
export function parseDecimal(value: string | number, precision: number): string | null {
  if (value === null || value === undefined) return null;
  const str = typeof value === "number" ? value.toString() : value.trim();
  if (str === "") return null;

  const match = str.match(/^(-)?(\d+)?(?:\.(\d*))?$/u);
  if (!match) return null;

  const isNegative = match[1] === "-";
  let integerPart = match[2] ?? "";
  let fractionalPart = match[3] ?? "";

  if (integerPart === "" && fractionalPart === "") return null;
  if (integerPart === "") integerPart = "0";

  // Check precision limit: do not silently truncate input with extra precision
  if (fractionalPart.length > precision) return null;

  // Pad fractional part with zeros up to precision
  while (fractionalPart.length < precision) {
    fractionalPart += "0";
  }

  // Remove leading zeros from integerPart except single zero
  integerPart = integerPart.replace(/^0+(?=\d)/u, "");
  if (integerPart === "") integerPart = "0";

  const result = precision > 0 ? `${integerPart}.${fractionalPart}` : integerPart;
  return isNegative && result !== "0.00" && result !== "0.000" && result !== "0"
    ? `-${result}`
    : result;
}

export function toCanonicalDecimal(value: string | number, precision: number): string {
  const parsed = parseDecimal(value, precision);
  if (parsed !== null) return parsed;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return precision === 2 ? "0.00" : "0.000";
  return num.toFixed(precision);
}

/** Converts a decimal string to scaled BigInt for exact integer arithmetic. */
function toScaledBigInt(value: string, scale: number): bigint {
  const isNegative = value.startsWith("-");
  const clean = isNegative ? value.slice(1) : value;
  const [intPart = "0", fracPart = ""] = clean.split(".");
  const paddedFrac = (fracPart + "0".repeat(scale)).slice(0, scale);
  const combined = BigInt(intPart + paddedFrac);
  return isNegative ? -combined : combined;
}

function fromScaledBigInt(value: bigint, scale: number): string {
  const isNegative = value < ZERO_BIGINT;
  const absVal = isNegative ? -value : value;
  const divisor = TEN_BIGINT ** BigInt(scale);
  const intPart = (absVal / divisor).toString();
  const fracPart = (absVal % divisor).toString().padStart(scale, "0");
  const result = scale > 0 ? `${intPart}.${fracPart}` : intPart;
  return isNegative ? `-${result}` : result;
}

export function addDecimals(a: string, b: string, precision = 2): string {
  const scale = Math.max(precision, 6);
  const valA = toScaledBigInt(a, scale);
  const valB = toScaledBigInt(b, scale);
  const sum = valA + valB;
  const raw = fromScaledBigInt(sum, scale);
  return toCanonicalDecimal(raw, precision);
}

export function subtractDecimals(a: string, b: string, precision = 2): string {
  const scale = Math.max(precision, 6);
  const valA = toScaledBigInt(a, scale);
  const valB = toScaledBigInt(b, scale);
  const diff = valA - valB;
  const raw = fromScaledBigInt(diff, scale);
  return toCanonicalDecimal(raw, precision);
}

/**
 * Multiplies two decimal strings and rounds half-up to target precision.
 * e.g. multiplyDecimals("10.000", "1000.00", 2) => "10000.00"
 */
export function multiplyDecimals(qty: string, price: string, resultPrecision = 2): string {
  const scaleA = 6;
  const scaleB = 6;
  const valA = toScaledBigInt(qty, scaleA);
  const valB = toScaledBigInt(price, scaleB);
  const product = valA * valB; // product has scale scaleA + scaleB = 12

  const totalScale = scaleA + scaleB;
  const targetScale = resultPrecision;
  const diffScale = totalScale - targetScale;

  if (diffScale <= 0) {
    return fromScaledBigInt(product, totalScale);
  }

  // Half-up rounding
  const isNegative = product < ZERO_BIGINT;
  const absProduct = isNegative ? -product : product;
  const divisor = TEN_BIGINT ** BigInt(diffScale);
  const remainder = absProduct % divisor;
  const halfDivisor = divisor / TWO_BIGINT;

  let rounded = absProduct / divisor;
  if (remainder >= halfDivisor) {
    rounded += ONE_BIGINT;
  }

  const finalVal = isNegative ? -rounded : rounded;
  return fromScaledBigInt(finalVal, targetScale);
}

export function compareDecimals(a: string, b: string): number {
  const scale = 6;
  const valA = toScaledBigInt(a, scale);
  const valB = toScaledBigInt(b, scale);
  if (valA > valB) return 1;
  if (valA < valB) return -1;
  return 0;
}

export function isNonNegativeDecimal(value: string): boolean {
  const scale = 6;
  try {
    return toScaledBigInt(value, scale) >= ZERO_BIGINT;
  } catch {
    return false;
  }
}

export function isPositiveDecimal(value: string): boolean {
  const scale = 6;
  try {
    return toScaledBigInt(value, scale) > ZERO_BIGINT;
  } catch {
    return false;
  }
}

/**
 * Presentation formatter for Thai currency strings with thousands separators and 2 decimal places.
 * e.g. "12345.50" => "12,345.50"
 */
export function formatMoney(value: string | number): string {
  const canonical = toCanonicalDecimal(value, 2);
  const isNegative = canonical.startsWith("-");
  const clean = isNegative ? canonical.slice(1) : canonical;
  const [intPart, fracPart] = clean.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  const result = `${formattedInt}.${fracPart}`;
  return isNegative ? `-${result}` : result;
}

/**
 * Presentation formatter for quantities and weights with 3 decimal places.
 * e.g. "1234.500" => "1,234.500"
 */
export function formatQuantity(value: string | number): string {
  const canonical = toCanonicalDecimal(value, 3);
  const isNegative = canonical.startsWith("-");
  const clean = isNegative ? canonical.slice(1) : canonical;
  const [intPart, fracPart] = clean.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  const result = `${formattedInt}.${fracPart}`;
  return isNegative ? `-${result}` : result;
}

export function formatArea(value: string | number): string {
  return formatQuantity(value);
}

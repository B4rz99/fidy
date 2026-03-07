/**
 * Strips non-digit characters and caps at 8 digits for amount input.
 */
export function cleanDigitInput(text: string): string {
  return text.replace(/[^0-9]/g, "").slice(0, 8);
}

/**
 * Formats a raw digit string (e.g. "4520") into a dollar display string (e.g. "$45.20").
 * Assumes the last 2 digits are always cents.
 */
export function formatAmount(digits: string): string {
  const cleaned = digits.replace(/[^0-9]/g, "");
  if (cleaned.length === 0) return "$0.00";

  const padded = cleaned.padStart(3, "0");
  const cents = padded.slice(-2);
  const dollars = padded.slice(0, -2).replace(/^0+/, "") || "0";

  const withCommas = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${cents}`;
}

/**
 * Converts a formatted amount string back to cents (integer).
 * "$45.20" → 4520
 */
export function amountToCents(formatted: string): number {
  const cleaned = formatted.replace(/[^0-9]/g, "");
  return Number.parseInt(cleaned, 10) || 0;
}

/**
 * Converts cents to a formatted display string.
 * 4520 → "$45.20"
 */
export function centsToDisplay(cents: number): string {
  return formatAmount(String(cents));
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Formats cents as a currency string using Intl (no decimals for COP).
 * 6740000 → "$67,400"
 */
export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/** @deprecated Use formatCents instead — both are now identical (no decimals for COP). */
export const formatCentsRounded = formatCents;

/**
 * Formats cents as a signed currency string (no decimals for COP).
 * (6740000, "expense") → "-$67,400"
 */
export function formatSignedAmount(cents: number, type: "expense" | "income"): string {
  const formatted = currencyFormatter.format(cents / 100);
  return type === "income" ? `+${formatted}` : `-${formatted}`;
}

import { parseDigitsToAmount } from "@/shared/lib";

/** Convert display digits to an amount for filter, or null if empty. */
export function amountDigitsToAmount(digits: string): number | null {
  if (digits.length === 0) return null;
  return parseDigitsToAmount(digits);
}

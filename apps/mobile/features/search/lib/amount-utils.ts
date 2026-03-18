import { digitsToCents } from "@/features/transactions";

/** Convert display digits to cents for filter, or null if empty. */
export function amountDigitsToCents(digits: string): number | null {
  if (digits.length === 0) return null;
  return digitsToCents(digits);
}

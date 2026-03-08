/**
 * Normalizes a merchant name for comparison and caching.
 * Lowercases, trims, and collapses internal whitespace.
 */
export function normalizeMerchant(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Normalizes a merchant name for comparison and caching.
 * Lowercases, trims, and collapses internal whitespace.
 */
export function normalizeMerchant(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

const MIN_SUBSTRING_LENGTH = 3;

/**
 * Checks whether two normalized merchant names refer to the same merchant.
 * Exact equality always matches. Substring containment matches only when
 * both strings are at least MIN_SUBSTRING_LENGTH characters, preventing
 * spurious matches on very short or empty strings.
 */
export function merchantsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < MIN_SUBSTRING_LENGTH || b.length < MIN_SUBSTRING_LENGTH) return false;
  return a.includes(b) || b.includes(a);
}

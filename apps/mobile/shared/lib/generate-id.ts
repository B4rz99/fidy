/** Pure ID builder — all inputs explicit. */
export function buildId(prefix: string, timestamp: number, entropy: string): string {
  return `${prefix}-${timestamp}-${entropy}`;
}

/** Convenience wrapper — impure by design (ID generation requires uniqueness). */
export function generateId(prefix: string): string {
  return buildId(prefix, Date.now(), Math.random().toString(36).slice(2, 7));
}

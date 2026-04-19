export function isMissingSqliteTableError(error: unknown): boolean {
  return error instanceof Error && /no such table:?/i.test(error.message);
}

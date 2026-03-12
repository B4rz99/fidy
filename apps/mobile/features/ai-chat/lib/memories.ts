import type { ExtractedMemory, UserMemory } from "../schema";

export function deduplicateMemories(
  existing: readonly UserMemory[],
  newFacts: readonly ExtractedMemory[]
): readonly ExtractedMemory[] {
  const existingLower = new Set(existing.map((m) => m.fact.toLowerCase()));
  return newFacts.reduce<{ seen: ReadonlySet<string>; result: readonly ExtractedMemory[] }>(
    (acc, f) => {
      const lower = f.fact.toLowerCase();
      if (existingLower.has(lower) || acc.seen.has(lower)) return acc;
      return {
        seen: new Set([...acc.seen, lower]),
        result: [...acc.result, f],
      };
    },
    { seen: new Set<string>(), result: [] }
  ).result;
}

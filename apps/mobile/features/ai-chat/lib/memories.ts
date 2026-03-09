import type { ExtractedMemory, UserMemory } from "../schema";

export function deduplicateMemories(
  existing: readonly UserMemory[],
  newFacts: readonly ExtractedMemory[]
): readonly ExtractedMemory[] {
  const existingLower = new Set(existing.map((m) => m.fact.toLowerCase()));
  const seen = new Set<string>();
  return newFacts.filter((f) => {
    const lower = f.fact.toLowerCase();
    if (existingLower.has(lower) || seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

import type { ExtractedMemory, UserMemory } from "../schema";

export function deduplicateMemories(
  existing: readonly UserMemory[],
  newFacts: readonly ExtractedMemory[]
): readonly ExtractedMemory[] {
  const existingLower = new Set(existing.map((m) => m.fact.toLowerCase()));
  return newFacts.filter((f) => !existingLower.has(f.fact.toLowerCase()));
}

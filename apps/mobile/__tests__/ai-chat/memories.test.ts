import { describe, expect, it } from "vitest";
import { deduplicateMemories } from "../../features/ai-chat/lib/memories";
import type { ExtractedMemory, UserMemory } from "../../features/ai-chat/schema";

const NOW = new Date(2026, 2, 5).toISOString();

const makeMemory = (fact: string): UserMemory => ({
  id: "mem_1",
  userId: "u1",
  fact,
  category: "habit",
  createdAt: NOW,
  updatedAt: NOW,
});

describe("deduplicateMemories", () => {
  it("filters out facts that already exist (case-insensitive)", () => {
    const existing: readonly UserMemory[] = [
      makeMemory("Gets paid on the 15th"),
      makeMemory("Prefers to eat out"),
    ];
    const newFacts: readonly ExtractedMemory[] = [
      { fact: "gets paid on the 15th", category: "habit" },
      { fact: "Has a car loan", category: "situation" },
    ];

    const result = deduplicateMemories(existing, newFacts);

    expect(result).toEqual([{ fact: "Has a car loan", category: "situation" }]);
  });

  it("keeps genuinely new facts", () => {
    const existing: readonly UserMemory[] = [makeMemory("Gets paid on the 15th")];
    const newFacts: readonly ExtractedMemory[] = [
      { fact: "Works from home", category: "situation" },
      { fact: "Trying to save for vacation", category: "goal" },
    ];

    const result = deduplicateMemories(existing, newFacts);

    expect(result).toEqual([
      { fact: "Works from home", category: "situation" },
      { fact: "Trying to save for vacation", category: "goal" },
    ]);
  });

  it("handles empty existing memories", () => {
    const newFacts: readonly ExtractedMemory[] = [{ fact: "New fact", category: "preference" }];

    const result = deduplicateMemories([], newFacts);

    expect(result).toEqual([{ fact: "New fact", category: "preference" }]);
  });

  it("handles empty new facts", () => {
    const existing: readonly UserMemory[] = [makeMemory("Existing fact")];

    const result = deduplicateMemories(existing, []);

    expect(result).toEqual([]);
  });

  it("handles both empty", () => {
    expect(deduplicateMemories([], [])).toEqual([]);
  });

  it("deduplicates within newFacts batch", () => {
    const newFacts: readonly ExtractedMemory[] = [
      { fact: "Works from home", category: "situation" },
      { fact: "works from home", category: "situation" },
      { fact: "Has a dog", category: "preference" },
    ];

    const result = deduplicateMemories([], newFacts);

    expect(result).toEqual([
      { fact: "Works from home", category: "situation" },
      { fact: "Has a dog", category: "preference" },
    ]);
  });
});

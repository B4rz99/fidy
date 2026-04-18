import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractMemoriesFromConversation,
  listUserMemories,
  softDeleteUserMemory,
  toUserMemory,
} from "@/features/ai-chat/data/user-memories";
import { getSupabase } from "@/shared/db";
import type { UserId, UserMemoryId } from "@/shared/types/branded";

vi.mock("@/shared/db", () => ({
  getSupabase: vi.fn(),
}));

const mockIs = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockInvoke = vi.fn();
const userId = "user-1" as UserId;

function makeUserMemoryRow(
  overrides: { id?: string; fact?: string; category?: string; createdAt?: string } = {}
) {
  return {
    id: overrides.id ?? "memory-1",
    fact: overrides.fact ?? "Likes coffee",
    category: overrides.category ?? "preference",
    // biome-ignore lint/style/useNamingConvention: Supabase row shape
    created_at: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  mockOrder.mockReset();
  mockIs.mockReset().mockReturnValue({ order: mockOrder });
  mockSelect.mockReset().mockReturnValue({ is: mockIs });
  mockEq.mockReset();
  mockUpdate.mockReset().mockReturnValue({ eq: mockEq });
  mockInvoke.mockReset();
  vi.mocked(getSupabase).mockReturnValue({
    from: vi.fn((table: string) =>
      table === "user_memories"
        ? { select: mockSelect, update: mockUpdate }
        : { select: mockSelect }
    ),
    functions: { invoke: mockInvoke },
  } as never);
});

describe("toUserMemory", () => {
  it("maps a Supabase row to UserMemory", () => {
    expect(toUserMemory(makeUserMemoryRow(), userId)).toEqual({
      id: "memory-1",
      userId,
      fact: "Likes coffee",
      category: "preference",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("listUserMemories", () => {
  it("returns newest-first mapped memories", async () => {
    mockOrder.mockResolvedValue({
      data: [
        makeUserMemoryRow({
          id: "memory-2",
          fact: "Wants to save",
          category: "goal",
          createdAt: "2026-01-02T00:00:00Z",
        }),
        makeUserMemoryRow(),
      ],
      error: null,
    });

    await expect(listUserMemories(userId)).resolves.toEqual([
      {
        id: "memory-2",
        userId,
        fact: "Wants to save",
        category: "goal",
        createdAt: "2026-01-02T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
      },
      {
        id: "memory-1",
        userId,
        fact: "Likes coffee",
        category: "preference",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("throws on Supabase error", async () => {
    const error = new Error("db fail");
    mockOrder.mockResolvedValue({ data: null, error });

    await expect(listUserMemories(userId)).rejects.toBe(error);
  });
});

describe("softDeleteUserMemory", () => {
  it("issues deleted_at update", async () => {
    mockEq.mockResolvedValue({ error: null });

    await softDeleteUserMemory("memory-1" as UserMemoryId);

    expect(mockUpdate).toHaveBeenCalledWith(
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      expect.objectContaining({ deleted_at: expect.any(String) })
    );
    expect(mockEq).toHaveBeenCalledWith("id", "memory-1");
  });

  it("throws on update error", async () => {
    const error = new Error("update fail");
    mockEq.mockResolvedValue({ error });

    await expect(softDeleteUserMemory("memory-1" as UserMemoryId)).rejects.toBe(error);
  });
});

describe("extractMemoriesFromConversation", () => {
  it("maps extracted memories to UserMemory", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        data: [makeUserMemoryRow({ fact: "Prefers dark mode" })],
      },
      error: null,
    });

    await expect(
      extractMemoriesFromConversation(userId, [{ role: "user", content: "I like dark mode" }])
    ).resolves.toEqual([
      {
        id: "memory-1",
        userId,
        fact: "Prefers dark mode",
        category: "preference",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("throws on function error", async () => {
    const error = new Error("invoke fail");
    mockInvoke.mockResolvedValue({ data: null, error });

    await expect(
      extractMemoriesFromConversation(userId, [{ role: "user", content: "Hello" }])
    ).rejects.toBe(error);
  });

  it("throws when response is not successful", async () => {
    mockInvoke.mockResolvedValue({ data: { success: false, data: [] }, error: null });

    await expect(
      extractMemoriesFromConversation(userId, [{ role: "user", content: "Hello" }])
    ).rejects.toThrow("extract_memories_failed");
  });
});

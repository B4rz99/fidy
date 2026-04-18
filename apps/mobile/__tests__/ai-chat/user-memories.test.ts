// biome-ignore-all lint/style/useNamingConvention: Supabase payload fixtures use snake_case
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/shared/db", () => ({
  getSupabase: vi.fn(),
}));

import {
  extractMemoriesFromConversation,
  listUserMemories,
  softDeleteUserMemory,
  toUserMemory,
} from "@/features/ai-chat/data/user-memories";
import { getSupabase } from "@/shared/db";
import type { UserId, UserMemoryId } from "@/shared/types/branded";

const mockSelect = vi.fn();
const mockEqSelect = vi.fn();
const mockIs = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();
const mockEqUpdate = vi.fn();
const mockInvoke = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === "user_memories") {
    return {
      select: mockSelect.mockReturnValue({
        eq: mockEqSelect.mockReturnValue({ is: mockIs.mockReturnValue({ order: mockOrder }) }),
      }),
      update: mockUpdate.mockReturnValue({ eq: mockEqUpdate }),
    };
  }

  throw new Error(`Unexpected table ${table}`);
});

describe("user memories remote adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
      functions: { invoke: mockInvoke },
    } as never);
  });

  test("maps a Supabase row to UserMemory", () => {
    const result = toUserMemory({
      id: "memory-1",
      user_id: "user-1",
      fact: "Prefers cash envelopes",
      category: "preference",
      created_at: "2026-03-05T10:00:00Z",
      updated_at: "2026-03-06T10:00:00Z",
    });

    expect(result).toEqual({
      id: "memory-1",
      userId: "user-1",
      fact: "Prefers cash envelopes",
      category: "preference",
      createdAt: "2026-03-05T10:00:00Z",
      updatedAt: "2026-03-06T10:00:00Z",
    });
  });

  test("fetches newest-first remote memories", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "memory-2",
          user_id: "user-1",
          fact: "Has a travel goal",
          category: "goal",
          created_at: "2026-03-06T10:00:00Z",
          updated_at: "2026-03-06T10:00:00Z",
        },
        {
          id: "memory-1",
          user_id: "user-1",
          fact: "Prefers cash envelopes",
          category: "preference",
          created_at: "2026-03-05T10:00:00Z",
          updated_at: "2026-03-05T10:00:00Z",
        },
      ],
      error: null,
    });

    const result = await listUserMemories("user-1" as UserId);

    expect(mockFrom).toHaveBeenCalledWith("user_memories");
    expect(mockEqSelect).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockIs).toHaveBeenCalledWith("deleted_at", null);
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result.map((memory) => memory.id)).toEqual(["memory-2", "memory-1"]);
  });

  test("soft delete updates deleted_at", async () => {
    mockEqUpdate.mockResolvedValue({ error: null });

    await softDeleteUserMemory("memory-1" as UserMemoryId);

    expect(mockUpdate).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(mockEqUpdate).toHaveBeenCalledWith("id", "memory-1");
  });

  test("extract memories response maps to UserMemory", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: "memory-1",
            user_id: "user-1",
            fact: "Shops weekly on Sundays",
            category: "habit",
            created_at: "2026-03-05T10:00:00Z",
            updated_at: "2026-03-05T10:00:00Z",
          },
        ],
      },
      error: null,
    });

    const result = await extractMemoriesFromConversation([
      { role: "user", content: "I shop every Sunday" },
      { role: "assistant", content: "I'll remember that" },
    ]);

    expect(result).toEqual([
      {
        id: "memory-1",
        userId: "user-1",
        fact: "Shops weekly on Sundays",
        category: "habit",
        createdAt: "2026-03-05T10:00:00Z",
        updatedAt: "2026-03-05T10:00:00Z",
      },
    ]);
  });

  test("rejects invalid extract-memories payloads", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: "memory-1",
            user_id: "user-1",
            fact: "Shops weekly on Sundays",
            category: "not-a-real-category",
            created_at: "2026-03-05T10:00:00Z",
            updated_at: "2026-03-05T10:00:00Z",
          },
        ],
      },
      error: null,
    });

    await expect(
      extractMemoriesFromConversation([
        { role: "user", content: "I shop every Sunday" },
        { role: "assistant", content: "I'll remember that" },
      ])
    ).rejects.toThrow("extract_memories_failed");
  });

  test("throws when the remote list fetch fails", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "offline" } });

    await expect(listUserMemories("user-1" as UserId)).rejects.toThrow("offline");
  });
});

describe("user memory query callers", () => {
  test("MemoryManager uses query hooks instead of store-owned memory loading", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/ai-chat/components/MemoryManager.tsx"),
      "utf-8"
    );

    expect(source).toContain("useUserMemoriesQuery");
    expect(source).toContain("useDeleteUserMemoryMutation");
    expect(source).not.toContain("loadMemories");
    expect(source).not.toContain("deleteMemory = useChatStore");
  });
});

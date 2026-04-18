import { getSupabase } from "@/shared/db";
import type { IsoDateTime, UserId, UserMemoryId } from "@/shared/types/branded";
import type { UserMemory } from "../schema";

export type MemoryConversationMessage = {
  readonly role: "user" | "assistant";
  readonly content: string;
};

type UserMemoryRow = {
  readonly id: string;
  readonly fact: string;
  readonly category: string;
  readonly created_at: string;
};

type ExtractMemoriesResponse = {
  readonly success: boolean;
  readonly data: readonly UserMemoryRow[];
};

export function toUserMemory(row: UserMemoryRow, userId: UserId): UserMemory {
  return {
    id: row.id as UserMemoryId,
    userId,
    fact: row.fact,
    category: row.category as UserMemory["category"],
    createdAt: row.created_at as IsoDateTime,
    updatedAt: row.created_at as IsoDateTime,
  };
}

export async function listUserMemories(userId: UserId): Promise<readonly UserMemory[]> {
  const { data, error } = await getSupabase()
    .from("user_memories")
    .select("id, fact, category, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => toUserMemory(row as UserMemoryRow, userId));
}

export async function softDeleteUserMemory(id: UserMemoryId): Promise<void> {
  const { error } = await getSupabase()
    .from("user_memories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function extractMemoriesFromConversation(
  userId: UserId,
  messages: readonly MemoryConversationMessage[]
): Promise<readonly UserMemory[]> {
  const result = (await getSupabase().functions.invoke("ai-chat", {
    body: { mode: "extract_memories", messages },
  })) as { data: ExtractMemoriesResponse | null; error: Error | null };
  const { data, error } = result;

  if (error != null || !data?.success || !Array.isArray(data.data)) {
    throw error ?? new Error("extract_memories_failed");
  }

  return data.data.map((row) => toUserMemory(row, userId));
}

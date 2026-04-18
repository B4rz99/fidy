import { getSupabase } from "@/shared/db";
import type { IsoDateTime, UserId, UserMemoryId } from "@/shared/types/branded";
import type { MemoryCategory, UserMemory } from "../schema";

type UserMemoryRow = {
  readonly id: string;
  // biome-ignore lint/style/useNamingConvention: Supabase column name
  readonly user_id: string;
  readonly fact: string;
  readonly category: string;
  // biome-ignore lint/style/useNamingConvention: Supabase column name
  readonly created_at: string;
  // biome-ignore lint/style/useNamingConvention: Supabase column name
  readonly updated_at: string | null;
};

type ConversationMessage = {
  readonly role: "user" | "assistant";
  readonly content: string;
};

type ExtractMemoriesResponse = {
  readonly success: boolean;
  readonly data: readonly UserMemoryRow[];
};

export function toUserMemory(row: UserMemoryRow): UserMemory {
  return {
    id: row.id as UserMemoryId,
    userId: row.user_id as UserId,
    fact: row.fact,
    category: row.category as MemoryCategory,
    createdAt: row.created_at as IsoDateTime,
    updatedAt: (row.updated_at ?? row.created_at) as IsoDateTime,
  };
}

export async function listUserMemories(userId: UserId): Promise<readonly UserMemory[]> {
  const { data, error } = await getSupabase()
    .from("user_memories")
    .select("id, user_id, fact, category, created_at, updated_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error != null) {
    throw new Error(error.message);
  }

  return (data as UserMemoryRow[] | null)?.map(toUserMemory) ?? [];
}

export async function softDeleteUserMemory(id: UserMemoryId): Promise<void> {
  const { error } = await getSupabase()
    .from("user_memories")
    // biome-ignore lint/style/useNamingConvention: Supabase column name
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error != null) {
    throw new Error(error.message);
  }
}

export async function extractMemoriesFromConversation(
  messages: readonly ConversationMessage[]
): Promise<readonly UserMemory[]> {
  const result = (await getSupabase().functions.invoke("ai-chat", {
    body: { mode: "extract_memories", messages },
  })) as {
    readonly data: ExtractMemoriesResponse | null;
    readonly error: Error | null;
  };

  if (result.error != null) {
    throw result.error;
  }

  if (!result.data?.success || !Array.isArray(result.data.data)) {
    throw new Error("extract_memories_failed");
  }

  return result.data.data.map(toUserMemory);
}

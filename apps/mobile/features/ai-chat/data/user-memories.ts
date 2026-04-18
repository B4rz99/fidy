import { z } from "zod";
import { getSupabase } from "@/shared/db";
import { requireIsoDateTime, requireUserId, requireUserMemoryId } from "@/shared/types/assertions";
import type { UserId, UserMemoryId } from "@/shared/types/branded";
import { memoryCategory, type UserMemory } from "../schema";

const userMemoryRowSchema = z.object({
  id: z.string().min(1),
  // biome-ignore lint/style/useNamingConvention: Supabase column name
  user_id: z.string().min(1),
  fact: z.string(),
  category: memoryCategory,
  // biome-ignore lint/style/useNamingConvention: Supabase column name
  created_at: z.string(),
  // biome-ignore lint/style/useNamingConvention: Supabase column name
  updated_at: z.string().nullable(),
});

type UserMemoryRow = z.infer<typeof userMemoryRowSchema>;
const userMemoryRowsSchema = z.array(userMemoryRowSchema);

type ConversationMessage = {
  readonly role: "user" | "assistant";
  readonly content: string;
};

const extractMemoriesResponseSchema = z.object({
  success: z.literal(true),
  data: userMemoryRowsSchema,
});

export function toUserMemory(row: UserMemoryRow): UserMemory {
  return {
    id: requireUserMemoryId(row.id),
    userId: requireUserId(row.user_id),
    fact: row.fact,
    category: row.category,
    createdAt: requireIsoDateTime(row.created_at),
    updatedAt: requireIsoDateTime(row.updated_at ?? row.created_at),
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

  return userMemoryRowsSchema.parse(data ?? []).map(toUserMemory);
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
  const { data, error } = await getSupabase().functions.invoke("ai-chat", {
    body: { mode: "extract_memories", messages },
  });

  if (error != null) {
    throw error;
  }

  const result = extractMemoriesResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error("extract_memories_failed");
  }

  return result.data.data.map(toUserMemory);
}

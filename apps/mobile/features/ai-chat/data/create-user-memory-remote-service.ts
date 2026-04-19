import { Effect } from "effect";
import { z } from "zod";
import { type AppClock, bindAppClock, currentIsoDateTimeEffect } from "@/shared/effect/clock";
import { fromPromise } from "@/shared/effect/runtime";
import {
  type AppSupabase,
  bindAppSupabase,
  currentSupabaseClientEffect,
} from "@/shared/effect/supabase";
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

type CreateUserMemoryRemoteServiceDeps = {
  readonly supabase?: AppSupabase;
  readonly clock?: AppClock;
};

export type UserMemoryRemoteService = {
  readonly listUserMemories: (userId: UserId) => Promise<readonly UserMemory[]>;
  readonly softDeleteUserMemory: (id: UserMemoryId) => Promise<void>;
  readonly extractMemoriesFromConversation: (
    messages: readonly ConversationMessage[]
  ) => Promise<readonly UserMemory[]>;
};

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

function listUserMemoriesEffect(userId: UserId) {
  return Effect.flatMap(currentSupabaseClientEffect, (supabase) =>
    Effect.map(
      fromPromise(
        async () =>
          await supabase
            .from("user_memories")
            .select("id, user_id, fact, category, created_at, updated_at")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
      ),
      ({ data, error }) => {
        if (error != null) {
          throw new Error(error.message);
        }

        return userMemoryRowsSchema.parse(data ?? []).map(toUserMemory);
      }
    )
  );
}

function softDeleteUserMemoryEffect(id: UserMemoryId) {
  return Effect.gen(function* () {
    const supabase = yield* currentSupabaseClientEffect;
    const deletedAt = yield* currentIsoDateTimeEffect;
    const { error } = yield* fromPromise(() =>
      Promise.resolve(
        supabase
          .from("user_memories")
          // biome-ignore lint/style/useNamingConvention: Supabase column name
          .update({ deleted_at: deletedAt })
          .eq("id", id)
      )
    );

    if (error != null) {
      throw new Error(error.message);
    }
  });
}

function extractMemoriesEffect(messages: readonly ConversationMessage[]) {
  return Effect.flatMap(currentSupabaseClientEffect, (supabase) =>
    Effect.map(
      fromPromise(() =>
        supabase.functions.invoke("ai-chat", {
          body: { mode: "extract_memories", messages },
        })
      ),
      ({ data, error }) => {
        if (error != null) {
          throw error;
        }

        const result = extractMemoriesResponseSchema.safeParse(data);
        if (!result.success) {
          throw new Error("extract_memories_failed");
        }

        return result.data.data.map(toUserMemory);
      }
    )
  );
}

export function createUserMemoryRemoteService({
  supabase,
  clock,
}: CreateUserMemoryRemoteServiceDeps = {}): UserMemoryRemoteService {
  const supabaseRuntime = bindAppSupabase(supabase);
  const clockRuntime = bindAppClock(clock);
  const runEffect = <A>(effect: Effect.Effect<A, unknown, AppSupabase | AppClock>) =>
    clockRuntime.run(supabaseRuntime.provide(effect));

  return {
    listUserMemories: (userId) => runEffect(listUserMemoriesEffect(userId)),
    softDeleteUserMemory: (id) => runEffect(softDeleteUserMemoryEffect(id)),
    extractMemoriesFromConversation: (messages) => runEffect(extractMemoriesEffect(messages)),
  };
}

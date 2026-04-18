import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth";
import type { UserId, UserMemoryId } from "@/shared/types/branded";
import {
  extractMemoriesFromConversation,
  listUserMemories,
  softDeleteUserMemory,
} from "../data/user-memories";
import type { ChatMessage, UserMemory } from "../schema";

type ConversationMessage = Pick<ChatMessage, "role" | "content">;

export function userMemoriesQueryKey(userId: UserId) {
  return ["user-memories", userId] as const;
}

export function useUserMemoriesQuery() {
  const userId = useAuthStore((state) => state.session?.user.id as UserId | undefined);

  return useQuery({
    queryKey: userId ? userMemoriesQueryKey(userId) : (["user-memories", "anonymous"] as const),
    queryFn: () => listUserMemories(userId as UserId),
    enabled: userId != null,
  });
}

export function useDeleteUserMemoryMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id as UserId | undefined);

  return useMutation({
    mutationFn: (id: UserMemoryId) => softDeleteUserMemory(id),
    onMutate: async (id) => {
      if (!userId) return null;

      const queryKey = userMemoriesQueryKey(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousMemories = queryClient.getQueryData<readonly UserMemory[]>(queryKey);

      queryClient.setQueryData<readonly UserMemory[]>(queryKey, (current = []) =>
        current.filter((memory) => memory.id !== id)
      );

      return { previousMemories, queryKey };
    },
    onError: (_error, _id, context) => {
      if (context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousMemories);
      }
    },
    onSettled: async () => {
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: userMemoriesQueryKey(userId) });
      }
    },
  });
}

export function useExtractUserMemoriesMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id as UserId | undefined);

  return useMutation({
    mutationFn: (messages: readonly ConversationMessage[]) =>
      extractMemoriesFromConversation(messages),
    onSuccess: async () => {
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: userMemoriesQueryKey(userId) });
      }
    },
  });
}

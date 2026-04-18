import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth";
import type { UserId, UserMemoryId } from "@/shared/types/branded";
import {
  extractMemoriesFromConversation,
  listUserMemories,
  type MemoryConversationMessage,
  softDeleteUserMemory,
} from "../data/user-memories";

export function userMemoriesQueryKey(userId: UserId) {
  return ["ai-chat", "user-memories", userId] as const;
}

function useCurrentUserId(): UserId | null {
  return useAuthStore((s) => (s.session?.user.id ?? null) as UserId | null);
}

export function useUserMemoriesQuery() {
  const userId = useCurrentUserId();

  return useQuery({
    queryKey:
      userId == null ? ["ai-chat", "user-memories", "anonymous"] : userMemoriesQueryKey(userId),
    queryFn: async () => {
      if (userId == null) return [];
      return listUserMemories(userId);
    },
    enabled: userId != null,
  });
}

export function useDeleteUserMemoryMutation() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const queryKey =
    userId == null ? ["ai-chat", "user-memories", "anonymous"] : userMemoriesQueryKey(userId);

  return useMutation({
    mutationFn: async (id: UserMemoryId) => {
      if (userId == null) return;
      await softDeleteUserMemory(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousMemories = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (current: readonly { id: UserMemoryId }[] | undefined) =>
        (current ?? []).filter((memory) => memory.id !== id)
      );

      return { previousMemories };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(queryKey, context?.previousMemories);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useExtractUserMemoriesMutation() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const queryKey =
    userId == null ? ["ai-chat", "user-memories", "anonymous"] : userMemoriesQueryKey(userId);

  return useMutation({
    mutationFn: async (messages: readonly MemoryConversationMessage[]) => {
      if (userId == null || messages.length < 2) return [];
      return extractMemoriesFromConversation(userId, messages);
    },
    onSettled: async (_data, _error, messages) => {
      if (userId == null || messages.length < 2) return;
      await queryClient.invalidateQueries({ queryKey });
    },
  });
}

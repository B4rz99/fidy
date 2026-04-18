import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth";
import type { UserMemoryId } from "@/shared/types/branded";
import {
  extractMemoriesFromConversation,
  listUserMemories,
  type MemoryConversationMessage,
  softDeleteUserMemory,
} from "../data/user-memories";

export function userMemoriesQueryKey(userId: string | null) {
  return ["ai-chat", "user-memories", userId] as const;
}

export function useUserMemoriesQuery() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: userMemoriesQueryKey(userId),
    queryFn: () => listUserMemories(userId as never),
    enabled: userId != null,
  });
}

export function useDeleteUserMemoryMutation() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const queryKey = userMemoriesQueryKey(userId);

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
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const queryKey = userMemoriesQueryKey(userId);

  return useMutation({
    mutationFn: async (messages: readonly MemoryConversationMessage[]) => {
      if (userId == null || messages.length < 2) return [];
      return extractMemoriesFromConversation(userId as never, messages);
    },
    onSettled: async (_data, _error, messages) => {
      if (userId == null || messages.length < 2) return;
      await queryClient.invalidateQueries({ queryKey });
    },
  });
}

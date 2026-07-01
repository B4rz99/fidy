import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/public";
import {
  deleteAccountRequest,
  isDeleteAccountLocalCleanupRequiredError,
} from "../data/delete-account";

type DeleteAccountInput = {
  readonly supabaseUrl: string;
  readonly token: string;
};

export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ supabaseUrl, token }: DeleteAccountInput) =>
      deleteAccountRequest(supabaseUrl, token),
    onSuccess: async () => {
      queryClient.clear();
      await useAuthStore.getState().completeDeletedAccountSignOut();
    },
    onError: async (error) => {
      if (isDeleteAccountLocalCleanupRequiredError(error)) {
        queryClient.clear();
        await useAuthStore.getState().completeDeletedAccountSignOut();
      }
    },
  });
}

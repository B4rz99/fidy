import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/public";
import { deleteAccountRequest } from "../data/notification-preferences";

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
      await useAuthStore.getState().signOut();
    },
  });
}

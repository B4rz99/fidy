import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth";
import { deleteAccountRequest } from "../data/notification-preferences";

type DeleteAccountInput = {
  readonly supabaseUrl: string;
  readonly token: string;
};

export function useDeleteAccountMutation() {
  return useMutation({
    mutationFn: ({ supabaseUrl, token }: DeleteAccountInput) =>
      deleteAccountRequest(supabaseUrl, token),
    onSuccess: async () => {
      await useAuthStore.getState().signOut();
    },
  });
}

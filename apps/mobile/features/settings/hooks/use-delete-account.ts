import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth";

type DeleteAccountInput = {
  readonly supabaseUrl: string;
  readonly token: string;
};

async function deleteAccountRemote({ supabaseUrl, token }: DeleteAccountInput): Promise<void> {
  const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.ok) return;

  const body = (await response.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error ?? "delete_failed");
}

export function useDeleteAccountMutation() {
  const signOut = useAuthStore((s) => s.signOut);

  return useMutation({
    mutationFn: deleteAccountRemote,
    onSuccess: async () => {
      await signOut();
    },
  });
}

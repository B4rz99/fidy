import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth";
import { captureWarning } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import {
  notificationPreferencesQueryKey,
  saveNotificationPreferencesRemote,
} from "../data/notification-preferences";
import type { NotificationPreferences } from "../store";

function useCurrentUserId(): UserId | null {
  return useAuthStore((s) => (s.session?.user.id ?? null) as UserId | null);
}

export function useSaveNotificationPreferencesMutation() {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: NotificationPreferences) => {
      if (userId == null) return;
      await saveNotificationPreferencesRemote(userId, prefs);
    },
    onMutate: async (prefs) => {
      if (userId == null) return;
      queryClient.setQueryData(notificationPreferencesQueryKey(userId), prefs);
    },
    onError: (error) => {
      captureWarning("notification_prefs_sync_failed", {
        errorMessage: error instanceof Error ? error.message : "unknown",
      });
    },
    onSettled: async () => {
      if (userId == null) return;
      await queryClient.invalidateQueries({
        queryKey: notificationPreferencesQueryKey(userId),
      });
    },
  });
}

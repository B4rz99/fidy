import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOptionalUserId } from "@/features/auth/public";
import { saveNotificationPreferences } from "../data/notification-preferences";
import type { NotificationPreferences } from "../store";

export function useNotificationPreferencesMutation() {
  const userId = useOptionalUserId() ?? undefined;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preferences: NotificationPreferences) => {
      if (!userId) {
        throw new Error("missing_user");
      }

      return saveNotificationPreferences(userId, preferences);
    },
    onSuccess: async () => {
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: ["notificationPreferences", userId] });
      }
    },
  });
}

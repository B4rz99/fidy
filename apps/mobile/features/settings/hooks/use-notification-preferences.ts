import { useMutation } from "@tanstack/react-query";
import { useOptionalUserId } from "@/features/auth";
import { saveNotificationPreferences } from "../data/notification-preferences";
import type { NotificationPreferences } from "../store";

export function useNotificationPreferencesMutation() {
  const userId = useOptionalUserId() ?? undefined;

  return useMutation({
    mutationFn: (preferences: NotificationPreferences) => {
      if (!userId) {
        throw new Error("missing_user");
      }

      return saveNotificationPreferences(userId, preferences);
    },
  });
}

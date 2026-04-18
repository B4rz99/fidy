import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth";
import type { UserId } from "@/shared/types/branded";
import { saveNotificationPreferences } from "../data/notification-preferences";
import type { NotificationPreferences } from "../store";

export function useNotificationPreferencesMutation() {
  const userId = useAuthStore((state) => state.session?.user.id as UserId | undefined);

  return useMutation({
    mutationFn: (preferences: NotificationPreferences) => {
      if (!userId) {
        throw new Error("missing_user");
      }

      return saveNotificationPreferences(userId, preferences);
    },
  });
}

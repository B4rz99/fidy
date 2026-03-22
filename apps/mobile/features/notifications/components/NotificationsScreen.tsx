import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { ScreenLayout } from "@/shared/components";
import { ScrollView } from "@/shared/components/rn";
import { useMountEffect, useTranslation } from "@/shared/hooks";
import { deriveNotificationDisplay, groupNotificationsBySection } from "../lib/display";
import { useNotificationStore } from "../store";
import { NotificationEmptyState } from "./NotificationEmptyState";
import { NotificationSection } from "./NotificationSection";

export const NotificationsScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const notifications = useNotificationStore((s) => s.notifications);
  const isLoading = useNotificationStore((s) => s.isLoading);

  useMountEffect(() => {
    useNotificationStore.getState().markVisited();
    useNotificationStore.getState().loadNotifications();
  });

  const sections = useMemo(() => {
    const displays = notifications.map((n) => deriveNotificationDisplay(n, t));
    return groupNotificationsBySection(displays, new Date(), t);
  }, [notifications, t]);

  const handlePress = useCallback(
    (route: string) => {
      router.push(route as never);
    },
    [router]
  );

  return (
    <ScreenLayout title={t("notifications.title")} variant="sub" onBack={() => router.back()}>
      {!isLoading && sections.length === 0 ? (
        <NotificationEmptyState />
      ) : (
        <ScrollView>
          {sections.map((section) => (
            <NotificationSection
              key={section.label}
              section={section}
              onNotificationPress={handlePress}
            />
          ))}
        </ScrollView>
      )}
    </ScreenLayout>
  );
};

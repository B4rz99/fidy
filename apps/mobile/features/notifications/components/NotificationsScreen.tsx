import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { ScreenLayout } from "@/shared/components";
import { SectionList, StyleSheet, Text } from "@/shared/components/rn";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { deriveNotificationDisplay, groupNotificationsBySection } from "../lib/display";
import type { NotificationDisplay } from "../lib/types";
import { useNotificationStore } from "../store";
import { NotificationCard } from "./NotificationCard";
import { NotificationEmptyState } from "./NotificationEmptyState";

export const NotificationsScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const notifications = useNotificationStore((s) => s.notifications);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const tertiaryColor = useThemeColor("tertiary");

  useMountEffect(() => {
    useNotificationStore.getState().markVisited();
    useNotificationStore.getState().loadNotifications();
  });

  const sections = useMemo(() => {
    const displays = notifications.map((n) => deriveNotificationDisplay(n, t));
    const grouped = groupNotificationsBySection(displays, new Date(), t);
    return grouped.map((s) => ({ title: s.label, data: s.notifications as NotificationDisplay[] }));
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
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationCard notification={item} onPress={handlePress} />}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionLabel, { color: tertiaryColor }]}>{section.title}</Text>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
        />
      )}
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 20,
  },
  listContent: {
    paddingBottom: 32,
  },
});

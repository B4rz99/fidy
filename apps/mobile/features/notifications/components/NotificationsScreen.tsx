import { Stack, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/features/auth";
import { ScreenLayout } from "@/shared/components";
import { Pressable, SectionList, StyleSheet, Text, View } from "@/shared/components/rn";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { deriveNotificationDisplay, groupNotificationsBySection } from "../lib/display";
import { isFirstWeek } from "../lib/first-week";
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
  const accentRed = useThemeColor("accentRed");
  const { bottom } = useSafeAreaInsets();
  const hasNotifications = notifications.length > 0;
  const accountCreatedAt = useAuthStore((s) => s.session?.user.created_at ?? "");
  const firstWeek = isFirstWeek(accountCreatedAt, new Date());

  const handleClearAll = useCallback(() => {
    useNotificationStore.getState().clearAll();
  }, []);

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
    <ScreenLayout
      title={t("notifications.title")}
      variant="sub"
      onBack={() => router.back()}
      rightActions={
        hasNotifications ? (
          <Pressable onPress={handleClearAll} hitSlop={12}>
            <Text style={[styles.clearButton, { color: accentRed }]}>{t("common.clearAll")}</Text>
          </Pressable>
        ) : undefined
      }
    >
      {Platform.OS === "ios" && hasNotifications && (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable onPress={handleClearAll} hitSlop={12}>
                <Text style={[styles.clearButton, { color: accentRed }]}>
                  {t("common.clearAll")}
                </Text>
              </Pressable>
            ),
          }}
        />
      )}
      {!isLoading && sections.length === 0 ? (
        <NotificationEmptyState
          titleKey={firstWeek ? "notifications.firstWeekTitle" : "notifications.emptyTitle"}
          subtitleKey={firstWeek ? "notifications.firstWeekMessage" : "notifications.emptySubtitle"}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationCard notification={item} onPress={handlePress} />}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionLabel, { color: tertiaryColor }]}>{section.title}</Text>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottom + 16 }]}
          contentInsetAdjustmentBehavior="automatic"
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
  separator: {
    height: 12,
  },
  clearButton: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
  },
});

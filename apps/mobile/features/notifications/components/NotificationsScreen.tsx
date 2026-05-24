import { Stack, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import { ScreenLayout } from "@/shared/components";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { getDb } from "@/shared/db";
import { useMountEffect, useSubscription, useTranslation } from "@/shared/hooks";
import { trackNotificationCenterOpened } from "@/shared/lib";
import { deriveNotificationDisplay, getNotificationFeedItems } from "../lib/display";
import type { NotificationDisplay } from "../lib/types";
import {
  clearAllNotifications,
  loadNotificationsForUser,
  markNotificationsVisited,
  useNotificationStore,
} from "../store";
import { NotificationCard } from "./NotificationCard";
import { NotificationEmptyState } from "./NotificationEmptyState";

const notificationKeyExtractor = (item: NotificationDisplay) => item.id;
const NotificationItemSeparator = () => <View style={styles.separator} />;

export const NotificationsScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const notifications = useNotificationStore((s) => s.notifications);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const { bottom } = useSafeAreaInsets();
  const hasNotifications = notifications.length > 0;

  const handleClearAll = useCallback(() => {
    if (!userId) return;
    void clearAllNotifications(getDb(userId), userId);
  }, [userId]);

  useMountEffect(() => {
    trackNotificationCenterOpened();
  });

  useSubscription(
    () => {
      if (!userId) return;
      markNotificationsVisited(userId);
      loadNotificationsForUser(getDb(userId), userId);
    },
    [userId],
    userId != null
  );

  const feedItems = useMemo(() => {
    const displays = notifications.map((n) => deriveNotificationDisplay(n, t));
    return getNotificationFeedItems(displays);
  }, [notifications, t]);

  const handlePress = useCallback(
    (route: string) => {
      router.push(route as never);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationDisplay }) => (
      <NotificationCard notification={item} onPress={handlePress} />
    ),
    [handlePress]
  );

  return (
    <ScreenLayout
      title={t("notifications.title")}
      variant="sub"
      onBack={() => router.back()}
      rightActions={
        hasNotifications ? (
          <Pressable onPress={handleClearAll} hitSlop={12}>
            <Text style={styles.clearButton}>{t("common.clear")}</Text>
          </Pressable>
        ) : undefined
      }
    >
      {Platform.OS === "ios" && hasNotifications && (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable onPress={handleClearAll} hitSlop={12}>
                <Text style={styles.clearButton}>{t("common.clear")}</Text>
              </Pressable>
            ),
          }}
        />
      )}
      {!isLoading && feedItems.length === 0 ? (
        <NotificationEmptyState />
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={notificationKeyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={NotificationItemSeparator}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottom + 16 }]}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  separator: {
    height: 10,
  },
  clearButton: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: "#E06060",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
});

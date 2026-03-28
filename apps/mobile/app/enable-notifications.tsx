import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { useAuthStore } from "@/features/auth";
import { PRE_PERMISSION_KEY, registerPushToken } from "@/features/notifications";
import { Bell } from "@/shared/components/icons";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";

export default function EnableNotificationsSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted" && userId) {
        await registerPushToken(userId as UserId);
      }
    } catch (err) {
      captureError(err instanceof Error ? err : new Error("Permission request failed"));
    } finally {
      // Mark pre-permission as seen regardless of outcome
      await SecureStore.setItemAsync(PRE_PERMISSION_KEY, "true").catch(() => {});
      setIsRequesting(false);
      router.back();
    }
  };

  const handleNotNow = async () => {
    await SecureStore.setItemAsync(PRE_PERMISSION_KEY, "true").catch(() => {});
    router.back();
  };

  return (
    <ScrollView
      className="flex-1 bg-card dark:bg-card-dark"
      contentContainerStyle={{ padding: 24, alignItems: "center", gap: 16 }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${accentGreen}1A`,
        }}
      >
        <Bell size={32} color={accentGreen} />
      </View>
      <Text
        className="font-poppins-semibold text-primary dark:text-primary-dark"
        style={{ fontSize: 16 }}
      >
        {t("notifications.enableNotifications.title")}
      </Text>
      <Text
        className="font-poppins text-secondary dark:text-secondary-dark"
        style={{ fontSize: 13, lineHeight: 20, textAlign: "center" }}
      >
        {t("notifications.enableNotifications.description")}
      </Text>
      <View style={{ width: "100%", gap: 12 }}>
        <Pressable
          onPress={() => {
            void handleEnable();
          }}
          disabled={isRequesting}
          style={{
            height: 48,
            borderRadius: 16,
            backgroundColor: accentGreen,
            alignItems: "center",
            justifyContent: "center",
            opacity: isRequesting ? 0.6 : 1,
          }}
        >
          {isRequesting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="font-poppins-semibold" style={{ fontSize: 15, color: "#FFFFFF" }}>
              {t("notifications.enableNotifications.enable")}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => {
            void handleNotNow();
          }}
          disabled={isRequesting}
          style={{
            height: 48,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            className="font-poppins-semibold text-primary dark:text-primary-dark"
            style={{ fontSize: 15 }}
          >
            {t("notifications.enableNotifications.notNow")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

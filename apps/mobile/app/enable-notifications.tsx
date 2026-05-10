import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/hooks.public";
import {
  PRE_PERMISSION_KEY,
  registerPushToken,
  requestNotificationPermissionStatus,
} from "@/features/notifications/hooks.public";
import { Bell } from "@/shared/components/icons";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { captureError, captureWarning } from "@/shared/lib";

const PERMISSION_REQUEST_TIMEOUT_MS = 2500;

const logNotificationPromptStage = (stage: string, details?: Record<string, unknown>) => {
  if (!__DEV__) return;

  // eslint-disable-next-line no-console -- temporary prompt diagnostics for Expo notification hangs.
  console.info("[notifications:enable-prompt]", stage, details ?? {});
};

export default function EnableNotificationsSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");
  const [isRequesting, setIsRequesting] = useState(false);
  const isMountedRef = useRef(true);
  const actionVersionRef = useRef(0);

  useMountEffect(() => () => {
    isMountedRef.current = false;
  });

  const markPrePermissionSeen = () => {
    void SecureStore.setItemAsync(PRE_PERMISSION_KEY, "true").catch(captureError);
  };

  const dismissSheet = () => {
    markPrePermissionSeen();
    if (isMountedRef.current) setIsRequesting(false);
    logNotificationPromptStage("dismiss");
    router.back();
  };

  const handleEnable = async () => {
    const actionVersion = actionVersionRef.current + 1;

    actionVersionRef.current = actionVersion;
    logNotificationPromptStage("enable_tapped");
    setIsRequesting(true);
    const permissionRequest = Notifications.requestPermissionsAsync();

    void permissionRequest
      .then((result) => {
        if (result.status !== "granted" || !userId || actionVersionRef.current !== actionVersion) {
          return;
        }

        logNotificationPromptStage("register_push_token", { timing: "permission_result" });
        void registerPushToken(userId).catch(captureError);
      })
      .catch(() => undefined);

    const status = await requestNotificationPermissionStatus({
      captureWarning,
      requestPermissions: () => permissionRequest,
      timeoutMs: PERMISSION_REQUEST_TIMEOUT_MS,
    });
    logNotificationPromptStage("permission_finished", { status });

    if (actionVersionRef.current !== actionVersion || !isMountedRef.current) {
      logNotificationPromptStage("stale_enable_ignored", { status });
      return;
    }

    dismissSheet();
  };

  const handleNotNow = () => {
    actionVersionRef.current += 1;
    logNotificationPromptStage("not_now_tapped");
    dismissSheet();
  };

  return (
    <ScrollView
      className="flex-1 bg-card dark:bg-card-dark"
      contentContainerStyle={{
        padding: 24,
        paddingBottom: bottom + 24,
        alignItems: "center",
        gap: 16,
      }}
      contentInsetAdjustmentBehavior="automatic"
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

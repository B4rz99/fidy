import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/hooks.public";
import {
  markPrePermissionSeen,
  markPrePermissionSeenAsync,
  registerPushToken,
  requestNotificationPermissionStatus,
} from "@/features/notifications/hooks.public";
import { DialogRouteFrame } from "@/shared/components";
import { Bell } from "@/shared/components/icons";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { captureError, captureWarning } from "@/shared/lib";

const PERMISSION_REQUEST_TIMEOUT_MS = 2500;

export default function EnableNotificationsSheet() {
  const { t } = useTranslation();
  const { back } = useRouter();
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

  const dismissSheet = () => {
    try {
      markPrePermissionSeen();
    } catch (error) {
      captureError(error);
      void markPrePermissionSeenAsync().catch(captureError);
    }
    if (isMountedRef.current) setIsRequesting(false);
    back();
  };

  const handleEnable = async () => {
    const actionVersion = actionVersionRef.current + 1;

    actionVersionRef.current = actionVersion;
    setIsRequesting(true);
    try {
      markPrePermissionSeen();
    } catch (error) {
      captureError(error);
      void markPrePermissionSeenAsync().catch(captureError);
    }
    const permissionRequest = Notifications.requestPermissionsAsync();

    void permissionRequest
      .then((result) => {
        if (result.status !== "granted" || !userId || actionVersionRef.current !== actionVersion) {
          return;
        }

        void registerPushToken(userId).catch(captureError);
      })
      .catch(() => undefined);

    await requestNotificationPermissionStatus({
      captureWarning,
      requestPermissions: () => permissionRequest,
      timeoutMs: PERMISSION_REQUEST_TIMEOUT_MS,
    });

    if (actionVersionRef.current !== actionVersion || !isMountedRef.current) {
      return;
    }

    dismissSheet();
  };

  const handleNotNow = () => {
    actionVersionRef.current += 1;
    dismissSheet();
  };

  return (
    <DialogRouteFrame>
      <ScrollView
        className="bg-card dark:bg-card-dark"
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 24,
          alignItems: "center",
          gap: 16,
        }}
        contentInset={{ bottom }}
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
    </DialogRouteFrame>
  );
}

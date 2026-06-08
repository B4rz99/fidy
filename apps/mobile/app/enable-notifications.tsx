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
import { DialogActionButton, DialogActionStack, DialogRouteFrame } from "@/shared/components";
import { Bell } from "@/shared/components/icons";
import { ScrollView, Text, View } from "@/shared/components/rn";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { captureError, captureWarning } from "@/shared/lib";

const PERMISSION_REQUEST_TIMEOUT_MS = 2500;

export default function EnableNotificationsDialogRoute() {
  const { t } = useTranslation();
  const { back } = useRouter();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const accentGreen = useThemeColor("accentGreen");
  const [isRequesting, setIsRequesting] = useState(false);
  const isMountedRef = useRef(true);
  const actionVersionRef = useRef(0);

  useMountEffect(() => () => {
    isMountedRef.current = false;
  });

  const dismissDialog = () => {
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

    dismissDialog();
  };

  const handleNotNow = () => {
    actionVersionRef.current += 1;
    dismissDialog();
  };

  return (
    <DialogRouteFrame>
      <ScrollView
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
        <DialogActionStack style={{ marginTop: 0 }}>
          <DialogActionButton
            label={t("notifications.enableNotifications.enable")}
            onPress={() => {
              void handleEnable();
            }}
            disabled={isRequesting}
            loading={isRequesting}
          />
          <DialogActionButton
            label={t("notifications.enableNotifications.notNow")}
            variant="secondary"
            onPress={() => {
              void handleNotNow();
            }}
          />
        </DialogActionStack>
      </ScrollView>
    </DialogRouteFrame>
  );
}

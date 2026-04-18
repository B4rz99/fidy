import { useOptionalUserId } from "@/features/auth";
import { Bell, ExternalLink } from "@/shared/components/icons";
import { Linking, Platform, Pressable, Switch, Text, View } from "@/shared/components/rn";
import { getDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { KNOWN_BANK_PACKAGES } from "../schema";
import { toggleCaptureSourcePackage, useCaptureSourcesStore } from "../store";

const openNotificationListenerSettings = () => {
  if (Platform.OS === "android") {
    void Linking.sendIntent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").catch(() => {
      void Linking.openSettings();
    });
  } else {
    void Linking.openSettings();
  }
};

export const NotificationSetupCard = () => {
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const enabledPackages = useCaptureSourcesStore((s) => s.enabledPackages);
  const isPermissionGranted = useCaptureSourcesStore((s) => s.isNotificationPermissionGranted);

  const iconColor = useThemeColor("accentGreen");
  const warningColor = useThemeColor("accentRed");
  const secondaryColor = useThemeColor("secondary");
  const borderColor = useThemeColor("borderSubtle");

  return (
    <View className="rounded-chart bg-card p-5 dark:bg-card-dark" style={{ gap: 14 }}>
      {/* Header */}
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Bell size={22} color={iconColor} />
        <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
          {t("notificationCapture.title")}
        </Text>
      </View>

      {/* Description */}
      <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
        {t("notificationCapture.description")}
      </Text>

      {/* Permission status */}
      <View
        className="flex-row items-center justify-between"
        style={{
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: borderColor,
        }}
      >
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: isPermissionGranted ? iconColor : warningColor,
            }}
          />
          <Text className="font-poppins-medium text-label text-primary dark:text-primary-dark">
            {isPermissionGranted
              ? t("notificationCapture.listening")
              : t("notificationCapture.permissionRequired")}
          </Text>
        </View>

        {!isPermissionGranted && (
          <Pressable
            onPress={openNotificationListenerSettings}
            className="flex-row items-center"
            style={{ gap: 4 }}
          >
            <Text className="font-poppins-semibold text-label" style={{ color: warningColor }}>
              {t("notificationCapture.grantAccess")}
            </Text>
            <ExternalLink size={14} color={warningColor} />
          </Pressable>
        )}
      </View>

      {/* Bank app toggles */}
      <View style={{ gap: 2 }}>
        {KNOWN_BANK_PACKAGES.map((pkg) => {
          const isEnabled = enabledPackages.includes(pkg.packageName);

          return (
            <View
              key={pkg.packageName}
              className="flex-row items-center justify-between"
              style={{ paddingVertical: 10 }}
            >
              <Text className="font-poppins-medium text-body text-primary dark:text-primary-dark">
                {pkg.label}
              </Text>
              <Switch
                value={isEnabled}
                onValueChange={(value) => {
                  if (!userId) return;
                  void toggleCaptureSourcePackage(getDb(userId), userId, pkg.packageName, value);
                }}
                trackColor={{ false: secondaryColor, true: iconColor }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
};

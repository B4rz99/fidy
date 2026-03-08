import { Bell, ExternalLink } from "lucide-react-native";
import { Linking, Platform, Pressable, Switch, Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { KNOWN_BANK_PACKAGES } from "../schema";
import { useCaptureSourcesStore } from "../store";

const openNotificationListenerSettings = () => {
  if (Platform.OS === "android") {
    Linking.sendIntent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").catch(() => {
      Linking.openSettings();
    });
  } else {
    Linking.openSettings();
  }
};

export const NotificationSetupCard = () => {
  const enabledPackages = useCaptureSourcesStore((s) => s.enabledPackages);
  const isPermissionGranted = useCaptureSourcesStore((s) => s.isNotificationPermissionGranted);
  const togglePackage = useCaptureSourcesStore((s) => s.togglePackage);

  const iconColor = useThemeColor("accentGreen");
  const secondaryColor = useThemeColor("secondary");
  const borderColor = useThemeColor("borderSubtle");

  return (
    <View className="rounded-chart bg-card p-5 dark:bg-card-dark" style={{ gap: 14 }}>
      {/* Header */}
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Bell size={22} color={iconColor} />
        <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
          Notification Capture
        </Text>
      </View>

      {/* Description */}
      <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
        Automatically capture transactions from your bank app notifications.
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
              backgroundColor: isPermissionGranted ? iconColor : "#F5A623",
            }}
          />
          <Text className="font-poppins-medium text-label text-primary dark:text-primary-dark">
            {isPermissionGranted ? "Listening" : "Permission required"}
          </Text>
        </View>

        {!isPermissionGranted && (
          <Pressable
            onPress={openNotificationListenerSettings}
            className="flex-row items-center"
            style={{ gap: 4 }}
          >
            <Text className="font-poppins-semibold text-label" style={{ color: "#F5A623" }}>
              Grant Access
            </Text>
            <ExternalLink size={14} color="#F5A623" />
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
                onValueChange={(value) => togglePackage(pkg.packageName, value)}
                trackColor={{ false: secondaryColor, true: iconColor }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
};

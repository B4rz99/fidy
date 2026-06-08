import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenLayout, SettingsSection } from "@/shared/components";
import { Bell } from "@/shared/components/icons";
import { Platform, ScrollView, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { useNotificationPreferencesMutation } from "../hooks/use-notification-preferences";
import type { NotificationPreferences } from "../store";
import { useSettingsStore } from "../store";
import { SettingsRow } from "./SettingsRow";

type PreferenceToggle = {
  readonly key: keyof NotificationPreferences;
  readonly labelKey: string;
  readonly descKey: string;
  readonly isLast: boolean;
};

const PREFERENCE_TOGGLES: readonly PreferenceToggle[] = [
  {
    key: "budgetAlerts",
    labelKey: "notifications.preferences.budgetAlerts",
    descKey: "notifications.preferences.budgetAlertsDesc",
    isLast: false,
  },
  {
    key: "goalMilestones",
    labelKey: "notifications.preferences.goalMilestones",
    descKey: "notifications.preferences.goalMilestonesDesc",
    isLast: false,
  },
  {
    key: "spendingAnomalies",
    labelKey: "notifications.preferences.spendingAnomalies",
    descKey: "notifications.preferences.spendingAnomaliesDesc",
    isLast: true,
  },
];

export function NotificationPreferencesScreen() {
  const { back } = useRouter();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();

  const prefs = useSettingsStore((s) => s.notificationPreferences);
  const areAllOff = useSettingsStore((s) => s.areAllNotificationsOff);
  const setPreference = useSettingsStore((s) => s.setNotificationPreference);
  const setAll = useSettingsStore((s) => s.setAllNotifications);
  const syncPreferences = useNotificationPreferencesMutation();

  const allOn = prefs.budgetAlerts && prefs.goalMilestones && prefs.spendingAnomalies;

  const handleSetPreference = (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...prefs, [key]: value };
    setPreference(key, value);
    syncPreferences.mutate(updated);
  };

  const handleSetAll = (enabled: boolean) => {
    const updated: NotificationPreferences = {
      budgetAlerts: enabled,
      goalMilestones: enabled,
      spendingAnomalies: enabled,
    };

    setAll(enabled);
    syncPreferences.mutate(updated);
  };

  return (
    <ScreenLayout title={t("notifications.preferences.title")} variant="sub" onBack={() => back()}>
      {Platform.OS === "ios" && (
        <Stack.Screen options={{ title: t("notifications.preferences.title") }} />
      )}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: bottom + 40,
          gap: 24,
        }}
        contentInset={{ bottom }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Master toggle */}
        <SettingsSection label={t("notifications.preferences.title").toUpperCase()}>
          <SettingsRow
            icon={Bell}
            label={t("notifications.preferences.masterToggle")}
            accessory="switch"
            switchValue={allOn}
            onSwitchChange={handleSetAll}
            isLast
          />
        </SettingsSection>

        {/* Individual toggles */}
        <SettingsSection label={t("settings.preferencesSection")}>
          {PREFERENCE_TOGGLES.map((toggle) => (
            <View
              key={toggle.key}
              style={{ opacity: areAllOff ? 0.4 : 1 }}
              pointerEvents={areAllOff ? "none" : "auto"}
            >
              <SettingsRow
                icon={Bell}
                label={t(toggle.labelKey)}
                subtitle={t(toggle.descKey)}
                accessory="switch"
                switchValue={prefs[toggle.key]}
                onSwitchChange={(value) => handleSetPreference(toggle.key, value)}
                isLast={toggle.isLast}
              />
            </View>
          ))}
        </SettingsSection>
      </ScrollView>
    </ScreenLayout>
  );
}

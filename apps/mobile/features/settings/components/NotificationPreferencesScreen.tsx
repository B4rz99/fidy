import { Stack, useRouter } from "expo-router";
import { ScreenLayout } from "@/shared/components";
import { Bell } from "@/shared/components/icons";
import { Platform, ScrollView, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import type { NotificationPreferences } from "../store";
import { useSettingsStore } from "../store";
import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";

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
    isLast: false,
  },
  {
    key: "weeklyDigest",
    labelKey: "notifications.preferences.weeklyDigest",
    descKey: "notifications.preferences.weeklyDigestDesc",
    isLast: true,
  },
];

export function NotificationPreferencesScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const prefs = useSettingsStore((s) => s.notificationPreferences);
  const areAllOff = useSettingsStore((s) => s.areAllNotificationsOff);
  const setPreference = useSettingsStore((s) => s.setNotificationPreference);
  const setAll = useSettingsStore((s) => s.setAllNotifications);

  const allOn =
    prefs.budgetAlerts && prefs.goalMilestones && prefs.spendingAnomalies && prefs.weeklyDigest;

  return (
    <ScreenLayout
      title={t("notifications.preferences.title")}
      variant="sub"
      onBack={() => router.back()}
    >
      {Platform.OS === "ios" && (
        <Stack.Screen options={{ title: t("notifications.preferences.title") }} />
      )}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 40,
          gap: 24,
        }}
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
            onSwitchChange={(value) => setAll(value)}
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
                onSwitchChange={(value) => setPreference(toggle.key, value)}
                isLast={toggle.isLast}
              />
            </View>
          ))}
        </SettingsSection>
      </ScrollView>
    </ScreenLayout>
  );
}

import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useAuthIdentity } from "@/features/auth/public";
import type { PrivateBackupHealthStatus } from "@/features/backup/public";
import { useEmailCaptureStore } from "@/features/email-capture/public";
import { ScreenLayout, SettingsSection, TAB_BAR_CLEARANCE } from "@/shared/components";
import {
  Bell,
  ChevronRight,
  FileText,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  Mail,
  Palette,
  Shield,
  Sparkles,
  Tag,
  Wallet,
} from "@/shared/components/icons";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import {
  buildPrivacyUrl,
  buildTermsUrl,
  buildWhatsAppUrl,
  getUserInitials,
} from "../lib/settings-links";
import { useSettingsStore } from "../store";
import { SettingsRow } from "./SettingsRow";

const THEME_LABEL_KEYS: Record<string, string> = {
  system: "settings.themeSystem",
  light: "settings.themeLight",
  dark: "settings.themeDark",
};

function getPrivateBackupStatusLabelKey(status: PrivateBackupHealthStatus) {
  switch (status) {
    case "not_set_up":
      return "settings.privateBackupStatus.notSetUp";
    case "recovery_key_not_confirmed":
      return "settings.privateBackupStatus.recoveryKeyNotConfirmed";
    case "ready":
      return "settings.privateBackupStatus.ready";
    case "backup_failed":
      return "settings.privateBackupStatus.backupFailed";
  }
}

export function SettingsScreen() {
  const { back, push } = useRouter();
  const { t, locale } = useTranslation();

  const { fullName, email } = useAuthIdentity();
  const initials = getUserInitials(fullName, email);

  const connectedCount = useEmailCaptureStore((s) => s.accounts.length);

  const themePreference = useSettingsStore((s) => s.themePreference);
  const areAllNotificationsOff = useSettingsStore((s) => s.areAllNotificationsOff);
  const privateBackupHealth = useSettingsStore((s) => s.privateBackup.health.status);
  const shareAnonymizedParseSamples = useSettingsStore((s) => s.shareAnonymizedParseSamples);
  const setShareAnonymizedParseSamples = useSettingsStore((s) => s.setShareAnonymizedParseSamples);

  const accentGreen = useThemeColor("accentGreen");
  const tertiaryColor = useThemeColor("tertiary");

  const themeLabel = t(THEME_LABEL_KEYS[themePreference] ?? "settings.themeSystem");

  const languageLabel = locale.startsWith("es")
    ? t("settings.languageSpanish")
    : t("settings.languageEnglish");

  const version = Constants.expoConfig?.version ?? "0.0.1";

  return (
    <ScreenLayout variant="sub" title={t("settings.title")} onBack={back}>
      {Platform.OS === "ios" && <Stack.Screen options={{ title: t("settings.title") }} />}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 16,
          gap: 24,
        }}
        contentInset={{ bottom: TAB_BAR_CLEARANCE }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* ACCOUNT */}
        <SettingsSection label={t("settings.accountSection")}>
          <Pressable
            onPress={() => push("/profile")}
            className="flex-row items-center"
            style={{
              height: 64,
              gap: 12,
              paddingHorizontal: 16,
            }}
          >
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 40,
                height: 40,
                backgroundColor: accentGreen,
              }}
            >
              <Text className="font-poppins-semibold text-white" style={{ fontSize: 14 }}>
                {initials}
              </Text>
            </View>
            <View className="flex-1" style={{ gap: 2 }}>
              <Text className="font-poppins text-sm text-primary dark:text-primary-dark">
                {fullName}
              </Text>
              <Text className="font-poppins text-xs text-secondary dark:text-secondary-dark">
                {email}
              </Text>
            </View>
            <ChevronRight size={18} color={tertiaryColor} />
          </Pressable>
        </SettingsSection>

        {/* PREFERENCES */}
        <SettingsSection label={t("settings.preferencesSection")}>
          <SettingsRow
            icon={Palette}
            label={t("settings.theme")}
            subtitle={themeLabel}
            onPress={() => push("/theme-picker")}
          />
          <SettingsRow
            icon={Globe}
            label={t("settings.language")}
            subtitle={languageLabel}
            onPress={() => push("/language-picker")}
          />
          <SettingsRow
            icon={Tag}
            label={t("categories.settingsRow")}
            onPress={() => push("/categories")}
            isLast
          />
        </SettingsSection>

        {/* CONNECTIONS */}
        <SettingsSection label={t("settings.connectionsSection")}>
          <SettingsRow
            icon={Mail}
            label={t("settings.connectedEmails")}
            subtitle={t("settings.connectedEmailsCount", {
              count: connectedCount,
            })}
            onPress={() => push("/connected-accounts")}
          />
          <SettingsRow
            icon={Wallet}
            label={t("financialAccounts.list.settingsRow")}
            onPress={() => push("/financial-accounts")}
          />
          <SettingsRow
            icon={Bell}
            label={t("settings.notifications")}
            subtitle={areAllNotificationsOff ? t("settings.off") : t("settings.on")}
            onPress={() => push("/notification-preferences")}
            isLast
          />
        </SettingsSection>

        {/* PRIVACY */}
        <SettingsSection label={t("settings.privacySection")}>
          <SettingsRow
            icon={KeyRound}
            label={t("settings.privateBackup")}
            subtitle={t(getPrivateBackupStatusLabelKey(privateBackupHealth))}
            onPress={() => push("/private-backup")}
          />
          <SettingsRow
            icon={Sparkles}
            label={t("settings.parseImprovementSharing")}
            subtitle={t("settings.parseImprovementSharingSubtitle")}
            accessory="switch"
            switchValue={shareAnonymizedParseSamples}
            onSwitchChange={setShareAnonymizedParseSamples}
            isLast
          />
        </SettingsSection>

        {/* APP */}
        <SettingsSection label={t("settings.appSection")}>
          <SettingsRow
            icon={HelpCircle}
            label={t("settings.helpSupport")}
            onPress={() => {
              void Linking.openURL(buildWhatsAppUrl("573003632142"));
            }}
          />
          <SettingsRow
            icon={Shield}
            label={t("settings.privacyPolicy")}
            onPress={() => {
              void openBrowserAsync(buildPrivacyUrl(locale));
            }}
          />
          <SettingsRow
            icon={FileText}
            label={t("settings.termsOfService")}
            onPress={() => {
              void openBrowserAsync(buildTermsUrl(locale));
            }}
          />
          <SettingsRow
            icon={Info}
            label={t("settings.version")}
            subtitle={version}
            accessory="none"
            isLast
          />
        </SettingsSection>
      </ScrollView>
    </ScreenLayout>
  );
}

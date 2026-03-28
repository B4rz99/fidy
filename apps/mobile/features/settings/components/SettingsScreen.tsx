import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useAuthStore } from "@/features/auth";
import { useEmailCaptureStore } from "@/features/email-capture";
import {
  buildPrivacyUrl,
  buildTermsUrl,
  buildWhatsAppUrl,
  getUserInitials,
  useSettingsStore,
} from "@/features/settings";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import {
  Bell,
  ChevronRight,
  FileText,
  Globe,
  HelpCircle,
  Info,
  Mail,
  Palette,
  Shield,
  Tag,
} from "@/shared/components/icons";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";

const THEME_LABEL_KEYS: Record<string, string> = {
  system: "settings.themeSystem",
  light: "settings.themeLight",
  dark: "settings.themeDark",
};

export function SettingsScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();

  const session = useAuthStore((s) => s.session);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- user_metadata.full_name is typed as any by Supabase
  const fullName: string = session?.user.user_metadata.full_name ?? "";
  const email = session?.user.email ?? "";
  const initials = getUserInitials(fullName, email);

  const connectedCount = useEmailCaptureStore((s) => s.accounts.length);

  const themePreference = useSettingsStore((s) => s.themePreference);
  const areAllNotificationsOff = useSettingsStore((s) => s.areAllNotificationsOff);

  const accentGreen = useThemeColor("accentGreen");
  const tertiaryColor = useThemeColor("tertiary");

  const themeLabel = t(THEME_LABEL_KEYS[themePreference] ?? "settings.themeSystem");

  const languageLabel = locale.startsWith("es")
    ? t("settings.languageSpanish")
    : t("settings.languageEnglish");

  const version = Constants.expoConfig?.version ?? "0.0.1";

  return (
    <ScreenLayout variant="tab" title={t("settings.title")}>
      {Platform.OS === "ios" && <Stack.Screen options={{ title: t("settings.title") }} />}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: TAB_BAR_CLEARANCE,
          gap: 24,
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* ACCOUNT */}
        <SettingsSection label={t("settings.accountSection")}>
          <Pressable
            onPress={() => router.push("/profile")}
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
            onPress={() => router.push("/theme-picker")}
          />
          <SettingsRow
            icon={Globe}
            label={t("settings.language")}
            subtitle={languageLabel}
            onPress={() => router.push("/language-picker")}
          />
          <SettingsRow
            icon={Tag}
            label={t("categories.settingsRow")}
            onPress={() => router.push("/categories")}
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
            onPress={() => router.push("/connected-accounts")}
          />
          <SettingsRow
            icon={Bell}
            label={t("settings.notifications")}
            subtitle={areAllNotificationsOff ? t("settings.off") : t("settings.on")}
            onPress={() => router.push("/notification-preferences")}
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

import Constants from "expo-constants";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { openBrowserAsync } from "expo-web-browser";
import { useAuthIdentity, useOptionalUserId } from "@/features/auth/public";
import {
  Surface,
  Row,
  ScreenLayout,
  SettingsSection,
  TAB_BAR_CLEARANCE,
} from "@/shared/components";
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
  Wrench,
} from "@/shared/components/icons";
import { Linking, ScrollView, Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { deriveProfileAvatar } from "../lib/profile-avatar";
import { buildPrivacyUrl, buildTermsUrl, buildWhatsAppUrl } from "../lib/settings-links";
import { useSettingsStore } from "../store";
import { applyParseImprovementSharingToggle } from "./parse-improvement-sharing-toggle";
import { SettingsRow } from "./SettingsRow";

const THEME_LABEL_KEYS: Record<string, string> = {
  system: "settings.themeSystem",
  light: "settings.themeLight",
  dark: "settings.themeDark",
};

export function SettingsScreen() {
  const { push, replace, back, canGoBack } = useRouter();
  const { t, locale } = useTranslation();

  const { fullName, email, profileImageUrl } = useAuthIdentity();
  const userId = useOptionalUserId();
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const avatar = deriveProfileAvatar({
    fullName,
    email,
    profileImageUrl,
    didImageFail: profileImageUrl === failedImageUrl,
  });

  const themePreference = useSettingsStore((s) => s.themePreference);
  const shareAnonymizedParseSamples = useSettingsStore((s) => s.shareAnonymizedParseSamples);
  const setShareAnonymizedParseSamples = useSettingsStore((s) => s.setShareAnonymizedParseSamples);

  const accentGreen = useThemeColor("accentGreen");
  const tertiaryColor = useThemeColor("tertiary");

  const themeLabel = t(THEME_LABEL_KEYS[themePreference] ?? "settings.themeSystem");

  const languageLabel = locale.startsWith("es")
    ? t("settings.languageSpanish")
    : t("settings.languageEnglish");

  const version = Constants.expoConfig?.version ?? "0.0.1";
  const handleBack = () => {
    if (canGoBack()) {
      back();
      return;
    }
    replace("/(tabs)/(index)");
  };
  const handleParseImprovementSharingChange = (enabled: boolean) =>
    applyParseImprovementSharingToggle({
      enabled,
      userId,
      setShareAnonymizedParseSamples,
    });

  return (
    <ScreenLayout variant="sub" title={t("settings.title")} onBack={handleBack}>
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
          <Row
            onPress={() => push("/profile")}
            title={fullName}
            subtitle={email}
            titleClassName="text-sm"
            subtitleClassName="text-xs"
            isLast
            leading={
              <Surface
                radius={20}
                padded={false}
                style={{
                  width: 40,
                  height: 40,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {avatar.type === "image" ? (
                  <Image
                    source={{ uri: avatar.uri }}
                    style={{ width: 40, height: 40 }}
                    contentFit="cover"
                    onError={() => setFailedImageUrl(avatar.uri)}
                  />
                ) : (
                  <Text
                    className="font-poppins-semibold"
                    style={{ color: accentGreen, fontSize: 14 }}
                  >
                    {avatar.initials}
                  </Text>
                )}
              </Surface>
            }
            trailing={<ChevronRight size={18} color={tertiaryColor} />}
          />
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
            onPress={() => push("/notification-preferences")}
            isLast
          />
        </SettingsSection>

        {/* PRIVACY */}
        <SettingsSection label={t("settings.privacySection")}>
          <SettingsRow
            icon={KeyRound}
            label={t("settings.privateBackup")}
            onPress={() => push("/private-backup")}
          />
          <SettingsRow
            icon={Sparkles}
            label={t("settings.parseImprovementSharing")}
            subtitle={t("settings.parseImprovementSharingSubtitle")}
            accessory="switch"
            switchValue={shareAnonymizedParseSamples}
            onSwitchChange={handleParseImprovementSharingChange}
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
          {__DEV__ ? (
            <SettingsRow
              icon={Wrench}
              label={t("settings.designSystem")}
              subtitle={t("settings.designSystemSubtitle")}
              onPress={() => push("/design-system")}
            />
          ) : null}
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

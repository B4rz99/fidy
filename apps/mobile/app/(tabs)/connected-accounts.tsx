import { formatDistanceToNow } from "date-fns";
import { useRouter } from "expo-router";
import { ApplePaySetupCard, NotificationSetupCard } from "@/features/capture-sources";
import {
  getGmailClientId,
  getOutlookClientId,
  useEmailCaptureStore,
} from "@/features/email-capture";
import { ScreenLayout } from "@/shared/components";
import { Mail } from "@/shared/components/icons";
import { Platform, Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";

export default function ConnectedAccountsScreen() {
  const { back, navigate } = useRouter();
  const { t } = useTranslation();
  const accounts = useEmailCaptureStore((s) => s.accounts);
  const connectEmail = useEmailCaptureStore((s) => s.connectEmail);
  const disconnectEmail = useEmailCaptureStore((s) => s.disconnectEmail);
  const greenColor = useThemeColor("accentGreen");
  const tertiaryColor = useThemeColor("tertiary");

  const gmailAccount = accounts.find((a) => a.provider === "gmail");
  const outlookAccount = accounts.find((a) => a.provider === "outlook");

  return (
    <ScreenLayout
      title={t("connectedAccounts.title")}
      variant="sub"
      onBack={() => navigate("/(tabs)/menu")}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
        className="flex-1 px-4"
      >
        <View style={{ gap: 24 }}>
          <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
            {t("connectedAccounts.subtitle")}
          </Text>

          {/* Email accounts */}
          <AccountCard
            provider="Gmail"
            account={gmailAccount}
            greenColor={greenColor}
            tertiaryColor={tertiaryColor}
            onConnect={() => connectEmail("gmail", getGmailClientId())}
            onDisconnect={() => gmailAccount && disconnectEmail(gmailAccount.id)}
          />

          <AccountCard
            provider="Outlook"
            account={outlookAccount}
            greenColor={greenColor}
            tertiaryColor={tertiaryColor}
            onConnect={() => connectEmail("outlook", getOutlookClientId())}
            onDisconnect={() => outlookAccount && disconnectEmail(outlookAccount.id)}
          />

          {/* Platform-specific capture sources */}
          {Platform.OS === "android" && <NotificationSetupCard />}
          {Platform.OS === "ios" && <ApplePaySetupCard />}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

type AccountCardProps = {
  provider: string;
  account: { email: string; lastFetchedAt?: string | null } | undefined;
  greenColor: string;
  tertiaryColor: string;
  onConnect: () => void;
  onDisconnect: () => void;
};

function AccountCard({
  provider,
  account,
  greenColor,
  tertiaryColor,
  onConnect,
  onDisconnect,
}: AccountCardProps) {
  const { t, locale } = useTranslation();
  const iconColor = useThemeColor("primary");

  if (account) {
    return (
      <View className="rounded-chart bg-card p-5 dark:bg-card-dark" style={{ gap: 14 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: greenColor }} />
            <Text className="font-poppins-semibold text-section text-primary dark:text-primary-dark">
              {provider}
            </Text>
          </View>
          <View className="rounded-lg bg-accent-green-light px-2.5 py-1 dark:bg-accent-green-light-dark">
            <Text className="font-poppins-semibold text-[11px] text-accent-green dark:text-accent-green-dark">
              {t("connectedAccounts.connected")}
            </Text>
          </View>
        </View>

        <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark">
          {account.email}
        </Text>

        <Text className="font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          {account.lastFetchedAt
            ? t("connectedAccounts.lastSynced", {
                time: formatDistanceToNow(new Date(account.lastFetchedAt), {
                  addSuffix: true,
                  locale: getDateFnsLocale(locale),
                }),
              })
            : t("connectedAccounts.notSyncedYet")}
        </Text>

        <Pressable
          onPress={onDisconnect}
          className="h-10 items-center justify-center rounded-[10px]"
          style={{ borderWidth: 1, borderColor: "#D45B5B33" }}
        >
          <Text className="font-poppins-medium text-label text-accent-red dark:text-accent-red-dark">
            {t("connectedAccounts.disconnect")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="rounded-chart bg-card p-5 dark:bg-card-dark" style={{ gap: 14 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tertiaryColor }}
          />
          <Text className="font-poppins-semibold text-section text-primary dark:text-primary-dark">
            {provider}
          </Text>
        </View>
        <View className="rounded-lg bg-peach-btn px-2.5 py-1 dark:bg-peach-btn-dark">
          <Text className="font-poppins-semibold text-[11px] text-tertiary dark:text-tertiary-dark">
            {t("connectedAccounts.notConnected")}
          </Text>
        </View>
      </View>

      <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
        {t("connectedAccounts.connectDescription", { provider })}
      </Text>

      <Pressable
        onPress={onConnect}
        className="h-11 flex-row items-center justify-center rounded-icon bg-peach-btn dark:bg-peach-btn-dark"
        style={{ gap: 8 }}
      >
        <Mail size={18} color={iconColor} />
        <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
          {t("connectedAccounts.connectProvider", { provider })}
        </Text>
      </Pressable>
    </View>
  );
}

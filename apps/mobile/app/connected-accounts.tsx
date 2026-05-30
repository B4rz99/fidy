import { formatDistanceToNow } from "date-fns";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { useOptionalUserId } from "@/features/auth";
import { ApplePaySetupCard, NotificationSetupCard } from "@/features/capture-sources";
import {
  connectEmailAccount,
  disconnectEmailAccount,
  getGmailClientId,
  getOutlookClientId,
  useEmailCaptureStore,
} from "@/features/email-capture";
import { Button, Card, ScreenLayout } from "@/shared/components";
import { Mail } from "@/shared/components/icons";
import { Platform, ScrollView, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { usePulsingOpacity, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";

export default function ConnectedAccountsScreen() {
  const { back } = useRouter();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const accounts = useEmailCaptureStore((s) => s.accounts);
  const isFetching = useEmailCaptureStore((s) => s.isFetching);

  const gmailAccount = accounts.find((a) => a.provider === "gmail");
  const outlookAccount = accounts.find((a) => a.provider === "outlook");

  return (
    <ScreenLayout title={t("connectedAccounts.title")} variant="sub" onBack={() => back()}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentInset={{ bottom: bottom + 40 }}
        contentContainerStyle={{ paddingBottom: bottom + 40 }}
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
            isSyncing={isFetching && Boolean(gmailAccount)}
            onConnect={() => {
              if (!db || !userId) return;
              void connectEmailAccount(db, userId, "gmail", getGmailClientId());
            }}
            onDisconnect={() => {
              if (!db || !userId || !gmailAccount) return;
              void disconnectEmailAccount(db, userId, gmailAccount.id);
            }}
          />

          <AccountCard
            provider="Outlook"
            account={outlookAccount}
            isSyncing={isFetching && Boolean(outlookAccount)}
            onConnect={() => {
              if (!db || !userId) return;
              void connectEmailAccount(db, userId, "outlook", getOutlookClientId());
            }}
            onDisconnect={() => {
              if (!db || !userId || !outlookAccount) return;
              void disconnectEmailAccount(db, userId, outlookAccount.id);
            }}
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
  isSyncing: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
};

function AccountCard({ provider, account, isSyncing, onConnect, onDisconnect }: AccountCardProps) {
  const { t, locale } = useTranslation();
  const iconColor = useThemeColor("primary");
  const greenColor = useThemeColor("accentGreen");
  const tertiaryColor = useThemeColor("tertiary");

  const { pulsingStyle: dotAnimatedStyle } = usePulsingOpacity(isSyncing);

  if (account) {
    const syncStatusText = (() => {
      if (isSyncing) return t("connectedAccounts.syncing");
      if (!account.lastFetchedAt) return t("connectedAccounts.notSyncedYet");

      return t("connectedAccounts.lastSynced", {
        time: formatDistanceToNow(new Date(account.lastFetchedAt), {
          addSuffix: true,
          locale: getDateFnsLocale(locale),
        }),
      });
    })();

    return (
      <Card padded={false} className="rounded-chart" style={{ gap: 14, padding: 20 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Animated.View
              style={[
                { width: 10, height: 10, borderRadius: 5, backgroundColor: greenColor },
                dotAnimatedStyle,
              ]}
            />
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
          {syncStatusText}
        </Text>

        <Button
          label={t("connectedAccounts.disconnect")}
          onPress={onDisconnect}
          variant="dangerSecondary"
          size="compact"
          className="h-10 rounded-[10px]"
        />
      </Card>
    );
  }

  return (
    <Card padded={false} className="rounded-chart" style={{ gap: 14, padding: 20 }}>
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

      <Button
        label={t("connectedAccounts.connectProvider", { provider })}
        onPress={onConnect}
        variant="secondary"
        icon={<Mail size={18} color={iconColor} />}
        className="h-11 rounded-icon bg-peach-btn dark:bg-peach-btn-dark"
      />
    </Card>
  );
}

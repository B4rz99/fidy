import { formatDistanceToNow } from "date-fns";
import { useRouter } from "expo-router";
import { ChevronLeft, Mail } from "lucide-react-native";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApplePaySetupCard } from "@/features/capture-sources/components/ApplePaySetupCard";
import { NotificationSetupCard } from "@/features/capture-sources/components/NotificationSetupCard";
import { GMAIL_CLIENT_ID, OUTLOOK_CLIENT_ID } from "@/features/email-capture/schema";
import { useEmailCaptureStore } from "@/features/email-capture/store";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

export default function ConnectedAccountsScreen() {
  const insets = useSafeAreaInsets();
  const { back } = useRouter();
  const accounts = useEmailCaptureStore((s) => s.accounts);
  const connectEmail = useEmailCaptureStore((s) => s.connectEmail);
  const disconnectEmail = useEmailCaptureStore((s) => s.disconnectEmail);
  const primaryColor = useThemeColor("primary");
  const greenColor = useThemeColor("accentGreen");
  const tertiaryColor = useThemeColor("tertiary");

  const gmailAccount = accounts.find((a) => a.provider === "gmail");
  const outlookAccount = accounts.find((a) => a.provider === "outlook");

  return (
    <View className="flex-1 bg-page dark:bg-page-dark">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: Platform.OS === "android" ? insets.top : 0,
          paddingBottom: 40,
        }}
        className="flex-1 px-5"
      >
        <View style={{ gap: 24 }}>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Pressable onPress={() => back()} hitSlop={12}>
              <ChevronLeft size={24} color={primaryColor} />
            </Pressable>
            <Text className="font-poppins-bold text-title text-primary dark:text-primary-dark">
              Connected Sources
            </Text>
          </View>

          <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
            Manage your connected accounts and capture sources for automatic transaction tracking.
          </Text>

          {/* Email accounts */}
          <AccountCard
            provider="Gmail"
            account={gmailAccount}
            greenColor={greenColor}
            tertiaryColor={tertiaryColor}
            onConnect={() => connectEmail("gmail", GMAIL_CLIENT_ID)}
            onDisconnect={() => gmailAccount && disconnectEmail(gmailAccount.id)}
          />

          <AccountCard
            provider="Outlook"
            account={outlookAccount}
            greenColor={greenColor}
            tertiaryColor={tertiaryColor}
            onConnect={() => connectEmail("outlook", OUTLOOK_CLIENT_ID)}
            onDisconnect={() => outlookAccount && disconnectEmail(outlookAccount.id)}
          />

          {/* Platform-specific capture sources */}
          {Platform.OS === "android" && <NotificationSetupCard />}
          {Platform.OS === "ios" && <ApplePaySetupCard />}
        </View>
      </ScrollView>
    </View>
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
              Connected
            </Text>
          </View>
        </View>

        <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark">
          {account.email}
        </Text>

        <Text className="font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          {account.lastFetchedAt
            ? `Last synced: ${formatDistanceToNow(new Date(account.lastFetchedAt), { addSuffix: true })}`
            : "Not synced yet"}
        </Text>

        <Pressable
          onPress={onDisconnect}
          className="h-10 items-center justify-center rounded-[10px]"
          style={{ borderWidth: 1, borderColor: "#D45B5B33" }}
        >
          <Text className="font-poppins-medium text-label text-accent-red dark:text-accent-red-dark">
            Disconnect
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
            Not connected
          </Text>
        </View>
      </View>

      <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
        Connect your {provider} account to capture bank emails.
      </Text>

      <Pressable
        onPress={onConnect}
        className="h-11 flex-row items-center justify-center rounded-icon bg-peach-btn dark:bg-peach-btn-dark"
        style={{ gap: 8 }}
      >
        <Mail size={18} color={iconColor} />
        <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
          Connect {provider}
        </Text>
      </Pressable>
    </View>
  );
}

import { useRouter } from "expo-router";
import { ChevronLeft, Mail } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEmailCaptureStore } from "@/features/email-capture/store";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

export default function ConnectedAccountsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40 }}
        className="flex-1 px-5"
      >
        <View style={{ gap: 24 }}>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ChevronLeft size={24} color={primaryColor} />
            </Pressable>
            <Text className="font-poppins-bold text-title text-primary dark:text-primary-dark">
              Connected Accounts
            </Text>
          </View>

          <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
            Manage your connected email accounts for automatic bank transaction capture.
          </Text>

          <AccountCard
            provider="Gmail"
            account={gmailAccount}
            greenColor={greenColor}
            tertiaryColor={tertiaryColor}
            onConnect={() => connectEmail("gmail", "")}
            onDisconnect={() => gmailAccount && disconnectEmail(gmailAccount.id)}
          />

          <AccountCard
            provider="Outlook"
            account={outlookAccount}
            greenColor={greenColor}
            tertiaryColor={tertiaryColor}
            onConnect={() => connectEmail("outlook", "")}
            onDisconnect={() => outlookAccount && disconnectEmail(outlookAccount.id)}
          />
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
            ? `Last synced: ${formatTimeAgo(account.lastFetchedAt)}`
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

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

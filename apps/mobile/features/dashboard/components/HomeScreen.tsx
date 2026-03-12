import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useMemo } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DetectedTransactionsBanner } from "@/features/capture-sources/components/DetectedTransactionsBanner";
import { EmailConnectBanner } from "@/features/email-capture/components/EmailConnectBanner";
import { FailedEmailsBanner } from "@/features/email-capture/components/FailedEmailsBanner";
import { getGmailClientId, getOutlookClientId } from "@/features/email-capture/schema";
import { useEmailCaptureStore } from "@/features/email-capture/store";
import {
  deriveBalance,
  deriveDailySpending,
  deriveSpendingByCategory,
} from "@/features/transactions/lib/derive";
import { useTransactionStore } from "@/features/transactions/store";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { toIsoDate } from "@/shared/lib/format-date";
import { BalanceSection } from "./BalanceSection";
import { ChartSection } from "./ChartSection";
import { NeedsReviewBanner } from "./NeedsReviewBanner";
import { TransactionsPreview } from "./TransactionsPreview";

const Header = () => {
  const iconColor = useThemeColor("primary");

  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-poppins-extrabold text-logo text-primary dark:text-primary-dark">
        fidy
      </Text>
      <Bell size={22} color={iconColor} />
    </View>
  );
};

const TAB_BAR_CLEARANCE = 100;

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const { push } = useRouter();
  const connectEmail = useEmailCaptureStore((s) => s.connectEmail);
  const transactions = useTransactionStore((s) => s.transactions);
  const balanceCents = useMemo(() => deriveBalance(transactions), [transactions]);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  const categorySpending = useMemo(
    () => deriveSpendingByCategory(transactions, currentMonth),
    [transactions, currentMonth]
  );
  const dailySpending = useMemo(
    () => deriveDailySpending(transactions, toIsoDate(thirtyDaysAgo), toIsoDate(now)),
    [transactions, thirtyDaysAgo, now]
  );
  const totalSpentCents = useMemo(
    () => categorySpending.reduce((sum, c) => sum + c.totalCents, 0),
    [categorySpending]
  );

  return (
    <View className="flex-1 bg-page dark:bg-page-dark">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: Platform.OS === "android" ? insets.top : 0,
          paddingBottom: TAB_BAR_CLEARANCE,
        }}
        className="flex-1 px-5"
      >
        <View className="gap-4">
          <Header />
          <EmailConnectBanner
            onConnect={(provider) => {
              const clientId = provider === "gmail" ? getGmailClientId() : getOutlookClientId();
              connectEmail(provider, clientId);
            }}
          />
          <FailedEmailsBanner onPress={() => push("/failed-emails" as never)} />
          <NeedsReviewBanner onPress={() => push("/needs-review" as never)} />
          {Platform.OS === "ios" && (
            <DetectedTransactionsBanner onPress={() => push("/connected-accounts" as never)} />
          )}
          <BalanceSection balanceCents={balanceCents} />
          <ChartSection
            categorySpending={categorySpending}
            dailySpending={dailySpending}
            totalSpentCents={totalSpentCents}
          />
          <TransactionsPreview />
        </View>
      </ScrollView>
    </View>
  );
};

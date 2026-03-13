import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useMemo } from "react";
import { Platform, ScrollView, View } from "react-native";
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
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components/ScreenLayout";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { toIsoDate } from "@/shared/lib/format-date";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components/ScreenLayout";
import { BalanceSection } from "./BalanceSection";
import { ChartSection } from "./ChartSection";
import { NeedsReviewBanner } from "./NeedsReviewBanner";
import { TransactionsPreview } from "./TransactionsPreview";

const BellAction = () => {
  const iconColor = useThemeColor("primary");
  return <Bell size={22} color={iconColor} />;
};

export const HomeScreen = () => {
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
    <ScreenLayout title="fidy" rightActions={<BellAction />}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        className="flex-1 px-4"
      >
        <View className="gap-4">
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
    </ScreenLayout>
  );
};

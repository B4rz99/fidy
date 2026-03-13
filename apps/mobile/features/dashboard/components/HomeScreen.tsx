import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, type LayoutChangeEvent, Platform, Text, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { DetectedTransactionsBanner } from "@/features/capture-sources/components/DetectedTransactionsBanner";
import { EmailConnectBanner } from "@/features/email-capture/components/EmailConnectBanner";
import { FailedEmailsBanner } from "@/features/email-capture/components/FailedEmailsBanner";
import { getGmailClientId, getOutlookClientId } from "@/features/email-capture/schema";
import { useEmailCaptureStore } from "@/features/email-capture/store";
import {
  groupTransactionsByDate,
  type TransactionListItem,
} from "@/features/transactions/lib/group-transactions";
import { useTransactionStore } from "@/features/transactions/store";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components/ScreenLayout";
import { TransactionRow } from "@/shared/components/TransactionRow";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { BalanceSection } from "./BalanceSection";
import { ChartSection } from "./ChartSection";
import { CompactBalanceBar } from "./CompactBalanceBar";
import { DateSectionHeader } from "./DateSectionHeader";
import { NeedsReviewBanner } from "./NeedsReviewBanner";

const BellAction = () => {
  const iconColor = useThemeColor("primary");
  return <Bell size={22} color={iconColor} />;
};

const renderScrollComponent = (props: object) => (
  <Animated.ScrollView {...props} />
);

export const HomeScreen = () => {
  const { push } = useRouter();
  const connectEmail = useEmailCaptureStore((s) => s.connectEmail);

  const displayTransactions = useTransactionStore((s) => s.transactions);
  const balanceCents = useTransactionStore((s) => s.balanceCents);
  const categorySpending = useTransactionStore((s) => s.categorySpending);
  const dailySpending = useTransactionStore((s) => s.dailySpending);
  const isLoadingMore = useTransactionStore((s) => s.isLoadingMore);
  const loadNextPage = useTransactionStore((s) => s.loadNextPage);

  const now = useMemo(() => new Date(), []);
  const listData = useMemo(
    () => groupTransactionsByDate(displayTransactions, now),
    [displayTransactions, now]
  );

  const totalSpentCents = useMemo(
    () => categorySpending.reduce((sum, c) => sum + c.totalCents, 0),
    [categorySpending]
  );

  const scrollY = useSharedValue(0);
  const balanceSectionBottom = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleBalanceLayout = useCallback(
    (event: LayoutChangeEvent) => {
      balanceSectionBottom.value =
        event.nativeEvent.layout.y + event.nativeEvent.layout.height;
    },
    [balanceSectionBottom]
  );

  const handleEndReached = useCallback(() => {
    loadNextPage();
  }, [loadNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: TransactionListItem }) => {
      if (item.type === "section-header") {
        return <DateSectionHeader label={item.label} />;
      }
      const { data } = item;
      return (
        <TransactionRow
          description={data.description}
          amountCents={data.amountCents}
          type={data.type}
          categoryId={data.categoryId}
          dateLabel={format(data.date, "MMM d, yyyy")}
        />
      );
    },
    []
  );

  const keyExtractor = useCallback(
    (item: TransactionListItem) =>
      item.type === "section-header" ? `header-${item.date}` : item.data.id,
    []
  );

  const getItemType = useCallback(
    (item: TransactionListItem) => item.type,
    []
  );

  const ListHeader = useCallback(
    () => (
      <View className="gap-4">
        <EmailConnectBanner
          onConnect={(provider) => {
            const clientId =
              provider === "gmail" ? getGmailClientId() : getOutlookClientId();
            connectEmail(provider, clientId);
          }}
        />
        <FailedEmailsBanner onPress={() => push("/failed-emails" as never)} />
        <NeedsReviewBanner onPress={() => push("/needs-review" as never)} />
        {Platform.OS === "ios" && (
          <DetectedTransactionsBanner
            onPress={() => push("/connected-accounts" as never)}
          />
        )}
        <View onLayout={handleBalanceLayout}>
          <BalanceSection balanceCents={balanceCents} />
        </View>
        <ChartSection
          categorySpending={categorySpending}
          dailySpending={dailySpending}
          totalSpentCents={totalSpentCents}
        />
      </View>
    ),
    [
      balanceCents,
      categorySpending,
      connectEmail,
      dailySpending,
      handleBalanceLayout,
      push,
      totalSpentCents,
    ]
  );

  const ListFooter = useCallback(
    () =>
      isLoadingMore ? (
        <View className="items-center py-4">
          <ActivityIndicator />
        </View>
      ) : null,
    [isLoadingMore]
  );

  const ListEmpty = useCallback(
    () => (
      <View className="items-center py-8">
        <Text className="font-poppins-medium text-body text-secondary dark:text-secondary-dark">
          No transactions yet
        </Text>
      </View>
    ),
    []
  );

  return (
    <ScreenLayout title="fidy" rightActions={<BellAction />}>
      <View className="flex-1">
        <CompactBalanceBar
          balanceCents={balanceCents}
          scrollY={scrollY}
          balanceSectionBottom={balanceSectionBottom}
        />
        <FlashList
          data={listData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          estimatedItemSize={56}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.2}
          onScroll={scrollHandler}
          renderScrollComponent={renderScrollComponent}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={ListEmpty}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: TAB_BAR_CLEARANCE,
          }}
        />
      </View>
    </ScreenLayout>
  );
};

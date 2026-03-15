import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Bell, Ellipsis } from "lucide-react-native";
import { memo, useCallback, useMemo, useState } from "react";
import { type LayoutChangeEvent, Platform, View } from "react-native";
import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { DetectedTransactionsBanner } from "@/features/capture-sources/components/DetectedTransactionsBanner";
import { EmailConnectBanner } from "@/features/email-capture/components/EmailConnectBanner";
import { FailedEmailsBanner } from "@/features/email-capture/components/FailedEmailsBanner";
import { getGmailClientId, getOutlookClientId } from "@/features/email-capture/schema";
import { useEmailCaptureStore } from "@/features/email-capture/store";
import { CATEGORY_MAP } from "@/features/transactions/lib/categories";
import { formatSignedAmount } from "@/features/transactions/lib/format-amount";
import {
  buildListData,
  isDateHeader,
  type ListItem,
} from "@/features/transactions/lib/group-by-date";
import type { StoredTransaction } from "@/features/transactions/schema";
import { useTransactionStore } from "@/features/transactions/store";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components/ScreenLayout";
import { TransactionRow } from "@/shared/components/TransactionRow";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { BalanceSection } from "./BalanceSection";
import { ChartSection } from "./ChartSection";
import { CompactBalanceBar } from "./CompactBalanceBar";
import { DateHeader } from "./DateHeader";
import { NeedsReviewBanner } from "./NeedsReviewBanner";

const BellAction = () => {
  const iconColor = useThemeColor("primary");
  return <Bell size={22} color={iconColor} />;
};

const TransactionItem = memo(function TransactionItem({ tx }: { tx: StoredTransaction }) {
  const category = CATEGORY_MAP[tx.categoryId];
  return (
    <View className="px-4">
      <TransactionRow
        icon={category?.icon ?? Ellipsis}
        name={tx.description || "Unknown"}
        amount={formatSignedAmount(tx.amountCents, tx.type)}
        category={category?.label.en ?? "Other"}
        isPositive={tx.type === "income"}
      />
    </View>
  );
});

type ListHeaderProps = {
  readonly balanceCents: number;
  readonly categorySpending: readonly {
    readonly categoryId: string;
    readonly totalCents: number;
  }[];
  readonly dailySpending: readonly { readonly date: string; readonly totalCents: number }[];
  readonly onBalanceLayout: (e: LayoutChangeEvent) => void;
};

const ListHeader = memo(function ListHeader({
  balanceCents,
  categorySpending,
  dailySpending,
  onBalanceLayout,
}: ListHeaderProps) {
  const { push } = useRouter();
  const connectEmail = useEmailCaptureStore((s) => s.connectEmail);

  const totalSpentCents = useMemo(
    () => categorySpending.reduce((sum, c) => sum + c.totalCents, 0),
    [categorySpending]
  );

  return (
    <View className="gap-4 px-4">
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
      <View onLayout={onBalanceLayout}>
        <BalanceSection balanceCents={balanceCents} />
      </View>
      <ChartSection
        categorySpending={categorySpending}
        dailySpending={dailySpending}
        totalSpentCents={totalSpentCents}
      />
    </View>
  );
});

export const HomeScreen = () => {
  const pages = useTransactionStore((s) => s.pages);
  const hasMore = useTransactionStore((s) => s.hasMore);
  const isLoadingMore = useTransactionStore((s) => s.isLoadingMore);
  const loadNextPage = useTransactionStore((s) => s.loadNextPage);
  const balanceCents = useTransactionStore((s) => s.balanceCents);
  const categorySpending = useTransactionStore((s) => s.categorySpending);
  const dailySpending = useTransactionStore((s) => s.dailySpending);

  const scrollY = useSharedValue(0);
  const [balanceBottom, setBalanceBottom] = useState(0);

  const { items, stickyIndices } = useMemo(() => buildListData(pages), [pages]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleBalanceLayout = useCallback((e: LayoutChangeEvent) => {
    const newBottom = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
    setBalanceBottom((prev) => (prev === newBottom ? prev : newBottom));
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadNextPage();
    }
  }, [hasMore, isLoadingMore, loadNextPage]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (isDateHeader(item)) {
      return <DateHeader label={item.label} />;
    }
    return <TransactionItem tx={item} />;
  }, []);

  const keyExtractor = useCallback((item: ListItem) => {
    if (isDateHeader(item)) {
      return `header-${item.dateKey}`;
    }
    return item.id;
  }, []);

  const getItemType = useCallback((item: ListItem) => {
    return isDateHeader(item) ? "date-header" : "transaction";
  }, []);

  const listHeader = useMemo(
    () => (
      <ListHeader
        balanceCents={balanceCents}
        categorySpending={categorySpending}
        dailySpending={dailySpending}
        onBalanceLayout={handleBalanceLayout}
      />
    ),
    [balanceCents, categorySpending, dailySpending, handleBalanceLayout]
  );

  const listFooter = useMemo(() => <View style={{ height: TAB_BAR_CLEARANCE }} />, []);

  return (
    <ScreenLayout
      title="fidy"
      rightActions={<BellAction />}
      headerOverlay={
        <CompactBalanceBar
          balanceCents={balanceCents}
          scrollY={scrollY}
          threshold={balanceBottom}
        />
      }
    >
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        stickyHeaderIndices={stickyIndices}
        onEndReached={handleEndReached}
        onEndReachedThreshold={1.5}
        onScroll={scrollHandler}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        estimatedItemSize={64}
        showsVerticalScrollIndicator={false}
      />
    </ScreenLayout>
  );
};

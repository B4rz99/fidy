import { useRouter } from "expo-router";
import { Bell, Ellipsis } from "lucide-react-native";
import { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  View,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { DetectedTransactionsBanner } from "@/features/capture-sources/components/DetectedTransactionsBanner";
import { EmailConnectBanner } from "@/features/email-capture/components/EmailConnectBanner";
import { FailedEmailsBanner } from "@/features/email-capture/components/FailedEmailsBanner";
import { getGmailClientId, getOutlookClientId } from "@/features/email-capture/schema";
import { useEmailCaptureStore } from "@/features/email-capture/store";
import { SyncConflictBanner } from "@/features/sync/components/SyncConflictBanner";
import { CATEGORY_MAP } from "@/features/transactions/lib/categories";
import { formatSignedAmount } from "@/features/transactions/lib/format-amount";
import { makeDateLabel } from "@/features/transactions/lib/group-by-date";
import type { StoredTransaction } from "@/features/transactions/schema";
import { useTransactionStore } from "@/features/transactions/store";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components/ScreenLayout";
import { TransactionRow } from "@/shared/components/TransactionRow";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { toIsoDate } from "@/shared/lib/format-date";
import { BalanceSection } from "./BalanceSection";
import { ChartSection } from "./ChartSection";
import { CompactBalanceBar } from "./CompactBalanceBar";
import { DateHeader } from "./DateHeader";
import { EmailProgressCard } from "@/features/email-capture/components/EmailProgressCard";
import { buildProgressDisplay } from "@/features/email-capture/lib/progress-phases";
import { EmptyTransactions } from "./EmptyTransactions";
import { NeedsReviewBanner } from "./NeedsReviewBanner";

const BellAction = () => {
  const iconColor = useThemeColor("primary");
  return <Bell size={22} color={iconColor} />;
};

const TransactionItem = memo(function TransactionItem({
  tx,
  showDateHeader,
}: {
  tx: StoredTransaction;
  showDateHeader: boolean;
}) {
  const category = CATEGORY_MAP[tx.categoryId];
  return (
    <View>
      {showDateHeader && <DateHeader label={makeDateLabel(tx.date)} />}
      <View className="px-4">
        <TransactionRow
          icon={category?.icon ?? Ellipsis}
          name={tx.description || "Unknown"}
          amount={formatSignedAmount(tx.amountCents, tx.type)}
          category={category?.label.en ?? "Other"}
          isPositive={tx.type === "income"}
        />
      </View>
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
  const phase = useEmailCaptureStore((s) => s.phase);
  const progress = useEmailCaptureStore((s) => s.progress);
  const clearProgress = useEmailCaptureStore((s) => s.clearProgress);

  const totalSpentCents = useMemo(
    () => categorySpending.reduce((sum, c) => sum + c.totalCents, 0),
    [categorySpending]
  );

  const progressDisplay = useMemo(
    () => (phase ? buildProgressDisplay(phase, progress, []) : null),
    [phase, progress]
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
      {phase && progressDisplay && (
        <EmailProgressCard phase={phase} display={progressDisplay} onComplete={clearProgress} />
      )}
      {!phase && <NeedsReviewBanner onPress={() => push("/needs-review" as never)} />}
      <SyncConflictBanner onPress={() => push("/sync-conflicts" as never)} />
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
  const loadNextPage = useTransactionStore((s) => s.loadNextPage);
  const balanceCents = useTransactionStore((s) => s.balanceCents);
  const categorySpending = useTransactionStore((s) => s.categorySpending);
  const dailySpending = useTransactionStore((s) => s.dailySpending);
  const phase = useEmailCaptureStore((s) => s.phase);

  const scrollY = useSharedValue(0);
  const [balanceBottom, setBalanceBottom] = useState(-1);

  // Pre-compute which transactions are the first of their date group
  const dateBreaks = useMemo(() => {
    const breaks = new Set<string>();
    let lastDateKey: string | null = null;
    pages.forEach((tx) => {
      const dateKey = toIsoDate(tx.date);
      if (dateKey !== lastDateKey) {
        breaks.add(tx.id);
        lastDateKey = dateKey;
      }
    });
    return breaks;
  }, [pages]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [scrollY]
  );

  const handleBalanceLayout = useCallback((e: LayoutChangeEvent) => {
    const newBottom = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
    setBalanceBottom((prev) => (prev === newBottom ? prev : newBottom));
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasMore) {
      loadNextPage();
    }
  }, [hasMore, loadNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: StoredTransaction }) => {
      return <TransactionItem tx={item} showDateHeader={dateBreaks.has(item.id)} />;
    },
    [dateBreaks]
  );

  const keyExtractor = useCallback((item: StoredTransaction) => item.id, []);

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
      <FlatList
        data={pages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.1}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={phase === null ? <EmptyTransactions /> : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      />
    </ScreenLayout>
  );
};

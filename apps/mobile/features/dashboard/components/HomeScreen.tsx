import { useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import { DetectedTransactionsBanner } from "@/features/capture-sources";
import {
  EmailConnectBanner,
  FailedEmailsBanner,
  getGmailClientId,
  getOutlookClientId,
  useEmailCaptureStore,
} from "@/features/email-capture";
import { SearchAction } from "@/features/search";
import { SyncConflictBanner } from "@/features/sync";
import {
  CATEGORY_MAP,
  formatSignedAmount,
  makeDateLabel,
  type StoredTransaction,
  useTransactionStore,
} from "@/features/transactions";
import { ScreenLayout, TAB_BAR_CLEARANCE, TransactionRow } from "@/shared/components";
import { Bell, Ellipsis } from "@/shared/components/icons";
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  View,
} from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { toIsoDate } from "@/shared/lib";
import { BalanceSection } from "./BalanceSection";
import { ChartSection } from "./ChartSection";
import { CompactBalanceBar } from "./CompactBalanceBar";
import { DateHeader } from "./DateHeader";
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
  const { t, locale } = useTranslation();
  const category = CATEGORY_MAP[tx.categoryId];
  return (
    <View>
      {showDateHeader && (
        <DateHeader
          label={makeDateLabel(
            tx.date,
            t("dates.today"),
            t("dates.yesterday"),
            getDateFnsLocale(locale)
          )}
        />
      )}
      <View className="px-4">
        <TransactionRow
          icon={category?.icon ?? Ellipsis}
          name={tx.description || t("common.unknown")}
          amount={formatSignedAmount(tx.amountCents, tx.type)}
          category={category ? getCategoryLabel(category, locale) : t("common.other")}
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
  // phase gates ListEmptyComponent — suppresses "No transactions" during first sync
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
      rightActions={
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <SearchAction />
          <BellAction />
        </View>
      }
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

import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useMemo } from "react";
import { DetectedTransactionsBanner } from "@/features/capture-sources";
import {
  EmailConnectBanner,
  FailedEmailsBanner,
  getGmailClientId,
  getOutlookClientId,
  useEmailCaptureStore,
} from "@/features/email-capture";
import { BellAction } from "@/features/notifications";
import { SearchAction } from "@/features/search";
import { SyncConflictBanner } from "@/features/sync";
import {
  CATEGORY_MAP,
  makeDateLabel,
  type StoredTransaction,
  useTransactionStore,
} from "@/features/transactions";
import { ScreenLayout, TAB_BAR_CLEARANCE, TransactionRow } from "@/shared/components";
import { Ellipsis } from "@/shared/components/icons";
import { Alert, FlatList, Platform, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatSignedMoney, toIsoDate } from "@/shared/lib";
import type { CopAmount, TransactionId } from "@/shared/types/branded";
import { useDashboardStore } from "../store";
import { ChartSection } from "./ChartSection";
import { DateHeader } from "./DateHeader";
import { EmptyTransactions } from "./EmptyTransactions";
import { HeroCard } from "./HeroCard";
import { NeedsReviewBanner } from "./NeedsReviewBanner";
import { PeriodToggle } from "./PeriodToggle";

const TransactionItem = memo(function TransactionItem({
  tx,
  showDateHeader,
  onEdit,
  onDelete,
}: {
  tx: StoredTransaction;
  showDateHeader: boolean;
  onEdit: () => void;
  onDelete: () => void;
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
          amount={formatSignedMoney(tx.amount, tx.type)}
          category={category ? getCategoryLabel(category, locale) : t("common.other")}
          isPositive={tx.type === "income"}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </View>
    </View>
  );
});

type ListHeaderProps = {
  readonly period: import("../lib/derive").DashboardPeriod;
  readonly spentAmount: CopAmount;
  readonly categoryBreakdown: ReadonlyArray<
    import("@/features/analytics/lib/derive").CategoryBreakdownItem
  >;
  readonly dailySpending: ReadonlyArray<{ readonly date: string; readonly total: number }>;
  readonly totalSpent: number;
  readonly onPeriodChange: (period: import("../lib/derive").DashboardPeriod) => void;
  readonly onCategoryPress: () => void;
};

const ListHeader = memo(function ListHeader({
  period,
  spentAmount,
  categoryBreakdown,
  dailySpending,
  totalSpent,
  onPeriodChange,
  onCategoryPress,
}: ListHeaderProps) {
  const { push } = useRouter();
  const connectEmail = useEmailCaptureStore((s) => s.connectEmail);

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
      <PeriodToggle activePeriod={period} onSelect={onPeriodChange} />
      <HeroCard period={period} spentAmount={spentAmount} />
      <ChartSection
        categoryBreakdown={categoryBreakdown}
        dailySpending={dailySpending}
        totalSpent={totalSpent}
        onCategoryPress={onCategoryPress}
      />
    </View>
  );
});

export const HomeScreen = () => {
  const { push } = useRouter();
  const { t } = useTranslation();
  const pages = useTransactionStore((s) => s.pages);
  const hasMore = useTransactionStore((s) => s.hasMore);
  const loadNextPage = useTransactionStore((s) => s.loadNextPage);
  const editTransaction = useTransactionStore((s) => s.editTransaction);
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction);
  const period = useDashboardStore((s) => s.period);
  const periodSpent = useDashboardStore((s) => s.periodSpent);
  const periodCategorySpending = useDashboardStore((s) => s.periodCategorySpending);
  const periodDailySpending = useDashboardStore((s) => s.periodDailySpending);
  const setPeriod = useDashboardStore((s) => s.setPeriod);
  // phase gates ListEmptyComponent — suppresses "No transactions" during first sync
  const phase = useEmailCaptureStore((s) => s.phase);
  const primaryColor = useThemeColor("primary");

  const totalSpent = useMemo(
    () => periodCategorySpending.reduce((sum, c) => sum + c.total, 0),
    [periodCategorySpending]
  );

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

  const handleEndReached = useCallback(() => {
    if (hasMore) {
      loadNextPage();
    }
  }, [hasMore, loadNextPage]);

  const handleEdit = useCallback(
    (id: TransactionId) => {
      editTransaction(id);
      push("/(tabs)/add" as never);
    },
    [editTransaction, push]
  );

  const handleDelete = useCallback(
    (id: TransactionId) => {
      Alert.alert(t("transactions.deleteConfirmTitle"), t("transactions.deleteConfirmMessage"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => deleteTransaction(id),
        },
      ]);
    },
    [t, deleteTransaction]
  );

  const renderItem = useCallback(
    ({ item }: { item: StoredTransaction }) => {
      return (
        <TransactionItem
          tx={item}
          showDateHeader={dateBreaks.has(item.id)}
          onEdit={() => handleEdit(item.id)}
          onDelete={() => handleDelete(item.id)}
        />
      );
    },
    [dateBreaks, handleEdit, handleDelete]
  );

  const keyExtractor = useCallback((item: StoredTransaction) => item.id, []);

  const listHeader = useMemo(
    () => (
      <ListHeader
        period={period}
        spentAmount={periodSpent}
        categoryBreakdown={periodCategorySpending}
        dailySpending={periodDailySpending}
        totalSpent={totalSpent}
        onPeriodChange={setPeriod}
        onCategoryPress={() => push("/analytics" as never)}
      />
    ),
    [period, periodSpent, periodCategorySpending, periodDailySpending, totalSpent, setPeriod, push]
  );

  return (
    <ScreenLayout
      title="fidy"
      rightActions={
        Platform.OS !== "ios" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <SearchAction />
            <BellAction />
          </View>
        ) : undefined
      }
    >
      {Platform.OS === "ios" && (
        <Stack.Screen
          options={{
            headerTitle: () => (
              <Text
                style={{
                  fontFamily: "Poppins_800ExtraBold",
                  fontSize: 20,
                  color: primaryColor,
                }}
              >
                fidy
              </Text>
            ),
            headerRight: () => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 20,
                  paddingHorizontal: 4,
                }}
              >
                <SearchAction />
                <BellAction />
              </View>
            ),
          }}
        />
      )}
      <FlatList
        data={pages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.1}
        scrollEventThrottle={16}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={phase === null ? <EmptyTransactions /> : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        contentInsetAdjustmentBehavior="automatic"
      />
    </ScreenLayout>
  );
};

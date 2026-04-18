import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useMemo } from "react";
import { useOptionalUserId } from "@/features/auth";
import { DetectedTransactionsBanner } from "@/features/capture-sources";
import {
  connectEmailAccount,
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
  deleteTransaction,
  loadNextTransactions,
  loadTransactionIntoForm,
  makeDateLabel,
  type StoredTransaction,
  useTransactionStore,
} from "@/features/transactions";
import { ScreenLayout, TAB_BAR_CLEARANCE, TransactionRow } from "@/shared/components";
import { Ellipsis } from "@/shared/components/icons";
import { Alert, FlatList, Platform, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatSignedMoney, toIsoDate } from "@/shared/lib";
import type { TransactionId } from "@/shared/types/branded";
import { BalanceSection } from "./BalanceSection";
import { ChartSection } from "./ChartSection";
import { DateHeader } from "./DateHeader";
import { EmptyTransactions } from "./EmptyTransactions";
import { NeedsReviewBanner } from "./NeedsReviewBanner";

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
  readonly balance: number;
  readonly categorySpending: readonly {
    readonly categoryId: string;
    readonly total: number;
  }[];
  readonly dailySpending: readonly { readonly date: string; readonly total: number }[];
};

const ListHeader = memo(function ListHeader({
  balance,
  categorySpending,
  dailySpending,
}: ListHeaderProps) {
  const { push } = useRouter();
  const userId = useOptionalUserId();

  return (
    <View className="gap-4 px-4">
      <EmailConnectBanner
        onConnect={(provider) => {
          if (!userId) return;
          const db = tryGetDb(userId);
          if (!db) return;
          const clientId = provider === "gmail" ? getGmailClientId() : getOutlookClientId();
          void connectEmailAccount(db, userId, provider, clientId);
        }}
      />
      <FailedEmailsBanner onPress={() => push("/failed-emails" as never)} />
      <NeedsReviewBanner onPress={() => push("/needs-review" as never)} />
      <SyncConflictBanner onPress={() => push("/sync-conflicts" as never)} />
      {Platform.OS === "ios" && (
        <DetectedTransactionsBanner onPress={() => push("/connected-accounts" as never)} />
      )}
      <BalanceSection balance={balance} />
      <ChartSection
        categorySpending={categorySpending}
        dailySpending={dailySpending}
        totalSpent={balance}
        onPress={() => push("/analytics" as never)}
      />
    </View>
  );
});

export const HomeScreen = () => {
  const { push } = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const pages = useTransactionStore((s) => s.pages);
  const hasMore = useTransactionStore((s) => s.hasMore);
  const balance = useTransactionStore((s) => s.balance);
  const categorySpending = useTransactionStore((s) => s.categorySpending);
  const dailySpending = useTransactionStore((s) => s.dailySpending);
  // phase gates ListEmptyComponent — suppresses "No transactions" during first sync
  const phase = useEmailCaptureStore((s) => s.phase);
  const primaryColor = useThemeColor("primary");

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
    if (!db || !userId || !hasMore) return;
    void loadNextTransactions(db, userId);
  }, [db, hasMore, userId]);

  const handleEdit = useCallback(
    (id: TransactionId) => {
      if (!db || !userId) return;
      const didLoad = loadTransactionIntoForm(db, userId, id);
      if (!didLoad) return;
      push("/(tabs)/add" as never);
    },
    [db, push, userId]
  );

  const handleDelete = useCallback(
    (id: TransactionId) => {
      Alert.alert(t("transactions.deleteConfirmTitle"), t("transactions.deleteConfirmMessage"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            if (!db || !userId) return;
            void deleteTransaction(db, userId, id);
          },
        },
      ]);
    },
    [db, t, userId]
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
        balance={balance}
        categorySpending={categorySpending}
        dailySpending={dailySpending}
      />
    ),
    [balance, categorySpending, dailySpending]
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

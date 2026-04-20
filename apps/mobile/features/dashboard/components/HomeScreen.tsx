import { useFocusEffect } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  AccountSuggestionsPromptBanner,
  useAccountSuggestions,
} from "@/features/account-suggestions";
import { appendUniqueActivityItems } from "@/features/activity/lib/append-unique-activity-items";
import {
  createActivityQueryService,
  type StoredActivityItem,
} from "@/features/activity/services/create-activity-query-service";
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
  makeDateLabel,
  type StoredTransaction,
  useTransactionStore,
} from "@/features/transactions";
import { getTransferActivityCopy } from "@/features/transfers/lib/presentation";
import { ScreenLayout, TAB_BAR_CLEARANCE, TransactionRow } from "@/shared/components";
import { ArrowLeftRight, Ellipsis } from "@/shared/components/icons";
import { Alert, FlatList, Platform, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useSubscription, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatMoney, formatSignedMoney, toIsoDate } from "@/shared/lib";
import type { TransactionId } from "@/shared/types/branded";
import { getActivityAccountNames } from "../lib/get-activity-account-names";
import { BalanceSection } from "./BalanceSection";
import { ChartSection } from "./ChartSection";
import { DateHeader } from "./DateHeader";
import { EmptyTransactions } from "./EmptyTransactions";
import { NeedsReviewBanner } from "./NeedsReviewBanner";

const activityQueryService = createActivityQueryService();

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

const TransferItem = memo(function TransferItem({
  item,
  showDateHeader,
  accountNames,
}: {
  item: Extract<StoredActivityItem, { kind: "transfer" }>;
  showDateHeader: boolean;
  accountNames: Readonly<Record<string, string>>;
}) {
  const { t, locale } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const { title, route } = getTransferActivityCopy(item.transfer, accountNames, t);

  return (
    <View>
      {showDateHeader && (
        <DateHeader
          label={makeDateLabel(
            item.date,
            t("dates.today"),
            t("dates.yesterday"),
            getDateFnsLocale(locale)
          )}
        />
      )}
      <View className="px-4">
        <TransactionRow
          icon={ArrowLeftRight}
          iconBgColor={accentGreenLight}
          iconColor={accentGreen}
          name={title}
          amount={formatMoney(item.transfer.amount)}
          category={route}
          amountTone="neutral"
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
  readonly accountSuggestionCount: number;
};

const ListHeader = memo(function ListHeader({
  balance,
  categorySpending,
  dailySpending,
  accountSuggestionCount,
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
      <AccountSuggestionsPromptBanner
        count={accountSuggestionCount}
        onPress={() => push("/account-suggestions" as never)}
      />
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
  const { suggestions } = useAccountSuggestions({ db, userId });
  const balance = useTransactionStore((s) => s.balance);
  const categorySpending = useTransactionStore((s) => s.categorySpending);
  const dailySpending = useTransactionStore((s) => s.dailySpending);
  const dataRevision = useTransactionStore((s) => s.dataRevision);
  // phase gates ListEmptyComponent — suppresses "No transactions" during first sync
  const phase = useEmailCaptureStore((s) => s.phase);
  const primaryColor = useThemeColor("primary");
  const [activityPages, setActivityPages] = useState<readonly StoredActivityItem[]>([]);
  const [activityOffset, setActivityOffset] = useState(0);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const lastRequestedActivityOffsetRef = useRef<number | null>(null);

  const loadActivityPage = useCallback(() => {
    if (!db || !userId) {
      setActivityPages([]);
      setActivityOffset(0);
      setActivityHasMore(false);
      lastRequestedActivityOffsetRef.current = null;
      return;
    }

    try {
      const snapshot = activityQueryService.loadPage({
        db,
        userId,
        pageSize: 30,
        offset: 0,
      });
      setActivityPages(snapshot.pages);
      setActivityOffset(snapshot.offset);
      setActivityHasMore(snapshot.hasMore);
      lastRequestedActivityOffsetRef.current = null;
    } catch {
      setActivityPages([]);
      setActivityOffset(0);
      setActivityHasMore(false);
      lastRequestedActivityOffsetRef.current = null;
    }
  }, [db, userId]);

  const accountNames = getActivityAccountNames(db, userId);

  useFocusEffect(loadActivityPage);

  useSubscription(
    () => {
      loadActivityPage();
    },
    [dataRevision],
    db != null && userId != null
  );

  const dateBreaks = useMemo(() => {
    const breaks = new Set<string>();
    let lastDateKey: string | null = null;
    activityPages.forEach((item) => {
      const dateKey = toIsoDate(item.date);
      if (dateKey !== lastDateKey) {
        breaks.add(item.id);
        lastDateKey = dateKey;
      }
    });
    return breaks;
  }, [activityPages]);

  const handleEndReached = useCallback(() => {
    if (
      !db ||
      !userId ||
      !activityHasMore ||
      lastRequestedActivityOffsetRef.current === activityOffset
    ) {
      return;
    }

    lastRequestedActivityOffsetRef.current = activityOffset;

    try {
      const snapshot = activityQueryService.loadPage({
        db,
        userId,
        pageSize: 30,
        offset: activityOffset,
      });
      setActivityPages((current) => appendUniqueActivityItems(current, snapshot.pages));
      setActivityOffset(snapshot.offset);
      setActivityHasMore(snapshot.hasMore);
    } catch {
      lastRequestedActivityOffsetRef.current = null;
      // Keep the current activity feed if the query fails.
    }
  }, [activityHasMore, activityOffset, db, userId]);

  const handleEdit = useCallback(
    (id: TransactionId) => {
      push({
        pathname: "/edit-transaction",
        params: { transactionId: id },
      } as never);
    },
    [push]
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
    ({ item }: { item: StoredActivityItem }) =>
      item.kind === "transaction" ? (
        <TransactionItem
          tx={item.transaction}
          showDateHeader={dateBreaks.has(item.id)}
          onEdit={() => handleEdit(item.transaction.id)}
          onDelete={() => handleDelete(item.transaction.id)}
        />
      ) : (
        <TransferItem
          item={item}
          showDateHeader={dateBreaks.has(item.id)}
          accountNames={accountNames}
        />
      ),
    [accountNames, dateBreaks, handleDelete, handleEdit]
  );

  const keyExtractor = useCallback((item: StoredActivityItem) => item.id, []);

  const listHeader = useMemo(
    () => (
      <ListHeader
        balance={balance}
        categorySpending={categorySpending}
        dailySpending={dailySpending}
        accountSuggestionCount={suggestions.length}
      />
    ),
    [balance, categorySpending, dailySpending, suggestions.length]
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
        data={activityPages}
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

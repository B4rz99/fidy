import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { appendUniqueActivityItems } from "@/features/activity/query.public";
import {
  createActivityQueryService,
  type StoredActivityItem,
} from "@/features/activity/query.public";
import { loadCloudLedgerOptimisticTransactions } from "@/features/transactions/cloud-ledger.public";
import { deleteTransaction } from "@/features/transactions/store.public";
import { Alert } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { useSubscription, useTranslation } from "@/shared/hooks";
import { toIsoDate } from "@/shared/lib";
import type { TransactionId, UserId } from "@/shared/types/branded";
import { getActivityAccountNames } from "../../lib/get-activity-account-names";

const activityQueryService = createActivityQueryService({ loadCloudLedgerOptimisticTransactions });

type HomeActivityFeedState = {
  readonly activityHasMore: boolean;
  readonly activityOffset: number;
  readonly activityPages: readonly StoredActivityItem[];
};

type UseHomeActivityFeedInput = {
  readonly dataRevision: number;
  readonly db: AnyDb | null;
  readonly userId: UserId | null;
};

export type HomeActivityFeedModel = {
  readonly accountNames: Readonly<Record<string, string>>;
  readonly activityPages: readonly StoredActivityItem[];
  readonly dateBreaks: ReadonlySet<string>;
  readonly handleEndReached: () => void;
  readonly onDeleteTransaction: (id: TransactionId) => void;
  readonly onEditTransaction: (id: TransactionId) => void;
};

const EMPTY_ACTIVITY_FEED: HomeActivityFeedState = {
  activityHasMore: false,
  activityOffset: 0,
  activityPages: [],
};

function createDateBreaks(activityPages: readonly StoredActivityItem[]) {
  return activityPages.reduce<Set<string>>((breaks, item, index) => {
    const previousItem = index > 0 ? activityPages[index - 1] : null;
    const previousDate = previousItem ? toIsoDate(previousItem.date) : null;
    const currentDate = toIsoDate(item.date);

    return previousDate === currentDate ? breaks : breaks.add(item.id);
  }, new Set<string>());
}

export function useHomeActivityFeed({
  dataRevision,
  db,
  userId,
}: UseHomeActivityFeedInput): HomeActivityFeedModel {
  const { push } = useRouter();
  const { t } = useTranslation();
  const [activityFeed, setActivityFeed] = useState<HomeActivityFeedState>(EMPTY_ACTIVITY_FEED);
  const activityFeedRequestIdRef = useRef(0);
  const lastRequestedActivityOffsetRef = useRef<number | null>(null);

  const clearActivityFeed = useCallback(() => {
    setActivityFeed(EMPTY_ACTIVITY_FEED);
    lastRequestedActivityOffsetRef.current = null;
  }, []);

  const resetActivityFeed = useCallback(() => {
    activityFeedRequestIdRef.current += 1;
    clearActivityFeed();
  }, [clearActivityFeed]);

  const loadFirstPage = useCallback(() => {
    if (!db || !userId) {
      resetActivityFeed();
      return;
    }

    const requestId = activityFeedRequestIdRef.current + 1;
    activityFeedRequestIdRef.current = requestId;
    clearActivityFeed();
    let cancelled = false;

    try {
      void activityQueryService
        .loadPageWithCloudLedgerOptimisticView({
          db,
          userId,
          pageSize: 30,
          offset: 0,
        })
        .then((snapshot) => {
          if (cancelled || activityFeedRequestIdRef.current !== requestId) return;
          setActivityFeed({
            activityPages: snapshot.pages,
            activityOffset: snapshot.offset,
            activityHasMore: snapshot.hasMore,
          });
          lastRequestedActivityOffsetRef.current = null;
        })
        .catch(() => {
          if (cancelled || activityFeedRequestIdRef.current !== requestId) return;
          clearActivityFeed();
        });
    } catch {
      resetActivityFeed();
    }

    return () => {
      cancelled = true;
    };
  }, [clearActivityFeed, db, resetActivityFeed, userId]);

  useFocusEffect(loadFirstPage);

  useSubscription(
    () => {
      return loadFirstPage();
    },
    [dataRevision],
    db != null && userId != null
  );

  const handleEndReached = useCallback(() => {
    if (
      !db ||
      !userId ||
      !activityFeed.activityHasMore ||
      lastRequestedActivityOffsetRef.current === activityFeed.activityOffset
    ) {
      return;
    }

    const requestId = activityFeedRequestIdRef.current;
    const requestedOffset = activityFeed.activityOffset;
    lastRequestedActivityOffsetRef.current = requestedOffset;

    try {
      void activityQueryService
        .loadPageWithCloudLedgerOptimisticView({
          db,
          userId,
          pageSize: 30,
          offset: requestedOffset,
        })
        .then((snapshot) => {
          if (activityFeedRequestIdRef.current !== requestId) return;
          lastRequestedActivityOffsetRef.current = null;
          setActivityFeed((current) =>
            current.activityOffset === requestedOffset
              ? {
                  activityPages: appendUniqueActivityItems(current.activityPages, snapshot.pages),
                  activityOffset: snapshot.offset,
                  activityHasMore: snapshot.hasMore,
                }
              : current
          );
        })
        .catch(() => {
          if (activityFeedRequestIdRef.current !== requestId) return;
          lastRequestedActivityOffsetRef.current = null;
          // Keep the current activity feed if the query fails.
        });
    } catch {
      lastRequestedActivityOffsetRef.current = null;
      // Keep the current activity feed if the query fails.
    }
  }, [activityFeed.activityHasMore, activityFeed.activityOffset, db, userId]);

  const onEditTransaction = useCallback(
    (id: TransactionId) => {
      push({
        pathname: "/edit-transaction",
        params: { transactionId: id },
      } as never);
    },
    [push]
  );

  const onDeleteTransaction = useCallback(
    (id: TransactionId) => {
      Alert.alert(t("transactions.deleteConfirmTitle"), t("transactions.deleteConfirmMessage"), [
        { text: t("transactions.keepTransaction"), style: "cancel" },
        {
          text: t("transactions.deleteTransaction"),
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

  return {
    accountNames: getActivityAccountNames(db, userId),
    activityPages: activityFeed.activityPages,
    dateBreaks: useMemo(
      () => createDateBreaks(activityFeed.activityPages),
      [activityFeed.activityPages]
    ),
    handleEndReached,
    onDeleteTransaction,
    onEditTransaction,
  };
}

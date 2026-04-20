import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { getFinancialMeaningReviewItems, loadNeedsReviewEmails } from "@/features/email-capture";
import type { AnyDb } from "@/shared/db";
import { isMissingSqliteTableError } from "@/shared/lib/sqlite-errors";
import type { UserId } from "@/shared/types/branded";

export type FinancialMeaningReviewItem = Awaited<
  ReturnType<typeof getFinancialMeaningReviewItems>
>[number];

type UseFinancialMeaningReviewQueueInput = {
  readonly db: AnyDb | null;
  readonly userId: UserId | null;
};

export function useFinancialMeaningReviewQueue({
  db,
  userId,
}: UseFinancialMeaningReviewQueueInput) {
  const [items, setItems] = useState<readonly FinancialMeaningReviewItem[]>([]);
  const [hasLoadedQueue, setHasLoadedQueue] = useState(false);

  const reloadQueue = useCallback(async () => {
    if (!db || !userId) {
      setItems([]);
      setHasLoadedQueue(true);
      return;
    }

    try {
      const nextItems = await getFinancialMeaningReviewItems(db);
      setItems(nextItems);
      await loadNeedsReviewEmails(db, userId);
    } catch (error) {
      if (isMissingSqliteTableError(error)) {
        setItems([]);
      } else {
        throw error;
      }
    }

    setHasLoadedQueue(true);
  }, [db, userId]);

  useFocusEffect(
    useCallback(() => {
      void reloadQueue();
    }, [reloadQueue])
  );

  return {
    items,
    hasLoadedQueue,
    reloadQueue,
  };
}

import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  getFinancialMeaningReviewItems,
  loadNeedsReviewEmails,
} from "@/features/email-capture/public";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";

type FinancialMeaningReviewItem = Awaited<
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

    const nextItems = await getFinancialMeaningReviewItems(db, userId);
    setItems(nextItems);
    await loadNeedsReviewEmails(db, userId);

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

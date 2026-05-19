import { useOptionalUserId } from "@/features/auth/public";
import { useEmailCaptureStore } from "@/features/email-capture/public";
import { useTransactionStore } from "@/features/transactions/store.public";
import { tryGetDb } from "@/shared/db";
import { type HomeActivityFeedModel, useHomeActivityFeed } from "./useHomeActivityFeed";

export type CategorySpendingItem = {
  readonly categoryId: string;
  readonly total: number;
};

export type HomeScreenModel = {
  readonly activityFeed: HomeActivityFeedModel;
  readonly balance: number;
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly showEmptyTransactions: boolean;
};

export function useHomeScreen(): HomeScreenModel {
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const balance = useTransactionStore((state) => state.balance);
  const categorySpending = useTransactionStore((state) => state.categorySpending);
  const dataRevision = useTransactionStore((state) => state.dataRevision);
  const phase = useEmailCaptureStore((state) => state.phase);

  return {
    activityFeed: useHomeActivityFeed({ dataRevision, db, userId }),
    balance,
    categorySpending,
    showEmptyTransactions: phase === null,
  };
}

import { useOptionalUserId } from "@/features/auth";
import { useEmailCaptureStore } from "@/features/email-capture";
import { useTransactionStore } from "@/features/transactions";
import { tryGetDb } from "@/shared/db";
import { type HomeActivityFeedModel, useHomeActivityFeed } from "./useHomeActivityFeed";

export type CategorySpendingItem = {
  readonly categoryId: string;
  readonly total: number;
};

export type DailySpendingItem = {
  readonly date: string;
  readonly total: number;
};

export type HomeScreenModel = {
  readonly activityFeed: HomeActivityFeedModel;
  readonly balance: number;
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly dailySpending: readonly DailySpendingItem[];
  readonly showEmptyTransactions: boolean;
};

export function useHomeScreen(): HomeScreenModel {
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const balance = useTransactionStore((state) => state.balance);
  const categorySpending = useTransactionStore((state) => state.categorySpending);
  const dailySpending = useTransactionStore((state) => state.dailySpending);
  const dataRevision = useTransactionStore((state) => state.dataRevision);
  const phase = useEmailCaptureStore((state) => state.phase);

  return {
    activityFeed: useHomeActivityFeed({ dataRevision, db, userId }),
    balance,
    categorySpending,
    dailySpending,
    showEmptyTransactions: phase === null,
  };
}

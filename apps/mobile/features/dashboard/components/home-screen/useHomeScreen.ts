import { useOptionalUserId } from "@/features/auth/public";
import { formatBudgetMonth, useBudgetStore } from "@/features/budget/public";
import { useEmailCaptureStore } from "@/features/email-capture/public";
import { useTransactionStore } from "@/features/transactions/store.public";
import { tryGetDb } from "@/shared/db";
import type { CategoryId } from "@/shared/types/branded";
import { type HomeActivityFeedModel, useHomeActivityFeed } from "./useHomeActivityFeed";

export type CategorySpendingItem = {
  readonly categoryId: CategoryId;
  readonly total: number;
};

export type HomeScreenModel = {
  readonly activityFeed: HomeActivityFeedModel;
  readonly balance: number;
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly monthlyBudget: number;
  readonly showEmptyTransactions: boolean;
};

export function useHomeScreen(): HomeScreenModel {
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const balance = useTransactionStore((state) => state.balance);
  const categorySpending = useTransactionStore((state) => state.categorySpending);
  const dataRevision = useTransactionStore((state) => state.dataRevision);
  const currentBudgetMonth = formatBudgetMonth(new Date());
  const selectedBudgetMonth = useBudgetStore((state) => state.currentMonth);
  const selectedBudgetTotal = useBudgetStore((state) => state.summary.totalBudget);
  const currentMonthBudgetTotal = useBudgetStore(
    (state) => state.budgetTotalByMonth[currentBudgetMonth] ?? 0
  );
  const phase = useEmailCaptureStore((state) => state.phase);
  const monthlyBudget =
    selectedBudgetMonth === currentBudgetMonth ? selectedBudgetTotal : currentMonthBudgetTotal;

  return {
    activityFeed: useHomeActivityFeed({ dataRevision, db, userId }),
    balance,
    categorySpending,
    monthlyBudget,
    showEmptyTransactions: phase === null,
  };
}

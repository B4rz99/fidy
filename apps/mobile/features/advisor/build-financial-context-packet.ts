import { getBudgetsForMonth } from "@/features/budget/query.public";
import { getRepeatedCaptureEvidenceForUser } from "@/features/capture-evidence/query.public";
import { getFinancialAccountsForUser } from "@/features/financial-accounts/query.public";
import { getGoalCurrentAmount, getGoalsForUser } from "@/features/goals/query.public";
import {
  getBalanceAggregate,
  getRecentTransactions,
  getSpendingByCategoryAggregate,
} from "@/features/transactions/query.public";
import {
  createFinancialContextPacketBuilder,
  type FinancialContextPacketPorts,
} from "./financial-context-packet";

const financialContextPacketPorts = {
  getBalance: getBalanceAggregate,
  getSpendingByCategory: getSpendingByCategoryAggregate,
  getRecentTransactions: (input) =>
    getRecentTransactions({
      db: input.db,
      userId: input.userId,
      currentMonth: input.currentMonth,
      previousMonth: input.previousMonth,
    })
      .slice(0, 20)
      .map((transaction) => ({
        type: transaction.type,
        amount: transaction.amount,
        categoryId: transaction.categoryId,
        description: transaction.description ?? "",
        date: transaction.date,
      })),
  getBudgetsForMonth: (db, userId, month) =>
    getBudgetsForMonth(db, userId, month).map((budget) => ({
      categoryId: budget.categoryId,
      amount: budget.amount,
      month: budget.month,
    })),
  getGoals: (db, userId) =>
    getGoalsForUser(db, userId).map((goal) => ({
      id: goal.id,
      name: goal.name,
      type: goal.type,
      targetAmount: goal.targetAmount,
    })),
  getGoalCurrentAmount,
  getAccounts: (db, userId) =>
    getFinancialAccountsForUser(db, userId).map((account) => ({
      name: account.name,
      kind: account.kind,
      isDefault: account.isDefault,
    })),
  getCaptureEvidence: getRepeatedCaptureEvidenceForUser,
} satisfies FinancialContextPacketPorts;

export const buildFinancialContextPacket = createFinancialContextPacketBuilder(
  financialContextPacketPorts
);

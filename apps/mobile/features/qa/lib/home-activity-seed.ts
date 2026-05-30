import type { BudgetRow } from "@/features/budget/public";
import { buildDefaultFinancialAccountId } from "@/features/financial-accounts/seed.public";
import type { FinancialAccountRow } from "@/features/financial-accounts/write.public";
import type { TransactionRow } from "@/features/transactions/query.public";
import { getBuiltInCategoryId } from "@/shared/categories";
import { generateBudgetId, generateTransactionId, toIsoDate, toIsoDateTime } from "@/shared/lib";
import { requireCopAmount, requireMonth } from "@/shared/types/assertions";
import type { LocalQaSession } from "../local-session";

export function buildHomeActivityBudgets(
  userId: LocalQaSession["userId"],
  now: Date
): readonly BudgetRow[] {
  const month = requireMonth(toIsoDate(now).slice(0, 7));
  const createdAt = toIsoDateTime(now);

  return [
    { categoryId: "food", amount: 100_000 },
    { categoryId: "health", amount: 1_000_000 },
    { categoryId: "entertainment", amount: 1_000_000 },
    { categoryId: "home", amount: 2_000_000 },
    { categoryId: "clothing", amount: 1_000_000 },
    { categoryId: "transport", amount: 1_500_000 },
    { categoryId: "education", amount: 3_400_000 },
  ].map((budget) => ({
    id: generateBudgetId(),
    userId,
    categoryId: getBuiltInCategoryId(budget.categoryId),
    amount: requireCopAmount(budget.amount),
    month,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  }));
}

export function buildHomeActivityTransactions(
  userId: LocalQaSession["userId"],
  now: Date,
  accounts: readonly FinancialAccountRow[]
): readonly TransactionRow[] {
  const defaultAccountId = buildDefaultFinancialAccountId(userId);
  const bankAccountId = accounts[1]?.id ?? defaultAccountId;
  const today = toIsoDate(now);
  const yesterday = toIsoDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const twoDaysAgo = toIsoDate(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000));
  const createdAt = toIsoDateTime(now);

  return [
    {
      id: generateTransactionId(),
      userId,
      type: "expense",
      amount: requireCopAmount(86_400),
      categoryId: getBuiltInCategoryId("food"),
      description: "Rappi Colombia",
      date: today,
      accountId: defaultAccountId,
      accountAttributionState: "confirmed",
      createdAt,
      updatedAt: createdAt,
      voidedAt: null,
      supersededAt: null,
      source: "manual",
    },
    {
      id: generateTransactionId(),
      userId,
      type: "expense",
      amount: requireCopAmount(58_200),
      categoryId: getBuiltInCategoryId("health"),
      description: "Farmatodo Plaza",
      date: yesterday,
      accountId: defaultAccountId,
      accountAttributionState: "confirmed",
      createdAt,
      updatedAt: createdAt,
      voidedAt: null,
      supersededAt: null,
      source: "manual",
    },
    {
      id: generateTransactionId(),
      userId,
      type: "expense",
      amount: requireCopAmount(105_300),
      categoryId: getBuiltInCategoryId("entertainment"),
      description: "Cine Colombia",
      date: yesterday,
      accountId: bankAccountId,
      accountAttributionState: "confirmed",
      createdAt,
      updatedAt: createdAt,
      voidedAt: null,
      supersededAt: null,
      source: "manual",
    },
    {
      id: generateTransactionId(),
      userId,
      type: "expense",
      amount: requireCopAmount(42_000),
      categoryId: getBuiltInCategoryId("home"),
      description: "Homecenter",
      date: yesterday,
      accountId: bankAccountId,
      accountAttributionState: "confirmed",
      createdAt,
      updatedAt: createdAt,
      voidedAt: null,
      supersededAt: null,
      source: "manual",
    },
    {
      id: generateTransactionId(),
      userId,
      type: "expense",
      amount: requireCopAmount(92_700),
      categoryId: getBuiltInCategoryId("clothing"),
      description: "Arturo Calle",
      date: twoDaysAgo,
      accountId: bankAccountId,
      accountAttributionState: "confirmed",
      createdAt,
      updatedAt: createdAt,
      voidedAt: null,
      supersededAt: null,
      source: "manual",
    },
    {
      id: generateTransactionId(),
      userId,
      type: "expense",
      amount: requireCopAmount(38_900),
      categoryId: getBuiltInCategoryId("transport"),
      description: "Uber",
      date: twoDaysAgo,
      accountId: defaultAccountId,
      accountAttributionState: "confirmed",
      createdAt,
      updatedAt: createdAt,
      voidedAt: null,
      supersededAt: null,
      source: "manual",
    },
    {
      id: generateTransactionId(),
      userId,
      type: "expense",
      amount: requireCopAmount(74_500),
      categoryId: getBuiltInCategoryId("education"),
      description: "Platzi",
      date: twoDaysAgo,
      accountId: defaultAccountId,
      accountAttributionState: "confirmed",
      createdAt,
      updatedAt: createdAt,
      voidedAt: null,
      supersededAt: null,
      source: "manual",
    },
    {
      id: generateTransactionId(),
      userId,
      type: "expense",
      amount: requireCopAmount(12_500),
      categoryId: getBuiltInCategoryId("food"),
      description: "Bancolombia pending owner",
      date: today,
      accountId: defaultAccountId,
      accountAttributionState: "unresolved",
      createdAt,
      updatedAt: createdAt,
      voidedAt: null,
      supersededAt: null,
      source: "notification_capture",
    },
  ];
}

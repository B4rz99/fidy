import { and, eq, inArray, isNull, not } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import {
  bills,
  budgets,
  categoryColorOverrides,
  categoryIconOverrides,
  financialAccountIdentifiers,
  financialAccounts,
  merchantRules,
  notifications,
  openingBalances,
  reviewCandidates,
  transactions,
  transfers,
  userCategories,
} from "@/shared/db/schema";
import type { FinancialAccountId, UserCategoryId, UserId } from "@/shared/types/branded";

const CLOUD_LEDGER_REFERENCE_SOURCE = "cloud_ledger";
const LOCAL_LEDGER_REFERENCE_SOURCE = "local_ledger";

export function promoteCloudLedgerReferencesWithLocalDependents(db: AnyDb, userId: UserId): void {
  promoteCloudLedgerFinancialAccountReferencesWithLocalDependents(db, userId);
  promoteCloudLedgerUserCategoryReferencesWithLocalDependents(db, userId);
}

function promoteCloudLedgerFinancialAccountReferencesWithLocalDependents(
  db: AnyDb,
  userId: UserId
): void {
  const accountIds = uniqueNonNullIds([
    ...selectLocalTransactionAccountIds(db, userId),
    ...selectLocalTransferFromAccountIds(db, userId),
    ...selectLocalTransferToAccountIds(db, userId),
    ...selectOpeningBalanceAccountIds(db, userId),
    ...selectFinancialAccountIdentifierAccountIds(db, userId),
  ]);
  if (accountIds.length === 0) return;
  promoteFinancialAccountIds({ db, userId, accountIds });
}

function selectLocalTransactionAccountIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: transactions.accountId })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        not(eq(transactions.source, CLOUD_LEDGER_REFERENCE_SOURCE))
      )
    )
    .all();
}

function selectLocalTransferFromAccountIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: transfers.fromAccountId })
    .from(transfers)
    .where(eq(transfers.userId, userId))
    .all();
}

function selectLocalTransferToAccountIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: transfers.toAccountId })
    .from(transfers)
    .where(eq(transfers.userId, userId))
    .all();
}

function selectOpeningBalanceAccountIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: openingBalances.accountId })
    .from(openingBalances)
    .where(and(eq(openingBalances.userId, userId), isNull(openingBalances.deletedAt)))
    .all();
}

function selectFinancialAccountIdentifierAccountIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: financialAccountIdentifiers.accountId })
    .from(financialAccountIdentifiers)
    .where(
      and(
        eq(financialAccountIdentifiers.userId, userId),
        isNull(financialAccountIdentifiers.deletedAt)
      )
    )
    .all();
}

function promoteFinancialAccountIds(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly accountIds: readonly string[];
}): void {
  input.db
    .update(financialAccounts)
    .set({ source: LOCAL_LEDGER_REFERENCE_SOURCE })
    .where(
      and(
        eq(financialAccounts.userId, input.userId),
        eq(financialAccounts.source, CLOUD_LEDGER_REFERENCE_SOURCE),
        inArray(financialAccounts.id, input.accountIds as FinancialAccountId[])
      )
    )
    .run();
}

function promoteCloudLedgerUserCategoryReferencesWithLocalDependents(
  db: AnyDb,
  userId: UserId
): void {
  const categoryIds = uniqueNonNullIds([
    ...selectLocalTransactionCategoryIds(db, userId),
    ...selectCategoryIconOverrideCategoryIds(db, userId),
    ...selectCategoryColorOverrideCategoryIds(db, userId),
    ...selectBudgetCategoryIds(db, userId),
    ...selectBillCategoryIds(db, userId),
    ...selectReviewCandidateCategoryIds(db, userId),
    ...selectMerchantRuleCategoryIds(db, userId),
    ...selectNotificationCategoryIds(db, userId),
  ]);
  if (categoryIds.length === 0) return;
  promoteUserCategoryIds({ db, userId, categoryIds });
}

function selectLocalTransactionCategoryIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: transactions.categoryId })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        not(eq(transactions.source, CLOUD_LEDGER_REFERENCE_SOURCE))
      )
    )
    .all();
}

function selectCategoryIconOverrideCategoryIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: categoryIconOverrides.categoryId })
    .from(categoryIconOverrides)
    .where(and(eq(categoryIconOverrides.userId, userId), isNull(categoryIconOverrides.deletedAt)))
    .all();
}

function selectCategoryColorOverrideCategoryIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: categoryColorOverrides.categoryId })
    .from(categoryColorOverrides)
    .where(and(eq(categoryColorOverrides.userId, userId), isNull(categoryColorOverrides.deletedAt)))
    .all();
}

function selectBudgetCategoryIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: budgets.categoryId })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt)))
    .all();
}

function selectBillCategoryIds(db: AnyDb, userId: UserId) {
  return db.select({ id: bills.categoryId }).from(bills).where(eq(bills.userId, userId)).all();
}

function selectReviewCandidateCategoryIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: reviewCandidates.categoryId })
    .from(reviewCandidates)
    .where(and(eq(reviewCandidates.userId, userId), isNull(reviewCandidates.deletedAt)))
    .all();
}

function selectMerchantRuleCategoryIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: merchantRules.categoryId })
    .from(merchantRules)
    .where(eq(merchantRules.userId, userId))
    .all();
}

function selectNotificationCategoryIds(db: AnyDb, userId: UserId) {
  return db
    .select({ id: notifications.categoryId })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.deletedAt)))
    .all();
}

function promoteUserCategoryIds(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly categoryIds: readonly string[];
}): void {
  input.db
    .update(userCategories)
    .set({ source: LOCAL_LEDGER_REFERENCE_SOURCE })
    .where(
      and(
        eq(userCategories.userId, input.userId),
        eq(userCategories.source, CLOUD_LEDGER_REFERENCE_SOURCE),
        inArray(userCategories.id, input.categoryIds as unknown as UserCategoryId[])
      )
    )
    .run();
}

function uniqueNonNullIds(rows: readonly { readonly id: string | null }[]): readonly string[] {
  return [...new Set(rows.map((row) => row.id).filter((id): id is string => id !== null))];
}

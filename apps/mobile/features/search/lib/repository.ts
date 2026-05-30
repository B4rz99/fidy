import { and, count, desc, eq, gte, inArray, like, lte, type SQL, sql } from "drizzle-orm";
import { getActiveTransactionConditions } from "@/features/transactions/query.public";
import type { AnyDb } from "@/shared/db/client";
import { financialAccounts, transactions, transfers } from "@/shared/db/schema";
import { requireCategoryId, requireCopAmount, requireIsoDate } from "@/shared/types/assertions";
import type { UserId } from "@/shared/types/branded";
import type { SearchFilters, SearchSummary } from "./types";

type SearchCondition = SQL<unknown>;
type SearchTransactionsPageInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly filters: SearchFilters;
  readonly limit: number;
  readonly offset: number;
};
type SearchTransfersPageInput = SearchTransactionsPageInput;
type SearchConditionBuilder = (filters: SearchFilters) => SearchCondition | null;

function compactSearchConditions(
  conditions: readonly (SearchCondition | null)[]
): readonly SearchCondition[] {
  return conditions.filter((condition): condition is SearchCondition => condition !== null);
}

function toCategoryIds(categoryIds: SearchFilters["categoryIds"]) {
  return categoryIds.flatMap((id) => {
    const trimmed = id.trim();
    return trimmed.length > 0 ? [requireCategoryId(trimmed)] : [];
  });
}

const SEARCH_CONDITION_BUILDERS: readonly SearchConditionBuilder[] = [
  (filters) => {
    const trimmedQuery = filters.query.trim();
    return trimmedQuery.length > 0 ? like(transactions.description, `%${trimmedQuery}%`) : null;
  },
  (filters) => {
    const ids = toCategoryIds(filters.categoryIds);
    return ids.length > 0 ? inArray(transactions.categoryId, ids) : null;
  },
  (filters) =>
    filters.dateFrom !== null ? gte(transactions.date, requireIsoDate(filters.dateFrom)) : null,
  (filters) =>
    filters.dateTo !== null ? lte(transactions.date, requireIsoDate(filters.dateTo)) : null,
  (filters) =>
    filters.amountMin !== null
      ? gte(transactions.amount, requireCopAmount(filters.amountMin))
      : null,
  (filters) =>
    filters.amountMax !== null
      ? lte(transactions.amount, requireCopAmount(filters.amountMax))
      : null,
  (filters) =>
    filters.type === "expense" || filters.type === "income"
      ? eq(transactions.type, filters.type)
      : filters.type === "transfer"
        ? sql`1 = 0`
        : null,
];

const SEARCH_TRANSFER_CONDITION_BUILDERS: readonly SearchConditionBuilder[] = [
  (filters) => (filters.categoryIds.length > 0 ? sql`1 = 0` : null),
  (filters) => {
    const trimmedQuery = filters.query.trim();
    return trimmedQuery.length > 0 ? like(transfers.description, `%${trimmedQuery}%`) : null;
  },
  (filters) =>
    filters.dateFrom !== null ? gte(transfers.date, requireIsoDate(filters.dateFrom)) : null,
  (filters) =>
    filters.dateTo !== null ? lte(transfers.date, requireIsoDate(filters.dateTo)) : null,
  (filters) =>
    filters.amountMin !== null ? gte(transfers.amount, requireCopAmount(filters.amountMin)) : null,
  (filters) =>
    filters.amountMax !== null ? lte(transfers.amount, requireCopAmount(filters.amountMax)) : null,
];

function buildSearchConditions(userId: UserId, filters: SearchFilters) {
  return compactSearchConditions([
    ...getActiveTransactionConditions(userId),
    ...SEARCH_CONDITION_BUILDERS.map((buildCondition) => buildCondition(filters)),
  ]);
}

function buildTransferSearchConditions(userId: UserId, filters: SearchFilters) {
  return compactSearchConditions([
    eq(transfers.userId, userId),
    sql`${transfers.voidedAt} is null`,
    ...SEARCH_TRANSFER_CONDITION_BUILDERS.map((buildCondition) => buildCondition(filters)),
  ]);
}

export function searchTransactionsPaginated(input: SearchTransactionsPageInput) {
  const { db, userId, filters, limit, offset } = input;
  const conditions = buildSearchConditions(userId, filters);
  return db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit + 1)
    .offset(offset)
    .all();
}

export function searchTransactionsAggregate(
  db: AnyDb,
  userId: UserId,
  filters: SearchFilters
): SearchSummary {
  const conditions = buildSearchConditions(userId, filters);
  const row = db
    .select({
      count: count(),
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(and(...conditions))
    .get();
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
}

export function searchTransfersPaginated(input: SearchTransfersPageInput) {
  const { db, userId, filters, limit, offset } = input;
  const conditions = buildTransferSearchConditions(userId, filters);
  return db
    .select()
    .from(transfers)
    .where(and(...conditions))
    .orderBy(desc(transfers.date), desc(transfers.updatedAt), desc(transfers.id))
    .limit(limit + 1)
    .offset(offset)
    .all();
}

export function searchTransfersAggregate(
  db: AnyDb,
  userId: UserId,
  filters: SearchFilters
): SearchSummary {
  const conditions = buildTransferSearchConditions(userId, filters);
  const row = db
    .select({
      count: count(),
      total: sql<number>`COALESCE(SUM(${transfers.amount}), 0)`,
    })
    .from(transfers)
    .where(and(...conditions))
    .get();
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
}

export function getSearchTransferAccountNames(db: AnyDb, userId: UserId) {
  const rows = db
    .select({ id: financialAccounts.id, name: financialAccounts.name })
    .from(financialAccounts)
    .where(and(eq(financialAccounts.userId, userId), sql`${financialAccounts.deletedAt} is null`))
    .all();

  return Object.fromEntries(rows.map((account) => [account.id, account.name]));
}

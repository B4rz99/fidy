import { and, count, desc, eq, gte, inArray, like, lte, type SQL, sql } from "drizzle-orm";
import { getActiveTransactionConditions } from "@/features/transactions/lib/active-transaction-conditions";
import type { AnyDb } from "@/shared/db/client";
import { transactions } from "@/shared/db/schema";
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
type SearchConditionBuilder = (filters: SearchFilters) => SearchCondition | null;

function compactSearchConditions(
  conditions: readonly (SearchCondition | null)[]
): readonly SearchCondition[] {
  return conditions.filter((condition): condition is SearchCondition => condition !== null);
}

function toCategoryIds(categoryIds: SearchFilters["categoryIds"]) {
  return categoryIds.filter((id) => id.trim().length > 0).map((id) => requireCategoryId(id));
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
  (filters) => (filters.type !== "all" ? eq(transactions.type, filters.type) : null),
];

function buildSearchConditions(userId: UserId, filters: SearchFilters) {
  return compactSearchConditions([
    ...getActiveTransactionConditions(userId),
    ...SEARCH_CONDITION_BUILDERS.map((buildCondition) => buildCondition(filters)),
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

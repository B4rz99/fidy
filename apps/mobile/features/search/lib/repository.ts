import { and, count, desc, eq, gte, inArray, isNull, like, lte, sql } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { transactions } from "@/shared/db";
import type { SearchFilters, SearchSummary } from "./types";

function buildSearchConditions(userId: string, filters: SearchFilters) {
  const trimmedQuery = filters.query.trim();
  return [
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
    ...(trimmedQuery.length > 0 ? [like(transactions.description, `%${trimmedQuery}%`)] : []),
    ...(filters.categoryIds.length > 0
      ? [inArray(transactions.categoryId, [...filters.categoryIds])]
      : []),
    ...(filters.dateFrom !== null ? [gte(transactions.date, filters.dateFrom)] : []),
    ...(filters.dateTo !== null ? [lte(transactions.date, filters.dateTo)] : []),
    ...(filters.amountMin !== null ? [gte(transactions.amount, filters.amountMin)] : []),
    ...(filters.amountMax !== null ? [lte(transactions.amount, filters.amountMax)] : []),
    ...(filters.type !== "all" ? [eq(transactions.type, filters.type)] : []),
  ];
}

export function searchTransactionsPaginated(
  db: AnyDb,
  userId: string,
  filters: SearchFilters,
  limit: number,
  offset: number
) {
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
  userId: string,
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

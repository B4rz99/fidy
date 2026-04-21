import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { getActiveTransactionConditions } from "@/features/transactions/lib/active-transaction-conditions";
import type { AnyDb } from "@/shared/db/client";
import { financialAccounts, openingBalances, transactions, transfers } from "@/shared/db/schema";
import type { CopAmount, FinancialAccountId, IsoDate, UserId } from "@/shared/types/branded";
import type { FinancialAccountKind } from "../schema";
import {
  buildAccountBalanceMap,
  combineTransferBalanceEffects,
  getAccountKindMap,
  getOpeningBalanceTotals,
} from "./balance-maps";

type AccountBalanceMap = Record<string, CopAmount>;

type AccountRow = {
  readonly id: FinancialAccountId;
  readonly kind: FinancialAccountKind;
};

type BalanceAggregateRow = {
  readonly accountId: FinancialAccountId;
  readonly total: CopAmount;
};

type OpeningBalanceAggregateRow = {
  readonly accountId: FinancialAccountId;
  readonly amount: CopAmount;
};

function toAggregateMap(rows: readonly BalanceAggregateRow[]): AccountBalanceMap {
  return Object.fromEntries(rows.map((row) => [row.accountId, row.total])) as AccountBalanceMap;
}

function getFinancialAccountsForBalance(db: AnyDb, userId: UserId): readonly AccountRow[] {
  return db
    .select({
      id: financialAccounts.id,
      kind: financialAccounts.kind,
    })
    .from(financialAccounts)
    .where(and(eq(financialAccounts.userId, userId), isNull(financialAccounts.deletedAt)))
    .all() as readonly AccountRow[];
}

function getOpeningBalanceAmounts(
  db: AnyDb,
  userId: UserId,
  asOfDate: IsoDate
): readonly OpeningBalanceAggregateRow[] {
  return db
    .select({
      accountId: openingBalances.accountId,
      amount: openingBalances.amount,
    })
    .from(openingBalances)
    .where(
      and(
        eq(openingBalances.userId, userId),
        isNull(openingBalances.deletedAt),
        lte(openingBalances.effectiveDate, asOfDate)
      )
    )
    .all();
}

function getTransactionBalanceEffects(
  db: AnyDb,
  userId: UserId,
  asOfDate: IsoDate
): readonly BalanceAggregateRow[] {
  return db
    .select({
      accountId: transactions.accountId,
      total:
        sql<number>`SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE -${transactions.amount} END)`.mapWith(
          (value) => Number(value) as CopAmount
        ),
    })
    .from(transactions)
    .where(
      and(
        ...getActiveTransactionConditions(userId),
        lte(transactions.date, asOfDate),
        sql`${transactions.accountAttributionState} != 'unresolved'`
      )
    )
    .groupBy(transactions.accountId)
    .all();
}

function getOutgoingTransferBalanceEffects(
  db: AnyDb,
  userId: UserId,
  asOfDate: IsoDate
): readonly BalanceAggregateRow[] {
  return db
    .select({
      accountId: transfers.fromAccountId,
      total: sql<number>`-SUM(${transfers.amount})`.mapWith((value) => Number(value) as CopAmount),
    })
    .from(transfers)
    .where(
      and(
        eq(transfers.userId, userId),
        isNull(transfers.deletedAt),
        lte(transfers.date, asOfDate),
        sql`${transfers.fromAccountId} is not null`
      )
    )
    .groupBy(transfers.fromAccountId)
    .all()
    .map((row) => ({
      accountId: row.accountId as FinancialAccountId,
      total: row.total,
    }));
}

function getIncomingTransferBalanceEffects(
  db: AnyDb,
  userId: UserId,
  asOfDate: IsoDate
): readonly BalanceAggregateRow[] {
  return db
    .select({
      accountId: transfers.toAccountId,
      total: sql<number>`SUM(${transfers.amount})`.mapWith((value) => Number(value) as CopAmount),
    })
    .from(transfers)
    .where(
      and(
        eq(transfers.userId, userId),
        isNull(transfers.deletedAt),
        lte(transfers.date, asOfDate),
        sql`${transfers.toAccountId} is not null`
      )
    )
    .groupBy(transfers.toAccountId)
    .all()
    .map((row) => ({
      accountId: row.accountId as FinancialAccountId,
      total: row.total,
    }));
}

export function getFinancialAccountBalancesForUser(
  db: AnyDb,
  userId: UserId,
  asOfDate: IsoDate
): Record<string, CopAmount> {
  const accounts = getFinancialAccountsForBalance(db, userId);
  const openingBalanceTotals = getOpeningBalanceTotals(
    getOpeningBalanceAmounts(db, userId, asOfDate),
    getAccountKindMap(accounts)
  );
  const transactionTotals = toAggregateMap(getTransactionBalanceEffects(db, userId, asOfDate));
  const transferTotals = combineTransferBalanceEffects(
    getOutgoingTransferBalanceEffects(db, userId, asOfDate),
    getIncomingTransferBalanceEffects(db, userId, asOfDate)
  );

  return buildAccountBalanceMap({
    accounts,
    openingBalanceTotals,
    transactionTotals,
    transferTotals,
  });
}

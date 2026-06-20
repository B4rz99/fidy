// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getExpenseTransactionsForPeriod,
  getIncomeExpenseForPeriod,
  getSpendingByCategoryForPeriod,
} from "@/features/analytics/lib/repository";
import {
  insertTransactionStorageRow as insertTransaction,
  softDeleteTransactionStorageRow as softDeleteTransaction,
} from "@/infrastructure/local-ledger/transaction-storage";
import type {
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const OTHER_USER_ID = "user-2" as UserId;
const PERIOD_START = "2026-03-01" as IsoDate;
const PERIOD_END = "2026-03-31" as IsoDate;
const CREATED_AT = "2026-03-01T00:00:00.000Z" as IsoDateTime;
const DELETED_AT = "2026-03-20T12:00:00.000Z" as IsoDateTime;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

const insertTransactionRow = (
  overrides: Partial<{
    id: TransactionId;
    userId: UserId;
    type: "expense" | "income";
    amount: CopAmount;
    categoryId: CategoryId;
    description: string | null;
    date: IsoDate;
  }> = {}
) =>
  insertTransaction(db as any, {
    id: overrides.id ?? ("tx-1" as TransactionId),
    userId: overrides.userId ?? USER_ID,
    type: overrides.type ?? "expense",
    amount: overrides.amount ?? (100000 as CopAmount),
    categoryId: overrides.categoryId ?? ("other" as CategoryId),
    description: overrides.description ?? "merchant",
    date: overrides.date ?? PERIOD_START,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    voidedAt: null,
    source: "manual",
  });

const periodAggregateRows = [
  {
    id: "income-active" as TransactionId,
    type: "income" as const,
    amount: 500000 as CopAmount,
    categoryId: "salary" as CategoryId,
    description: "Salary",
    date: "2026-03-03" as IsoDate,
  },
  {
    id: "income-deleted" as TransactionId,
    type: "income" as const,
    amount: 150000 as CopAmount,
    categoryId: "salary" as CategoryId,
    description: "Bonus",
    date: "2026-03-04" as IsoDate,
  },
  {
    id: "expense-food-1" as TransactionId,
    type: "expense" as const,
    amount: 120000 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Groceries",
    date: "2026-03-05" as IsoDate,
  },
  {
    id: "expense-food-2" as TransactionId,
    type: "expense" as const,
    amount: 40000 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Snacks",
    date: "2026-03-15" as IsoDate,
  },
  {
    id: "expense-transport" as TransactionId,
    type: "expense" as const,
    amount: 80000 as CopAmount,
    categoryId: "transport" as CategoryId,
    description: "Taxi",
    date: "2026-03-10" as IsoDate,
  },
  {
    id: "expense-deleted" as TransactionId,
    type: "expense" as const,
    amount: 60000 as CopAmount,
    categoryId: "subscriptions" as CategoryId,
    description: "Streaming",
    date: "2026-03-18" as IsoDate,
  },
  {
    id: "expense-out-of-range" as TransactionId,
    type: "expense" as const,
    amount: 999999 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "February groceries",
    date: "2026-02-28" as IsoDate,
  },
  {
    id: "expense-other-user" as TransactionId,
    userId: OTHER_USER_ID,
    type: "expense" as const,
    amount: 30000 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Other user groceries",
    date: "2026-03-08" as IsoDate,
  },
];

describe("analytics repository", () => {
  it("builds period aggregates from active in-range transactions only", () => {
    periodAggregateRows.forEach(insertTransactionRow);

    softDeleteTransaction(db as any, "income-deleted" as TransactionId, DELETED_AT);
    softDeleteTransaction(db as any, "expense-deleted" as TransactionId, DELETED_AT);

    const periodQuery = {
      db: db as any,
      userId: USER_ID,
      startDate: PERIOD_START,
      endDate: PERIOD_END,
    };

    expect(getIncomeExpenseForPeriod(periodQuery)).toEqual({
      income: 500000 as CopAmount,
      expenses: 240000 as CopAmount,
    });

    expect(getSpendingByCategoryForPeriod(periodQuery)).toEqual([
      { categoryId: "food" as CategoryId, total: 160000 as CopAmount },
      { categoryId: "transport" as CategoryId, total: 80000 as CopAmount },
    ]);

    expect(
      getExpenseTransactionsForPeriod(periodQuery).map(
        ({ id, categoryId, amount, description, date }) => ({
          id,
          categoryId,
          amount,
          description,
          date,
        })
      )
    ).toEqual([
      {
        id: "expense-food-2" as TransactionId,
        categoryId: "food" as CategoryId,
        amount: 40000 as CopAmount,
        description: "Snacks",
        date: new Date(2026, 2, 15),
      },
      {
        id: "expense-transport" as TransactionId,
        categoryId: "transport" as CategoryId,
        amount: 80000 as CopAmount,
        description: "Taxi",
        date: new Date(2026, 2, 10),
      },
      {
        id: "expense-food-1" as TransactionId,
        categoryId: "food" as CategoryId,
        amount: 120000 as CopAmount,
        description: "Groceries",
        date: new Date(2026, 2, 5),
      },
    ]);
  });
});

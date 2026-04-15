// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMonthlyTotalsByType,
  insertTransaction,
  softDeleteTransaction,
} from "@/features/transactions/lib/repository";
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
const CREATED_AT = "2026-03-01T00:00:00.000Z" as IsoDateTime;
const DELETED_AT = "2026-03-18T10:00:00.000Z" as IsoDateTime;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  vi.useRealTimers();
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
    date: overrides.date ?? ("2026-03-01" as IsoDate),
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    deletedAt: null,
    source: "manual",
  });

describe("transaction repository monthly totals", () => {
  it("returns active monthly totals for the rolling window only", () => {
    insertTransactionRow({
      id: "mar-income" as TransactionId,
      type: "income",
      amount: 700000 as CopAmount,
      categoryId: "salary" as CategoryId,
      description: "Salary",
      date: "2026-03-05" as IsoDate,
    });
    insertTransactionRow({
      id: "mar-expense" as TransactionId,
      type: "expense",
      amount: 150000 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Groceries",
      date: "2026-03-07" as IsoDate,
    });
    insertTransactionRow({
      id: "feb-income" as TransactionId,
      type: "income",
      amount: 680000 as CopAmount,
      categoryId: "salary" as CategoryId,
      description: "Salary",
      date: "2026-02-04" as IsoDate,
    });
    insertTransactionRow({
      id: "feb-expense" as TransactionId,
      type: "expense",
      amount: 220000 as CopAmount,
      categoryId: "rent" as CategoryId,
      description: "Rent",
      date: "2026-02-10" as IsoDate,
    });
    insertTransactionRow({
      id: "jan-expense" as TransactionId,
      type: "expense",
      amount: 90000 as CopAmount,
      categoryId: "transport" as CategoryId,
      description: "Transit",
      date: "2026-01-15" as IsoDate,
    });
    insertTransactionRow({
      id: "jan-income-deleted" as TransactionId,
      type: "income",
      amount: 50000 as CopAmount,
      categoryId: "salary" as CategoryId,
      description: "Bonus",
      date: "2026-01-18" as IsoDate,
    });
    insertTransactionRow({
      id: "dec-expense" as TransactionId,
      type: "expense",
      amount: 999999 as CopAmount,
      categoryId: "shopping" as CategoryId,
      description: "Holiday shopping",
      date: "2025-12-20" as IsoDate,
    });
    insertTransactionRow({
      id: "mar-other-user" as TransactionId,
      userId: OTHER_USER_ID,
      type: "income",
      amount: 123456 as CopAmount,
      categoryId: "salary" as CategoryId,
      description: "Other user",
      date: "2026-03-10" as IsoDate,
    });

    softDeleteTransaction(db as any, "jan-income-deleted" as TransactionId, DELETED_AT);

    const result = getMonthlyTotalsByType(db as any, USER_ID, 3).sort((left, right) =>
      `${left.month}:${left.type}`.localeCompare(`${right.month}:${right.type}`)
    );

    expect(result).toEqual([
      { month: "2026-01", type: "expense", total: 90000 },
      { month: "2026-02", type: "expense", total: 220000 },
      { month: "2026-02", type: "income", total: 680000 },
      { month: "2026-03", type: "expense", total: 150000 },
      { month: "2026-03", type: "income", total: 700000 },
    ]);
  });
});

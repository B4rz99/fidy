// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildDefaultFinancialAccountId } from "@/features/financial-accounts";
import {
  getAllTransactions,
  getBalanceAggregate,
  getTransactionById,
  insertTransaction,
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

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

describe("transaction repository integration", () => {
  it("persists fallback ownership fields when callers omit them", () => {
    insertTransaction(db as any, {
      id: "tx-1" as TransactionId,
      userId: USER_ID,
      type: "expense",
      amount: 125000 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Groceries",
      date: "2026-03-04" as IsoDate,
      createdAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
    });

    expect(getTransactionById(db as any, "tx-1" as TransactionId)).toMatchObject({
      id: "tx-1",
      accountId: buildDefaultFinancialAccountId(USER_ID),
      accountAttributionState: "confirmed",
      supersededAt: null,
    });
  });

  it("excludes superseded transactions from active transaction lists and balance totals", () => {
    insertTransaction(db as any, {
      id: "tx-active" as TransactionId,
      userId: USER_ID,
      type: "expense",
      amount: 125000 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Groceries",
      date: "2026-03-04" as IsoDate,
      createdAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
    });

    insertTransaction(db as any, {
      id: "tx-superseded" as TransactionId,
      userId: USER_ID,
      type: "expense",
      amount: 450000 as CopAmount,
      categoryId: "shopping" as CategoryId,
      description: "Transfer to savings",
      date: "2026-03-05" as IsoDate,
      createdAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-06T10:00:00.000Z" as IsoDateTime,
      supersededAt: "2026-03-06T10:00:00.000Z" as IsoDateTime,
    });

    expect(getAllTransactions(db as any, USER_ID).map((row) => row.id)).toEqual(["tx-active"]);
    expect(getBalanceAggregate(db as any, USER_ID)).toBe(-125000);
  });
});

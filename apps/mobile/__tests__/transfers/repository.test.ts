// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getQueuedSyncEntries } from "@/features/transactions/lib/repository";
import { getTransfersForUser, saveTransfer } from "@/features/transfers";
import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransferId,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const NOW = "2026-04-18T10:00:00.000Z" as IsoDateTime;
const TRANSFER_DATE = "2026-04-18" as IsoDate;

type TransferInput = Parameters<typeof saveTransfer>[1];

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function makeTransfer(overrides: Partial<TransferInput> = {}): TransferInput {
  return {
    id: "tr-1" as TransferId,
    userId: USER_ID,
    amount: 250000 as CopAmount,
    fromAccountId: "fa-1" as FinancialAccountId,
    toAccountId: "fa-2" as FinancialAccountId,
    fromExternalLabel: null,
    toExternalLabel: null,
    description: "Move to savings",
    date: TRANSFER_DATE,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

function expectQueuedTransfer(rowId: string, operation: "insert" | "update") {
  expect(getQueuedSyncEntries(db as any)).toEqual([
    expect.objectContaining({
      tableName: "transfers",
      rowId,
      operation,
    }),
  ]);
}

describe("transfers repository", () => {
  it("saves a transfer, reads it back, and enqueues sync", () => {
    saveTransfer(db as any, makeTransfer());

    expect(getTransfersForUser(db as any, USER_ID)).toEqual([
      expect.objectContaining({
        id: "tr-1",
        userId: USER_ID,
        amount: 250000,
        fromAccountId: "fa-1",
        toAccountId: "fa-2",
      }),
    ]);
    expectQueuedTransfer("tr-1", "insert");
  });

  it("requires a source and destination endpoint", () => {
    expect(() =>
      saveTransfer(
        db as any,
        makeTransfer({ id: "tr-missing-from" as TransferId, fromAccountId: null })
      )
    ).toThrow();
    expect(() =>
      saveTransfer(
        db as any,
        makeTransfer({ id: "tr-missing-to" as TransferId, toAccountId: null })
      )
    ).toThrow();
  });

  it("rejects blank external labels as endpoints", () => {
    expect(() =>
      saveTransfer(
        db as any,
        makeTransfer({
          id: "tr-blank-from" as TransferId,
          fromAccountId: null,
          fromExternalLabel: "   ",
        })
      )
    ).toThrow();
    expect(() =>
      saveTransfer(
        db as any,
        makeTransfer({
          id: "tr-blank-to" as TransferId,
          toAccountId: null,
          toExternalLabel: "",
        })
      )
    ).toThrow();
  });
});

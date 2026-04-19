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

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

describe("transfers repository", () => {
  it("saves a transfer, reads it back, and enqueues sync", () => {
    saveTransfer(db as any, {
      id: "tr-1" as TransferId,
      userId: USER_ID,
      amount: 250000 as CopAmount,
      fromAccountId: "fa-1" as FinancialAccountId,
      toAccountId: "fa-2" as FinancialAccountId,
      fromExternalLabel: null,
      toExternalLabel: null,
      description: "Move to savings",
      date: "2026-04-18" as IsoDate,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    expect(getTransfersForUser(db as any, USER_ID)).toEqual([
      expect.objectContaining({
        id: "tr-1",
        userId: USER_ID,
        amount: 250000,
        fromAccountId: "fa-1",
        toAccountId: "fa-2",
      }),
    ]);

    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "transfers",
        rowId: "tr-1",
        operation: "insert",
      }),
    ]);
  });

  it("requires a source and destination endpoint", () => {
    expect(() =>
      saveTransfer(db as any, {
        id: "tr-missing-from" as TransferId,
        userId: USER_ID,
        amount: 250000 as CopAmount,
        fromAccountId: null,
        toAccountId: "fa-2" as FinancialAccountId,
        fromExternalLabel: null,
        toExternalLabel: null,
        description: "Invalid transfer",
        date: "2026-04-18" as IsoDate,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
      })
    ).toThrow();

    expect(() =>
      saveTransfer(db as any, {
        id: "tr-missing-to" as TransferId,
        userId: USER_ID,
        amount: 250000 as CopAmount,
        fromAccountId: "fa-1" as FinancialAccountId,
        toAccountId: null,
        fromExternalLabel: null,
        toExternalLabel: null,
        description: "Invalid transfer",
        date: "2026-04-18" as IsoDate,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
      })
    ).toThrow();
  });
});

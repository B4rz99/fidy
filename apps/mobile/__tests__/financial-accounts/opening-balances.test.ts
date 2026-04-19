// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getOpeningBalanceForAccount,
  saveOpeningBalance,
  upsertOpeningBalance,
} from "@/features/financial-accounts";
import { getQueuedSyncEntries } from "@/features/transactions/lib/repository";
import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  OpeningBalanceId,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const NOW = "2026-04-18T10:00:00.000Z" as IsoDateTime;
const ACCOUNT_ID = "fa-1" as FinancialAccountId;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

describe("opening balances repository", () => {
  it("saves an opening balance, reads it back, and enqueues sync", () => {
    saveOpeningBalance(db as any, {
      id: "ob-1" as OpeningBalanceId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      amount: 500000 as CopAmount,
      effectiveDate: "2026-04-01" as IsoDate,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    expect(getOpeningBalanceForAccount(db as any, ACCOUNT_ID)).toMatchObject({
      id: "ob-1",
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      amount: 500000,
      effectiveDate: "2026-04-01",
    });

    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "openingBalances",
        rowId: "ob-1",
        operation: "insert",
      }),
    ]);
  });

  it("enqueues the persisted row id when a unique-account upsert reuses an existing record", () => {
    saveOpeningBalance(db as any, {
      id: "ob-1" as OpeningBalanceId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      amount: 500000 as CopAmount,
      effectiveDate: "2026-04-01" as IsoDate,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    saveOpeningBalance(db as any, {
      id: "ob-2" as OpeningBalanceId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      amount: 750000 as CopAmount,
      effectiveDate: "2026-04-02" as IsoDate,
      createdAt: NOW,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    });

    expect(getOpeningBalanceForAccount(db as any, ACCOUNT_ID)).toMatchObject({
      id: "ob-1",
      amount: 750000,
      effectiveDate: "2026-04-02",
    });

    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "openingBalances",
        rowId: "ob-1",
        operation: "insert",
      }),
      expect.objectContaining({
        tableName: "openingBalances",
        rowId: "ob-1",
        operation: "update",
      }),
    ]);
  });

  it("replaces a local duplicate id with the pulled server row for the same account", () => {
    saveOpeningBalance(db as any, {
      id: "ob-local" as OpeningBalanceId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      amount: 500000 as CopAmount,
      effectiveDate: "2026-04-01" as IsoDate,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    upsertOpeningBalance(db as any, {
      id: "ob-server" as OpeningBalanceId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      amount: 750000 as CopAmount,
      effectiveDate: "2026-04-02" as IsoDate,
      createdAt: NOW,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    });

    expect(getOpeningBalanceForAccount(db as any, ACCOUNT_ID)).toMatchObject({
      id: "ob-server",
      amount: 750000,
      effectiveDate: "2026-04-02",
    });
  });

  it("keeps a newer local duplicate when the pulled server row is older", () => {
    saveOpeningBalance(db as any, {
      id: "ob-local" as OpeningBalanceId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      amount: 750000 as CopAmount,
      effectiveDate: "2026-04-02" as IsoDate,
      createdAt: NOW,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    });

    upsertOpeningBalance(db as any, {
      id: "ob-server" as OpeningBalanceId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      amount: 500000 as CopAmount,
      effectiveDate: "2026-04-01" as IsoDate,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    expect(getOpeningBalanceForAccount(db as any, ACCOUNT_ID)).toMatchObject({
      id: "ob-local",
      amount: 750000,
      effectiveDate: "2026-04-02",
    });
    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "openingBalances",
        rowId: "ob-local",
        operation: "insert",
      }),
    ]);
  });
});

// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getFinancialAccountIdentifiersForAccount,
  saveFinancialAccountIdentifier,
  upsertFinancialAccountIdentifier,
} from "@/features/financial-accounts";
import { getQueuedSyncEntries } from "@/features/transactions/lib/repository";
import type {
  FinancialAccountId,
  FinancialAccountIdentifierId,
  IsoDateTime,
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

describe("financial account identifiers repository", () => {
  it("saves an identifier, reads it back, and enqueues sync", () => {
    saveFinancialAccountIdentifier(db as any, {
      id: "fai-1" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    expect(getFinancialAccountIdentifiersForAccount(db as any, ACCOUNT_ID)).toEqual([
      expect.objectContaining({
        id: "fai-1",
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        scope: "email:bancolombia:last4",
        value: "1234",
      }),
    ]);

    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "financialAccountIdentifiers",
        rowId: "fai-1",
        operation: "insert",
      }),
    ]);
  });

  it("enqueues the persisted row id when a unique identifier upsert reuses an existing record", () => {
    saveFinancialAccountIdentifier(db as any, {
      id: "fai-1" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    saveFinancialAccountIdentifier(db as any, {
      id: "fai-2" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
      createdAt: NOW,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    });

    expect(getFinancialAccountIdentifiersForAccount(db as any, ACCOUNT_ID)).toEqual([
      expect.objectContaining({
        id: "fai-1",
        scope: "email:bancolombia:last4",
        value: "1234",
        updatedAt: "2026-04-18T11:00:00.000Z",
      }),
    ]);

    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "financialAccountIdentifiers",
        rowId: "fai-1",
        operation: "insert",
      }),
      expect.objectContaining({
        tableName: "financialAccountIdentifiers",
        rowId: "fai-1",
        operation: "update",
      }),
    ]);
  });

  it("replaces a local duplicate id with the pulled server row for the same unique identifier", () => {
    saveFinancialAccountIdentifier(db as any, {
      id: "fai-local" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    upsertFinancialAccountIdentifier(db as any, {
      id: "fai-server" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
      createdAt: NOW,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    });

    expect(getFinancialAccountIdentifiersForAccount(db as any, ACCOUNT_ID)).toEqual([
      expect.objectContaining({
        id: "fai-server",
        scope: "email:bancolombia:last4",
        value: "1234",
        updatedAt: "2026-04-18T11:00:00.000Z",
      }),
    ]);
  });

  it("updates the same row id when the identifier moves onto an occupied unique key", () => {
    saveFinancialAccountIdentifier(db as any, {
      id: "fai-1" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1111",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    saveFinancialAccountIdentifier(db as any, {
      id: "fai-2" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "2222",
      createdAt: "2026-04-18T10:30:00.000Z" as IsoDateTime,
      updatedAt: "2026-04-18T10:30:00.000Z" as IsoDateTime,
      deletedAt: null,
    });

    saveFinancialAccountIdentifier(db as any, {
      id: "fai-1" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "2222",
      createdAt: NOW,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    });

    expect(getFinancialAccountIdentifiersForAccount(db as any, ACCOUNT_ID)).toEqual([
      expect.objectContaining({
        id: "fai-1",
        scope: "email:bancolombia:last4",
        value: "2222",
        updatedAt: "2026-04-18T11:00:00.000Z",
      }),
    ]);
  });

  it("keeps a newer local duplicate when the pulled server row is older", () => {
    saveFinancialAccountIdentifier(db as any, {
      id: "fai-local" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
      createdAt: NOW,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    });

    upsertFinancialAccountIdentifier(db as any, {
      id: "fai-server" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    expect(getFinancialAccountIdentifiersForAccount(db as any, ACCOUNT_ID)).toEqual([
      expect.objectContaining({
        id: "fai-local",
        scope: "email:bancolombia:last4",
        value: "1234",
        updatedAt: "2026-04-18T11:00:00.000Z",
      }),
    ]);
    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "financialAccountIdentifiers",
        rowId: "fai-local",
        operation: "insert",
      }),
    ]);
  });

  it("allows re-creating an identifier after soft delete", () => {
    saveFinancialAccountIdentifier(db as any, {
      id: "fai-1" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    saveFinancialAccountIdentifier(db as any, {
      id: "fai-1" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
      createdAt: NOW,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
      deletedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });

    saveFinancialAccountIdentifier(db as any, {
      id: "fai-2" as FinancialAccountIdentifierId,
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
      createdAt: "2026-04-18T12:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-04-18T12:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    });

    expect(getFinancialAccountIdentifiersForAccount(db as any, ACCOUNT_ID)).toEqual([
      expect.objectContaining({
        id: "fai-2",
        scope: "email:bancolombia:last4",
        value: "1234",
        updatedAt: "2026-04-18T12:00:00.000Z",
      }),
    ]);
  });
});

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
import type { FinancialAccountIdentifierId, IsoDateTime } from "@/shared/types/branded";
import { createIdentifierFixture, FIXTURE_ACCOUNT_ID, FIXTURE_USER_ID } from "./fixtures";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = FIXTURE_USER_ID;
const ACCOUNT_ID = FIXTURE_ACCOUNT_ID;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function saveIdentifier(overrides: Partial<ReturnType<typeof createIdentifierFixture>> = {}) {
  saveFinancialAccountIdentifier(db as any, createIdentifierFixture(overrides));
}

function upsertIdentifier(overrides: Partial<ReturnType<typeof createIdentifierFixture>> = {}) {
  upsertFinancialAccountIdentifier(db as any, createIdentifierFixture(overrides));
}

function expectIdentifiersForAccount(matcher: Record<string, unknown>) {
  expect(getFinancialAccountIdentifiersForAccount(db as any, ACCOUNT_ID)).toEqual([
    expect.objectContaining(matcher),
  ]);
}

describe("financial account identifiers repository", () => {
  it("saves an identifier, reads it back, and enqueues sync", () => {
    saveIdentifier();

    expectIdentifiersForAccount({
      id: "fai-1",
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      scope: "email:bancolombia:last4",
      value: "1234",
    });

    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "financialAccountIdentifiers",
        rowId: "fai-1",
        operation: "insert",
      }),
    ]);
  });

  it("enqueues the persisted row id when a unique identifier upsert reuses an existing record", () => {
    saveIdentifier();
    saveIdentifier({
      id: "fai-2" as FinancialAccountIdentifierId,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });

    expectIdentifiersForAccount({
      id: "fai-1",
      scope: "email:bancolombia:last4",
      value: "1234",
      updatedAt: "2026-04-18T11:00:00.000Z",
    });

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
    saveIdentifier({ id: "fai-local" as FinancialAccountIdentifierId });
    upsertIdentifier({
      id: "fai-server" as FinancialAccountIdentifierId,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });

    expectIdentifiersForAccount({
      id: "fai-server",
      scope: "email:bancolombia:last4",
      value: "1234",
      updatedAt: "2026-04-18T11:00:00.000Z",
    });
  });

  it("updates the same row id when the identifier moves onto an occupied unique key", () => {
    saveIdentifier({ value: "1111" });
    saveIdentifier({
      id: "fai-2" as FinancialAccountIdentifierId,
      value: "2222",
      createdAt: "2026-04-18T10:30:00.000Z" as IsoDateTime,
      updatedAt: "2026-04-18T10:30:00.000Z" as IsoDateTime,
    });
    saveIdentifier({
      id: "fai-1" as FinancialAccountIdentifierId,
      value: "2222",
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });

    expectIdentifiersForAccount({
      id: "fai-1",
      scope: "email:bancolombia:last4",
      value: "2222",
      updatedAt: "2026-04-18T11:00:00.000Z",
    });
  });

  it("keeps a newer local duplicate when the pulled server row is older", () => {
    saveIdentifier({
      id: "fai-local" as FinancialAccountIdentifierId,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });
    upsertIdentifier({ id: "fai-server" as FinancialAccountIdentifierId });

    expectIdentifiersForAccount({
      id: "fai-local",
      scope: "email:bancolombia:last4",
      value: "1234",
      updatedAt: "2026-04-18T11:00:00.000Z",
    });
    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "financialAccountIdentifiers",
        rowId: "fai-local",
        operation: "insert",
      }),
    ]);
  });

  it("allows re-creating an identifier after soft delete", () => {
    saveIdentifier();
    saveIdentifier({
      id: "fai-1" as FinancialAccountIdentifierId,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
      deletedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });
    saveIdentifier({
      id: "fai-2" as FinancialAccountIdentifierId,
      createdAt: "2026-04-18T12:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-04-18T12:00:00.000Z" as IsoDateTime,
    });

    expectIdentifiersForAccount({
      id: "fai-2",
      scope: "email:bancolombia:last4",
      value: "1234",
      updatedAt: "2026-04-18T12:00:00.000Z",
    });
  });
});

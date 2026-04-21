// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureDefaultFinancialAccount,
  getDefaultFinancialAccountForUser,
  getFinancialAccountsForUser,
  saveFinancialAccount,
} from "@/features/financial-accounts";
import { getQueuedSyncEntries } from "@/features/transactions/lib/repository";
import type { FinancialAccountId, IsoDateTime } from "@/shared/types/branded";
import { createFinancialAccountFixture, FIXTURE_NOW, FIXTURE_USER_ID } from "./fixtures";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = FIXTURE_USER_ID;
const NOW = FIXTURE_NOW;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function saveAccount(overrides: Partial<ReturnType<typeof createFinancialAccountFixture>> = {}) {
  saveFinancialAccount(db as any, createFinancialAccountFixture(overrides));
}

function expectFinancialAccountSyncEntries(...entries: readonly [string, string][]) {
  expect(getQueuedSyncEntries(db as any)).toEqual(
    entries.map(([rowId, operation]) =>
      expect.objectContaining({
        tableName: "financialAccounts",
        rowId,
        operation,
      })
    )
  );
}

describe("financial accounts repository", () => {
  it("saves an account, reads it back, and enqueues sync", () => {
    saveAccount();

    expect(getFinancialAccountsForUser(db as any, USER_ID)).toEqual([
      expect.objectContaining({
        id: "fa-1",
        userId: USER_ID,
        name: "Main wallet",
        kind: "wallet",
        isDefault: true,
      }),
    ]);

    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "financialAccounts",
        rowId: "fa-1",
        operation: "insert",
      }),
    ]);
  });

  it("bootstraps the default account once and reuses it on later calls", () => {
    const first = ensureDefaultFinancialAccount(db as any, USER_ID, { now: NOW, name: "Cash" });
    const second = ensureDefaultFinancialAccount(db as any, USER_ID, { now: NOW, name: "Cash" });

    expect(first).toMatchObject({
      userId: USER_ID,
      name: "Cash",
      kind: "cash",
      isDefault: true,
    });
    expect(second).toEqual(first);
    expect(getDefaultFinancialAccountForUser(db as any, USER_ID)).toEqual(first);
    expect(getFinancialAccountsForUser(db as any, USER_ID)).toHaveLength(1);
    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "financialAccounts",
        rowId: first.id,
        operation: "insert",
      }),
    ]);
  });

  it("reuses an existing default account instead of creating a new canonical one", () => {
    saveAccount({
      id: "fa-bank-1" as FinancialAccountId,
      name: "Bancolombia",
      kind: "checking",
    });

    const defaultAccount = ensureDefaultFinancialAccount(db as any, USER_ID, {
      now: "2026-04-18T12:00:00.000Z" as IsoDateTime,
    });

    expect(defaultAccount).toMatchObject({
      id: "fa-bank-1",
      userId: USER_ID,
      name: "Bancolombia",
      kind: "checking",
      isDefault: true,
    });
    expect(getFinancialAccountsForUser(db as any, USER_ID)).toHaveLength(1);
  });

  it("promotes an existing canonical account to the actual default when the flag is missing", () => {
    saveAccount({
      id: "fa-default-user-1" as FinancialAccountId,
      name: "Cash",
      kind: "cash",
      isDefault: false,
    });

    const defaultAccount = ensureDefaultFinancialAccount(db as any, USER_ID, {
      now: "2026-04-18T12:00:00.000Z" as IsoDateTime,
    });

    expect(defaultAccount).toMatchObject({
      id: "fa-default-user-1",
      userId: USER_ID,
      name: "Cash",
      kind: "cash",
      isDefault: true,
    });
    expect(getDefaultFinancialAccountForUser(db as any, USER_ID)).toMatchObject({
      id: "fa-default-user-1",
      isDefault: true,
    });
    expectFinancialAccountSyncEntries(
      ["fa-default-user-1", "insert"],
      ["fa-default-user-1", "update"]
    );
  });
});

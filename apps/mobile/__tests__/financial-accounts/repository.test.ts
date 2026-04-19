// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getFinancialAccountsForUser, saveFinancialAccount } from "@/features/financial-accounts";
import { getQueuedSyncEntries } from "@/features/transactions/lib/repository";
import type { FinancialAccountId, IsoDateTime, UserId } from "@/shared/types/branded";

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

describe("financial accounts repository", () => {
  it("saves an account, reads it back, and enqueues sync", () => {
    saveFinancialAccount(db as any, {
      id: "fa-1" as FinancialAccountId,
      userId: USER_ID,
      name: "Main wallet",
      kind: "wallet",
      isDefault: true,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

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
});

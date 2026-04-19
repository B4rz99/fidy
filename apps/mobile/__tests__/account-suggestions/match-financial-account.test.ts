// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findMatchingFinancialAccountId } from "@/features/account-suggestions";
import {
  saveFinancialAccount,
  saveFinancialAccountIdentifier,
} from "@/features/financial-accounts";
import type {
  FinancialAccountId,
  FinancialAccountIdentifierId,
  IsoDateTime,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const NOW = "2026-04-19T10:00:00.000Z" as IsoDateTime;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function saveAccount(id: FinancialAccountId, deletedAt: IsoDateTime | null = null) {
  saveFinancialAccount(db as any, {
    id,
    userId: USER_ID,
    name: String(id),
    kind: "credit_card",
    isDefault: false,
    createdAt: NOW,
    updatedAt: deletedAt ?? NOW,
    deletedAt,
  });
}

function saveIdentifier(id: string, accountId: FinancialAccountId, value: string) {
  saveFinancialAccountIdentifier(db as any, {
    id: id as FinancialAccountIdentifierId,
    userId: USER_ID,
    accountId,
    scope: "notification:bancolombia:last4",
    value,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  });
}

describe("findMatchingFinancialAccountId", () => {
  it("ignores identifiers that belong to deleted accounts", () => {
    saveAccount("fa-deleted" as FinancialAccountId, "2026-04-19T11:00:00.000Z" as IsoDateTime);
    saveIdentifier("fai-1", "fa-deleted" as FinancialAccountId, "1234");

    expect(
      findMatchingFinancialAccountId(db as any, USER_ID, [
        { scope: "notification:bancolombia:last4", value: "1234" },
      ])
    ).toBeNull();
  });

  it("still matches a single active account when a deleted account has the same identifier", () => {
    saveAccount("fa-deleted" as FinancialAccountId, "2026-04-19T11:00:00.000Z" as IsoDateTime);
    saveAccount("fa-active" as FinancialAccountId);
    saveIdentifier("fai-1", "fa-deleted" as FinancialAccountId, "1234");
    saveIdentifier("fai-2", "fa-active" as FinancialAccountId, "1234");

    expect(
      findMatchingFinancialAccountId(db as any, USER_ID, [
        { scope: "notification:bancolombia:last4", value: "1234" },
      ])
    ).toBe("fa-active");
  });
});

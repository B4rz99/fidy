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
import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  OpeningBalanceId,
} from "@/shared/types/branded";
import { createOpeningBalanceFixture, FIXTURE_ACCOUNT_ID, FIXTURE_USER_ID } from "./fixtures";

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

function saveBalance(overrides: Partial<ReturnType<typeof createOpeningBalanceFixture>> = {}) {
  saveOpeningBalance(db as any, createOpeningBalanceFixture(overrides));
}

function upsertBalance(overrides: Partial<ReturnType<typeof createOpeningBalanceFixture>> = {}) {
  upsertOpeningBalance(db as any, createOpeningBalanceFixture(overrides));
}

function expectOpeningBalanceForAccount(
  accountId: FinancialAccountId,
  matcher: Record<string, unknown>
) {
  expect(getOpeningBalanceForAccount(db as any, accountId)).toMatchObject(matcher);
}

describe("opening balances repository", () => {
  it("saves an opening balance, reads it back,", () => {
    saveBalance();

    expectOpeningBalanceForAccount(ACCOUNT_ID, {
      id: "ob-1",
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      amount: 500000,
      effectiveDate: "2026-04-01",
    });
  });

  it("enqueues the persisted row id when a unique-account upsert reuses an existing record", () => {
    saveBalance();
    saveBalance({
      id: "ob-2" as OpeningBalanceId,
      amount: 750000 as CopAmount,
      effectiveDate: "2026-04-02" as IsoDate,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });

    expectOpeningBalanceForAccount(ACCOUNT_ID, {
      id: "ob-1",
      amount: 750000,
      effectiveDate: "2026-04-02",
    });
  });

  it("replaces a local duplicate id with the pulled server row for the same account", () => {
    saveBalance({ id: "ob-local" as OpeningBalanceId });
    upsertBalance({
      id: "ob-server" as OpeningBalanceId,
      amount: 750000 as CopAmount,
      effectiveDate: "2026-04-02" as IsoDate,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });

    expectOpeningBalanceForAccount(ACCOUNT_ID, {
      id: "ob-server",
      amount: 750000,
      effectiveDate: "2026-04-02",
    });
  });

  it("updates the same row id when an opening balance moves to a different account", () => {
    saveBalance();
    saveBalance({
      accountId: "fa-2" as FinancialAccountId,
      amount: 750000 as CopAmount,
      effectiveDate: "2026-04-02" as IsoDate,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });

    expect(getOpeningBalanceForAccount(db as any, ACCOUNT_ID)).toBeNull();
    expectOpeningBalanceForAccount("fa-2" as FinancialAccountId, {
      id: "ob-1",
      amount: 750000,
      effectiveDate: "2026-04-02",
    });
  });

  it("keeps a newer local duplicate when the pulled server row is older", () => {
    saveBalance({
      id: "ob-local" as OpeningBalanceId,
      amount: 750000 as CopAmount,
      effectiveDate: "2026-04-02" as IsoDate,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });
    upsertBalance({ id: "ob-server" as OpeningBalanceId });

    expectOpeningBalanceForAccount(ACCOUNT_ID, {
      id: "ob-local",
      amount: 750000,
      effectiveDate: "2026-04-02",
    });
  });

  it("allows re-creating an opening balance after soft delete", () => {
    saveBalance();
    saveBalance({
      id: "ob-1" as OpeningBalanceId,
      updatedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
      deletedAt: "2026-04-18T11:00:00.000Z" as IsoDateTime,
    });
    saveBalance({
      id: "ob-2" as OpeningBalanceId,
      amount: 750000 as CopAmount,
      effectiveDate: "2026-04-02" as IsoDate,
      createdAt: "2026-04-18T12:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-04-18T12:00:00.000Z" as IsoDateTime,
    });

    expectOpeningBalanceForAccount(ACCOUNT_ID, {
      id: "ob-2",
      amount: 750000,
      effectiveDate: "2026-04-02",
    });
  });
});

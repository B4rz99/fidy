// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getFinancialAccountBalancesForUser } from "@/features/financial-accounts/lib/balance-repository";
import { financialAccounts, openingBalances, transactions, transfers } from "@/shared/db/schema";
import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  OpeningBalanceId,
  TransactionId,
  TransferId,
} from "@/shared/types/branded";
import {
  createBalanceTransactionFixture,
  createBalanceTransferFixture,
  FIXTURE_USER_ID,
} from "./fixtures";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = FIXTURE_USER_ID;
const NOW = "2026-04-19T10:00:00.000Z" as IsoDateTime;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function saveAccount(id: string, kind: "checking" | "credit_card") {
  db.insert(financialAccounts)
    .values({
      id: id as FinancialAccountId,
      userId: USER_ID,
      name: id,
      kind,
      isDefault: false,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    })
    .run();
}

function saveAccountOpeningBalance(accountId: string, amount: number, effectiveDate: string) {
  db.insert(openingBalances)
    .values({
      id: `ob-${accountId}` as OpeningBalanceId,
      userId: USER_ID,
      accountId: accountId as FinancialAccountId,
      amount: amount as CopAmount,
      effectiveDate: effectiveDate as IsoDate,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    })
    .run();
}

function saveAccountTransaction(
  entry: ReturnType<typeof createBalanceTransactionFixture> = createBalanceTransactionFixture()
) {
  db.insert(transactions)
    .values({
      id: entry.id as TransactionId,
      userId: USER_ID,
      type: entry.type,
      amount: entry.amount as CopAmount,
      categoryId: "other" as never,
      accountId: entry.accountId as FinancialAccountId,
      accountAttributionState: entry.accountAttributionState ?? "confirmed",
      description: entry.id,
      date: entry.date as IsoDate,
      createdAt: NOW,
      updatedAt: NOW,
      voidedAt: null,
      supersededAt: entry.supersededAt ?? null,
      source: entry.accountAttributionState === "unresolved" ? "automated" : "manual",
    })
    .run();
}

function saveAccountTransfer(
  entry: ReturnType<typeof createBalanceTransferFixture> = createBalanceTransferFixture()
) {
  db.insert(transfers)
    .values({
      id: entry.id as TransferId,
      userId: USER_ID,
      amount: entry.amount as CopAmount,
      fromAccountId: entry.fromAccountId as FinancialAccountId | null,
      toAccountId: entry.toAccountId as FinancialAccountId | null,
      fromExternalLabel: entry.fromExternalLabel,
      toExternalLabel: entry.toExternalLabel,
      description: entry.id,
      date: entry.date as IsoDate,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    })
    .run();
}

function expectBalances(asOf: IsoDate, balances: Record<string, number>) {
  expect(getFinancialAccountBalancesForUser(db as any, USER_ID, asOf)).toEqual(balances);
}

function seedAccountsAndOpeningBalances() {
  (
    [
      ["fa-checking", "checking"],
      ["fa-card", "credit_card"],
    ] as const
  ).forEach(([id, kind]) => {
    saveAccount(id, kind as "checking" | "credit_card");
  });
  saveAccountOpeningBalance("fa-checking", 1_000_000, "2026-04-01");
  saveAccountOpeningBalance("fa-card", 800_000, "2026-04-01");
}

function seedBalanceTransactions() {
  [
    createBalanceTransactionFixture({
      id: "tx-checking-expense",
      accountId: "fa-checking",
      amount: 200_000,
    }),
    createBalanceTransactionFixture({
      id: "tx-checking-income",
      accountId: "fa-checking",
      type: "income",
      amount: 50_000,
      date: "2026-04-12",
    }),
    createBalanceTransactionFixture({
      id: "tx-checking-unresolved",
      accountId: "fa-checking",
      type: "income",
      amount: 999_999,
      date: "2026-04-13",
      accountAttributionState: "unresolved",
    }),
    createBalanceTransactionFixture({
      id: "tx-card-expense",
      accountId: "fa-card",
      amount: 300_000,
      date: "2026-04-11",
    }),
  ].forEach(saveAccountTransaction);
}

function seedBalanceTransfers() {
  [
    createBalanceTransferFixture({
      id: "tr-to-card",
      amount: 450_000,
      date: "2026-04-18",
      fromAccountId: "fa-checking",
      toAccountId: "fa-card",
    }),
    createBalanceTransferFixture({
      id: "tr-from-outside",
      amount: 120_000,
      date: "2026-04-17",
      fromAccountId: null,
      toAccountId: "fa-checking",
      fromExternalLabel: "Outside Fidy",
    }),
  ].forEach(saveAccountTransfer);
}

function seedDerivedBalanceScenario() {
  seedAccountsAndOpeningBalances();
  seedBalanceTransactions();
  seedBalanceTransfers();
}

describe("financial account balance repository", () => {
  it("derives balances from opening balances, confirmed transactions, and transfers", () => {
    seedDerivedBalanceScenario();
    expectBalances("2026-04-19" as IsoDate, {
      "fa-card": -650_000,
      "fa-checking": 520_000,
    });
  });

  it("ignores future-dated balance effects until their effective date", () => {
    saveAccount("fa-wallet", "checking");
    saveAccountOpeningBalance("fa-wallet", 300_000, "2026-04-20");
    saveAccountTransaction(
      createBalanceTransactionFixture({
        id: "tx-future",
        accountId: "fa-wallet",
        type: "income",
        amount: 100_000,
        date: "2026-04-20",
      })
    );
    saveAccountTransfer(
      createBalanceTransferFixture({
        id: "tr-future",
        amount: 40_000,
        date: "2026-04-20",
        fromAccountId: null,
        toAccountId: "fa-wallet",
        fromExternalLabel: "Outside Fidy",
      })
    );

    expectBalances("2026-04-19" as IsoDate, { "fa-wallet": 0 });
    expectBalances("2026-04-20" as IsoDate, { "fa-wallet": 440_000 });
  });

  it("ignores superseded transactions when deriving balances", () => {
    saveAccount("fa-checking", "checking");
    saveAccountTransaction(
      createBalanceTransactionFixture({
        id: "tx-active",
        accountId: "fa-checking",
        amount: 100_000,
      })
    );
    saveAccountTransaction(
      createBalanceTransactionFixture({
        id: "tx-superseded",
        accountId: "fa-checking",
        amount: 350_000,
        date: "2026-04-11",
        supersededAt: "2026-04-12T09:00:00.000Z" as IsoDateTime,
      })
    );

    expectBalances("2026-04-19" as IsoDate, { "fa-checking": -100_000 });
  });
});

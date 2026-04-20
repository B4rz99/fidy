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

function saveAccountTransaction({
  id,
  accountId,
  type,
  amount,
  date,
  accountAttributionState = "confirmed",
  supersededAt = null,
}: {
  readonly id: string;
  readonly accountId: string;
  readonly type: "expense" | "income";
  readonly amount: number;
  readonly date: string;
  readonly accountAttributionState?: "confirmed" | "unresolved";
  readonly supersededAt?: IsoDateTime | null;
}) {
  db.insert(transactions)
    .values({
      id: id as TransactionId,
      userId: USER_ID,
      type,
      amount: amount as CopAmount,
      categoryId: "other" as never,
      accountId: accountId as FinancialAccountId,
      accountAttributionState,
      description: id,
      date: date as IsoDate,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      supersededAt,
      source: accountAttributionState === "unresolved" ? "gmail" : "manual",
    })
    .run();
}

function saveAccountTransfer({
  id,
  amount,
  date,
  fromAccountId,
  toAccountId,
  fromExternalLabel = null,
  toExternalLabel = null,
}: {
  readonly id: string;
  readonly amount: number;
  readonly date: string;
  readonly fromAccountId: string | null;
  readonly toAccountId: string | null;
  readonly fromExternalLabel?: string | null;
  readonly toExternalLabel?: string | null;
}) {
  db.insert(transfers)
    .values({
      id: id as TransferId,
      userId: USER_ID,
      amount: amount as CopAmount,
      fromAccountId: fromAccountId as FinancialAccountId | null,
      toAccountId: toAccountId as FinancialAccountId | null,
      fromExternalLabel,
      toExternalLabel,
      description: id,
      date: date as IsoDate,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    })
    .run();
}

describe("financial account balance repository", () => {
  it("derives balances from opening balances, confirmed transactions, and transfers", () => {
    saveAccount("fa-checking", "checking");
    saveAccount("fa-card", "credit_card");
    saveAccountOpeningBalance("fa-checking", 1_000_000, "2026-04-01");
    saveAccountOpeningBalance("fa-card", 800_000, "2026-04-01");

    saveAccountTransaction({
      id: "tx-checking-expense",
      accountId: "fa-checking",
      type: "expense",
      amount: 200_000,
      date: "2026-04-10",
    });
    saveAccountTransaction({
      id: "tx-checking-income",
      accountId: "fa-checking",
      type: "income",
      amount: 50_000,
      date: "2026-04-12",
    });
    saveAccountTransaction({
      id: "tx-checking-unresolved",
      accountId: "fa-checking",
      type: "income",
      amount: 999_999,
      date: "2026-04-13",
      accountAttributionState: "unresolved",
    });
    saveAccountTransaction({
      id: "tx-card-expense",
      accountId: "fa-card",
      type: "expense",
      amount: 300_000,
      date: "2026-04-11",
    });

    saveAccountTransfer({
      id: "tr-to-card",
      amount: 450_000,
      date: "2026-04-18",
      fromAccountId: "fa-checking",
      toAccountId: "fa-card",
    });
    saveAccountTransfer({
      id: "tr-from-outside",
      amount: 120_000,
      date: "2026-04-17",
      fromAccountId: null,
      toAccountId: "fa-checking",
      fromExternalLabel: "Outside Fidy",
    });

    expect(getFinancialAccountBalancesForUser(db as any, USER_ID, "2026-04-19" as IsoDate)).toEqual(
      {
        "fa-card": -650_000,
        "fa-checking": 520_000,
      }
    );
  });

  it("ignores future-dated balance effects until their effective date", () => {
    saveAccount("fa-wallet", "checking");
    saveAccountOpeningBalance("fa-wallet", 300_000, "2026-04-20");
    saveAccountTransaction({
      id: "tx-future",
      accountId: "fa-wallet",
      type: "income",
      amount: 100_000,
      date: "2026-04-20",
    });
    saveAccountTransfer({
      id: "tr-future",
      amount: 40_000,
      date: "2026-04-20",
      fromAccountId: null,
      toAccountId: "fa-wallet",
      fromExternalLabel: "Outside Fidy",
    });

    expect(getFinancialAccountBalancesForUser(db as any, USER_ID, "2026-04-19" as IsoDate)).toEqual(
      {
        "fa-wallet": 0,
      }
    );
    expect(getFinancialAccountBalancesForUser(db as any, USER_ID, "2026-04-20" as IsoDate)).toEqual(
      {
        "fa-wallet": 440_000,
      }
    );
  });

  it("ignores superseded transactions when deriving balances", () => {
    saveAccount("fa-checking", "checking");
    saveAccountTransaction({
      id: "tx-active",
      accountId: "fa-checking",
      type: "expense",
      amount: 100_000,
      date: "2026-04-10",
    });
    saveAccountTransaction({
      id: "tx-superseded",
      accountId: "fa-checking",
      type: "expense",
      amount: 350_000,
      date: "2026-04-11",
      supersededAt: "2026-04-12T09:00:00.000Z" as IsoDateTime,
    });

    expect(getFinancialAccountBalancesForUser(db as any, USER_ID, "2026-04-19" as IsoDate)).toEqual(
      {
        "fa-checking": -100_000,
      }
    );
  });
});

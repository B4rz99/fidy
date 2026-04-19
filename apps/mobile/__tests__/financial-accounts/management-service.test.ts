// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getFinancialAccountById,
  getFinancialAccountIdentifiersForAccount,
  getOpeningBalanceById,
  getOpeningBalanceForAccount,
} from "@/features/financial-accounts";
import {
  createFinancialAccountManagementService,
  MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE,
} from "@/features/financial-accounts/lib/management-service";
import { getQueuedSyncEntries } from "@/features/transactions/lib/repository";
import type { IsoDateTime, UserId } from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

describe("financial account management service", () => {
  it("creates a manual account with an optional opening balance and identifier", () => {
    const service = createFinancialAccountManagementService({
      now: () => "2026-04-19T10:00:00.000Z" as IsoDateTime,
      createAccountId: () => "fa-new" as never,
      createOpeningBalanceId: () => "ob-new" as never,
      createIdentifierId: () => "fai-new" as never,
    });

    const result = service.createAccount({
      db: db as any,
      userId: USER_ID,
      name: "Main wallet",
      kind: "wallet",
      openingBalanceAmount: 850000 as never,
      openingBalanceEffectiveDate: "2026-04-01" as never,
      manualIdentifierValue: "Ahorros casa",
      statementClosingDay: null,
      paymentDueDay: null,
    });

    expect(result.account).toMatchObject({
      id: "fa-new",
      userId: USER_ID,
      name: "Main wallet",
      kind: "wallet",
      isDefault: false,
    });
    expect(getFinancialAccountById(db as any, result.account.id)).toMatchObject({
      id: "fa-new",
      name: "Main wallet",
      kind: "wallet",
    });
    expect(getOpeningBalanceForAccount(db as any, result.account.id)).toMatchObject({
      id: "ob-new",
      amount: 850000,
      effectiveDate: "2026-04-01",
    });
    expect(getFinancialAccountIdentifiersForAccount(db as any, result.account.id)).toEqual([
      expect.objectContaining({
        id: "fai-new",
        scope: MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE,
        value: "Ahorros casa",
      }),
    ]);
    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "financialAccounts",
        rowId: "fa-new",
        operation: "insert",
      }),
      expect.objectContaining({
        tableName: "openingBalances",
        rowId: "ob-new",
        operation: "insert",
      }),
      expect.objectContaining({
        tableName: "financialAccountIdentifiers",
        rowId: "fai-new",
        operation: "insert",
      }),
    ]);
  });

  it("allows creating a credit-card account without a billing profile and reports the gap", () => {
    const service = createFinancialAccountManagementService({
      now: () => "2026-04-19T12:00:00.000Z" as IsoDateTime,
      createAccountId: () => "fa-card" as never,
    });

    const result = service.createAccount({
      db: db as any,
      userId: USER_ID,
      name: "Visa Platinum",
      kind: "credit_card",
      openingBalanceAmount: null,
      openingBalanceEffectiveDate: null,
      manualIdentifierValue: null,
      statementClosingDay: null,
      paymentDueDay: null,
    });

    expect(getFinancialAccountById(db as any, result.account.id)).toMatchObject({
      id: "fa-card",
      kind: "credit_card",
      statementClosingDay: null,
      paymentDueDay: null,
    });
    expect(
      service.getAccountDetails({ db: db as any, accountId: result.account.id })
    ).toMatchObject({
      hasBillingProfileGap: true,
    });
  });

  it("updates the billing profile, removes the opening balance, and lets users add identifiers later", () => {
    const service = createFinancialAccountManagementService({
      now: () => "2026-04-19T13:00:00.000Z" as IsoDateTime,
      createAccountId: () => "fa-card-2" as never,
      createOpeningBalanceId: () => "ob-card-2" as never,
      createIdentifierId: () => "fai-later" as never,
    });

    const created = service.createAccount({
      db: db as any,
      userId: USER_ID,
      name: "Mastercard Gold",
      kind: "credit_card",
      openingBalanceAmount: 420000 as never,
      openingBalanceEffectiveDate: "2026-04-05" as never,
      manualIdentifierValue: null,
      statementClosingDay: null,
      paymentDueDay: null,
    });

    const existingOpeningBalance = getOpeningBalanceForAccount(db as any, created.account.id);

    service.addManualIdentifier({
      db: db as any,
      userId: USER_ID,
      accountId: created.account.id,
      value: "MC gold",
    });

    service.updateAccount({
      db: db as any,
      userId: USER_ID,
      accountId: created.account.id,
      name: "Mastercard Gold",
      kind: "credit_card",
      openingBalanceAmount: null,
      openingBalanceEffectiveDate: null,
      statementClosingDay: 14,
      paymentDueDay: 29,
    });

    expect(getFinancialAccountById(db as any, created.account.id)).toMatchObject({
      id: "fa-card-2",
      statementClosingDay: 14,
      paymentDueDay: 29,
    });
    expect(getFinancialAccountIdentifiersForAccount(db as any, created.account.id)).toEqual([
      expect.objectContaining({
        id: "fai-later",
        scope: MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE,
        value: "MC gold",
      }),
    ]);
    expect(getOpeningBalanceForAccount(db as any, created.account.id)).toBeNull();
    expect(
      getOpeningBalanceById(db as any, existingOpeningBalance?.id ?? ("missing" as never))
    ).toMatchObject({
      id: "ob-card-2",
      deletedAt: "2026-04-19T13:00:00.000Z",
    });
    expect(
      service.getAccountDetails({ db: db as any, accountId: created.account.id })
    ).toMatchObject({
      hasBillingProfileGap: false,
    });
  });
});

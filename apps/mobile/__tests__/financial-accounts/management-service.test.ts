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
import type { FinancialAccountId, IsoDateTime, UserId } from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;

type FinancialAccountService = ReturnType<typeof createFinancialAccountManagementService>;
type CreateAccountInput = Parameters<FinancialAccountService["createAccount"]>[0];

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function createService(overrides: Record<string, unknown> = {}) {
  return createFinancialAccountManagementService({
    now: () => "2026-04-19T10:00:00.000Z" as IsoDateTime,
    createAccountId: () => "fa-new" as never,
    createOpeningBalanceId: () => "ob-new" as never,
    createIdentifierId: () => "fai-new" as never,
    ...overrides,
  });
}

function createAccountInput(overrides: Record<string, unknown> = {}) {
  return {
    db: db as any,
    userId: USER_ID,
    name: "Main wallet",
    kind: "wallet" as const,
    openingBalanceAmount: 850000 as never,
    openingBalanceEffectiveDate: "2026-04-01" as never,
    manualIdentifierValue: "Ahorros casa",
    statementClosingDay: null,
    paymentDueDay: null,
    ...overrides,
  } as CreateAccountInput;
}

function expectManualAccountRecord(accountId: FinancialAccountId) {
  expect(getFinancialAccountById(db as any, accountId)).toMatchObject({
    id: "fa-new",
    name: "Main wallet",
    kind: "wallet",
  });
}

function expectManualOpeningBalance(accountId: FinancialAccountId) {
  expect(getOpeningBalanceForAccount(db as any, accountId)).toMatchObject({
    id: "ob-new",
    amount: 850000,
    effectiveDate: "2026-04-01",
  });
}

function expectManualIdentifier(accountId: FinancialAccountId) {
  expect(getFinancialAccountIdentifiersForAccount(db as any, accountId)).toEqual([
    expect.objectContaining({
      id: "fai-new",
      scope: MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE,
      value: "Ahorros casa",
    }),
  ]);
}

function expectUpdatedCreditCardAccount(accountId: FinancialAccountId, openingBalanceId: string) {
  expect(getFinancialAccountById(db as any, accountId)).toMatchObject({
    id: "fa-card-2",
    statementClosingDay: 14,
    paymentDueDay: 29,
  });
  expect(getFinancialAccountIdentifiersForAccount(db as any, accountId)).toEqual([
    expect.objectContaining({
      id: "fai-later",
      scope: MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE,
      value: "MC gold",
    }),
  ]);
  expect(getOpeningBalanceForAccount(db as any, accountId)).toBeNull();
  expect(getOpeningBalanceById(db as any, openingBalanceId as never)).toMatchObject({
    id: "ob-card-2",
    deletedAt: "2026-04-19T13:00:00.000Z",
  });
}

function createManagedCreditCard(service: ReturnType<typeof createService>) {
  return service.createAccount(
    createAccountInput({
      name: "Mastercard Gold",
      kind: "credit_card" as const,
      openingBalanceAmount: 420000 as never,
      openingBalanceEffectiveDate: "2026-04-05" as never,
      manualIdentifierValue: null,
    })
  );
}

function addCreditCardIdentifier(
  service: ReturnType<typeof createService>,
  accountId: FinancialAccountId
) {
  service.addManualIdentifier({
    db: db as any,
    userId: USER_ID,
    accountId,
    value: "MC gold",
  });
}

function updateCreditCardBillingProfile(
  service: ReturnType<typeof createService>,
  accountId: FinancialAccountId
) {
  service.updateAccount({
    db: db as any,
    userId: USER_ID,
    accountId,
    name: "Mastercard Gold",
    kind: "credit_card",
    openingBalanceAmount: null,
    openingBalanceEffectiveDate: null,
    statementClosingDay: 14,
    paymentDueDay: 29,
  });
}

describe("financial account management service", () => {
  it("creates a manual account with an optional opening balance and identifier", () => {
    const service = createService();
    const result = service.createAccount(createAccountInput());

    expect(result.account).toMatchObject({
      id: "fa-new",
      userId: USER_ID,
      name: "Main wallet",
      kind: "wallet",
      isDefault: false,
    });
    expectManualAccountRecord(result.account.id);
    expectManualOpeningBalance(result.account.id);
    expectManualIdentifier(result.account.id);
  });

  it("does not persist manual identifiers for cash accounts", () => {
    const service = createService();
    const result = service.createAccount(
      createAccountInput({
        name: "Cash drawer",
        kind: "cash" as const,
        manualIdentifierValue: "Efectivo",
      })
    );

    expect(getFinancialAccountById(db as any, result.account.id)).toMatchObject({
      kind: "cash",
    });
    expect(getFinancialAccountIdentifiersForAccount(db as any, result.account.id)).toEqual([]);
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
    const service = createService({
      now: () => "2026-04-19T13:00:00.000Z" as IsoDateTime,
      createAccountId: () => "fa-card-2" as never,
      createOpeningBalanceId: () => "ob-card-2" as never,
      createIdentifierId: () => "fai-later" as never,
    });
    const created = createManagedCreditCard(service);
    const existingOpeningBalanceId = getOpeningBalanceForAccount(db as any, created.account.id)?.id;

    addCreditCardIdentifier(service, created.account.id);
    updateCreditCardBillingProfile(service, created.account.id);

    expectUpdatedCreditCardAccount(
      created.account.id,
      existingOpeningBalanceId ?? ("missing" as never)
    );
    expect(
      service.getAccountDetails({ db: db as any, accountId: created.account.id })
    ).toMatchObject({
      hasBillingProfileGap: false,
    });
  });
});

// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccountSuggestionService } from "@/features/account-suggestions";
import { saveCaptureEvidence } from "@/features/capture-evidence";
import {
  getFinancialAccountById,
  getFinancialAccountIdentifiersForAccount,
  upsertFinancialAccount,
} from "@/features/financial-accounts";
import { getTransactionById, insertTransaction } from "@/features/transactions/lib/repository";
import type {
  CaptureEvidenceId,
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedCaptureId,
  ProcessedEmailId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const NOW = "2026-04-19T10:00:00.000Z" as IsoDateTime;
const DEFAULT_ACCOUNT_ID = "fa-default-user-1" as FinancialAccountId;
const DEFAULT_SUGGESTION_TRANSACTION = {
  amount: 120000 as CopAmount,
  description: "Compra 1234",
  accountId: DEFAULT_ACCOUNT_ID,
};

type SuggestionEvidenceInput = Parameters<typeof saveCaptureEvidence>[1];

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function saveEvidenceRow(id: string, row: Partial<SuggestionEvidenceInput>) {
  saveCaptureEvidence(db as any, {
    id: id as CaptureEvidenceId,
    userId: USER_ID,
    sourceFamily: "bancolombia",
    evidenceType: "last4",
    scope: "notification:bancolombia:last4",
    value: "1234",
    transactionId: null,
    processedEmailId: null,
    processedCaptureId: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...row,
  });
}

function insertSuggestionTransactionRecord(
  id: string,
  state: "unresolved" | "confirmed",
  overrides: Partial<{
    amount: CopAmount;
    description: string;
    accountId: FinancialAccountId;
  }> = {}
) {
  insertTransaction(db as any, {
    id: id as TransactionId,
    userId: USER_ID,
    type: "expense",
    ...DEFAULT_SUGGESTION_TRANSACTION,
    ...overrides,
    categoryId: "shopping" as CategoryId,
    date: "2026-04-19" as IsoDate,
    accountAttributionState: state,
    source: "notification_android",
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  });
}

function createSuggestionService(
  overrides: Partial<Parameters<typeof createAccountSuggestionService>[0]> = {}
) {
  return createAccountSuggestionService(overrides);
}

function getFirstSuggestion(service = createSuggestionService()) {
  const suggestion = service.listSuggestions({ db: db as any, userId: USER_ID })[0];
  expect(suggestion).toBeDefined();
  return suggestion!;
}

function seedRepeatedScopedSuggestionEvidence() {
  saveEvidenceRow("ce-last4-1", {
    processedCaptureId: "pc-1" as ProcessedCaptureId,
    transactionId: "tx-1" as TransactionId,
  });
  saveEvidenceRow("ce-last4-2", {
    processedCaptureId: "pc-2" as ProcessedCaptureId,
    transactionId: "tx-2" as TransactionId,
    updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
  });
  saveEvidenceRow("ce-sender-1", {
    evidenceType: "sender_email",
    scope: "email:bancolombia:sender",
    value: "notificaciones@bancolombia.com.co",
    processedEmailId: "pe-1" as ProcessedEmailId,
  });
  saveEvidenceRow("ce-sender-2", {
    evidenceType: "sender_email",
    scope: "email:bancolombia:sender",
    value: "notificaciones@bancolombia.com.co",
    processedEmailId: "pe-2" as ProcessedEmailId,
    updatedAt: "2026-04-19T11:30:00.000Z" as IsoDateTime,
  });
}

function seedSuggestionAcceptanceScenario(linkedAccountId: FinancialAccountId) {
  upsertFinancialAccount(db as any, {
    id: linkedAccountId,
    userId: USER_ID,
    name: "Bancolombia Visa",
    kind: "credit_card",
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  });
  insertSuggestionTransactionRecord("tx-unresolved", "unresolved");
  insertSuggestionTransactionRecord("tx-confirmed", "confirmed", {
    amount: 98000 as CopAmount,
    description: "Compra confirmada 1234",
  });
  saveEvidenceRow("ce-match-1", {
    processedCaptureId: "pc-1" as ProcessedCaptureId,
    transactionId: "tx-unresolved" as TransactionId,
  });
  saveEvidenceRow("ce-match-2", {
    processedCaptureId: "pc-2" as ProcessedCaptureId,
    transactionId: "tx-confirmed" as TransactionId,
    updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
  });
}

function seedLast4RankingEvidence() {
  saveEvidenceRow("ce-last4-a-1", { processedCaptureId: "pc-1" as ProcessedCaptureId });
  saveEvidenceRow("ce-last4-a-2", {
    processedCaptureId: "pc-2" as ProcessedCaptureId,
    updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
  });
  saveEvidenceRow("ce-last4-b-1", {
    sourceFamily: "davivienda",
    scope: "notification:davivienda:last4",
    value: "9999",
    processedCaptureId: "pc-3" as ProcessedCaptureId,
  });
  saveEvidenceRow("ce-last4-b-2", {
    sourceFamily: "davivienda",
    scope: "notification:davivienda:last4",
    value: "9999",
    processedCaptureId: "pc-4" as ProcessedCaptureId,
    updatedAt: "2026-04-19T11:10:00.000Z" as IsoDateTime,
  });
}

function seedCardHintRankingEvidence() {
  saveEvidenceRow("ce-card-1", {
    sourceFamily: "apple_pay",
    evidenceType: "card_hint",
    scope: "apple_pay:card_hint",
    value: "visa platinum 1234",
    processedCaptureId: "pc-5" as ProcessedCaptureId,
  });
  saveEvidenceRow("ce-card-2", {
    sourceFamily: "apple_pay",
    evidenceType: "card_hint",
    scope: "apple_pay:card_hint",
    value: "visa platinum 1234",
    processedCaptureId: "pc-6" as ProcessedCaptureId,
    updatedAt: "2026-04-19T11:20:00.000Z" as IsoDateTime,
  });
}

function seedAliasRankingEvidence() {
  saveEvidenceRow("ce-alias-1", {
    sourceFamily: "nequi",
    evidenceType: "alias_token",
    scope: "notification:nequi:alias",
    value: "debito",
    processedCaptureId: "pc-7" as ProcessedCaptureId,
  });
  saveEvidenceRow("ce-alias-2", {
    sourceFamily: "nequi",
    evidenceType: "alias_token",
    scope: "notification:nequi:alias",
    value: "debito",
    processedCaptureId: "pc-8" as ProcessedCaptureId,
    updatedAt: "2026-04-19T11:30:00.000Z" as IsoDateTime,
  });
}

function seedSuggestionRankingEvidence() {
  seedLast4RankingEvidence();
  seedCardHintRankingEvidence();
  seedAliasRankingEvidence();
}

function seedSuggestedAccountCreationScenario() {
  insertSuggestionTransactionRecord("tx-create-account", "unresolved", {
    amount: 145000 as CopAmount,
  });
  saveEvidenceRow("ce-create-1", {
    processedCaptureId: "pc-1" as ProcessedCaptureId,
    transactionId: "tx-create-account" as TransactionId,
  });
  saveEvidenceRow("ce-create-2", {
    processedCaptureId: "pc-2" as ProcessedCaptureId,
    updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
  });
}

function expectLinkedIdentifier(accountId: FinancialAccountId) {
  expect(getFinancialAccountIdentifiersForAccount(db as any, accountId)).toEqual([
    expect.objectContaining({
      accountId,
      scope: "notification:bancolombia:last4",
      value: "1234",
    }),
  ]);
}

function expectCreatedSuggestedAccountState() {
  expect(getFinancialAccountById(db as any, "fa-created" as FinancialAccountId)).toEqual(
    expect.objectContaining({
      id: "fa-created",
      userId: USER_ID,
      name: "Bancolombia account",
      kind: "checking",
      isDefault: false,
    })
  );
  expectLinkedIdentifier("fa-created" as FinancialAccountId);
  expect(getTransactionById(db as any, "tx-create-account" as TransactionId)).toEqual(
    expect.objectContaining({
      accountId: "fa-created",
      accountAttributionState: "inferred",
      updatedAt: "2026-04-19T12:00:00.000Z",
    })
  );
}

function expectAcceptedSuggestionSideEffects(linkedAccountId: FinancialAccountId) {
  expectLinkedIdentifier(linkedAccountId);
  expect(getTransactionById(db as any, "tx-unresolved" as TransactionId)).toEqual(
    expect.objectContaining({
      accountId: linkedAccountId,
      accountAttributionState: "inferred",
      updatedAt: "2026-04-19T12:00:00.000Z",
    })
  );
  expect(getTransactionById(db as any, "tx-confirmed" as TransactionId)).toEqual(
    expect.objectContaining({
      accountId: DEFAULT_ACCOUNT_ID,
      accountAttributionState: "confirmed",
      updatedAt: NOW,
    })
  );
}

describe("account suggestion service", () => {
  it("lists repeated scoped suggestions and ignores repeated sender-only evidence", () => {
    seedRepeatedScopedSuggestionEvidence();
    const service = createSuggestionService();
    const suggestions = service.listSuggestions({ db: db as any, userId: USER_ID });

    expect(suggestions).toEqual([
      expect.objectContaining({
        scope: "notification:bancolombia:last4",
        value: "1234",
        sourceFamily: "bancolombia",
        evidenceType: "last4",
        occurrences: 2,
      }),
    ]);
  });

  it("suppresses a dismissed suggestion until stronger evidence appears", () => {
    seedRepeatedScopedSuggestionEvidence();
    const service = createSuggestionService({
      now: () => NOW,
      createDismissalId: () => "asd-1" as never,
    });
    const suggestion = getFirstSuggestion(service);

    service.dismissSuggestion({
      db: db as any,
      userId: USER_ID,
      suggestion,
    });

    expect(service.listSuggestions({ db: db as any, userId: USER_ID })).toEqual([]);

    saveEvidenceRow("ce-last4-3", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-3" as ProcessedCaptureId,
      transactionId: "tx-3" as TransactionId,
      updatedAt: "2026-04-19T12:00:00.000Z" as IsoDateTime,
    });

    expect(service.listSuggestions({ db: db as any, userId: USER_ID })).toEqual([
      expect.objectContaining({
        scope: "notification:bancolombia:last4",
        value: "1234",
        occurrences: 3,
      }),
    ]);
  });

  it("accepts a suggestion by saving an identifier and reprocessing matching unresolved transactions only", () => {
    const linkedAccountId = "fa-2" as FinancialAccountId;
    seedSuggestionAcceptanceScenario(linkedAccountId);
    const service = createSuggestionService({
      now: () => "2026-04-19T12:00:00.000Z" as IsoDateTime,
      createIdentifierId: () => "fai-1" as never,
    });
    const suggestion = getFirstSuggestion(service);

    const result = service.acceptSuggestion({
      db: db as any,
      userId: USER_ID,
      accountId: linkedAccountId,
      suggestion,
    });

    expect(result).toEqual({
      accountId: linkedAccountId,
      identifierScope: "notification:bancolombia:last4",
      identifierValue: "1234",
      reprocessedTransactionIds: ["tx-unresolved"],
    });
    expectAcceptedSuggestionSideEffects(linkedAccountId);
    expect(service.listSuggestions({ db: db as any, userId: USER_ID })).toEqual([]);
  });

  it("returns the top three strongest suggestions in stable score order", () => {
    seedSuggestionRankingEvidence();
    const service = createSuggestionService();
    const suggestions = service.listSuggestions({
      db: db as any,
      userId: USER_ID,
      limit: 3,
    });

    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((suggestion) => suggestion.scope)).toEqual([
      "notification:bancolombia:last4",
      "notification:davivienda:last4",
      "apple_pay:card_hint",
    ]);
  });

  it("creates a financial account from a suggestion and reprocesses matching unresolved transactions", () => {
    seedSuggestedAccountCreationScenario();
    const service = createSuggestionService({
      now: () => "2026-04-19T12:00:00.000Z" as IsoDateTime,
      createAccountId: () => "fa-created" as FinancialAccountId,
      createIdentifierId: () => "fai-created" as never,
    });
    const suggestion = getFirstSuggestion(service);

    const result = service.createSuggestedAccount({
      db: db as any,
      userId: USER_ID,
      suggestion,
      name: "Bancolombia account",
      kind: "checking",
    });

    expect(result).toEqual({
      accountId: "fa-created",
      identifierScope: "notification:bancolombia:last4",
      identifierValue: "1234",
      reprocessedTransactionIds: ["tx-create-account"],
    });
    expectCreatedSuggestedAccountState();
  });

  it("rolls back account creation when a later suggestion step fails", () => {
    insertTransaction(db as any, {
      id: "tx-create-account" as TransactionId,
      userId: USER_ID,
      type: "expense",
      amount: 145000 as CopAmount,
      categoryId: "shopping" as CategoryId,
      description: "Compra 1234",
      date: "2026-04-19" as IsoDate,
      accountId: "fa-default-user-1" as FinancialAccountId,
      accountAttributionState: "unresolved",
      source: "notification_android",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    saveEvidenceRow("ce-create-1", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-1" as ProcessedCaptureId,
      transactionId: "tx-create-account" as TransactionId,
    });

    saveEvidenceRow("ce-create-2", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-2" as ProcessedCaptureId,
      updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
    });

    const service = createAccountSuggestionService({
      now: () => "2026-04-19T12:00:00.000Z" as IsoDateTime,
      createAccountId: () => "fa-created" as FinancialAccountId,
      createIdentifierId: () => "fai-created" as never,
      upsertTransaction: () => {
        throw new Error("transaction write failed");
      },
    });
    const suggestion = service.listSuggestions({ db: db as any, userId: USER_ID })[0];

    expect(suggestion).toBeDefined();

    expect(() =>
      service.createSuggestedAccount({
        db: db as any,
        userId: USER_ID,
        suggestion: suggestion!,
        name: "Bancolombia account",
        kind: "checking",
      })
    ).toThrow("transaction write failed");

    expect(getFinancialAccountById(db as any, "fa-created" as FinancialAccountId)).toBeNull();
    expect(
      getFinancialAccountIdentifiersForAccount(db as any, "fa-created" as FinancialAccountId)
    ).toEqual([]);
    expect(getTransactionById(db as any, "tx-create-account" as TransactionId)).toEqual(
      expect.objectContaining({
        accountId: "fa-default-user-1",
        accountAttributionState: "unresolved",
        updatedAt: NOW,
      })
    );
  });
});

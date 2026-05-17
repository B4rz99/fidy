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
import { getTransactionById } from "@/features/transactions/lib/repository";
import { insertTransactionStorageRow as insertTransaction } from "@/infrastructure/local-ledger/transaction-storage";
import type {
  CaptureEvidenceId,
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedSourceEventId,
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
    processedSourceEventId: `${id}-source-event` as ProcessedSourceEventId,
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
    source: "email_capture",
    createdAt: NOW,
    updatedAt: NOW,
    voidedAt: null,
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
    processedSourceEventId: "pse-1" as ProcessedSourceEventId,
    transactionId: "tx-1" as TransactionId,
  });
  saveEvidenceRow("ce-last4-2", {
    processedSourceEventId: "pse-2" as ProcessedSourceEventId,
    transactionId: "tx-2" as TransactionId,
    updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
  });
  saveEvidenceRow("ce-sender-1", {
    evidenceType: "sender_email",
    scope: "email:bancolombia:sender",
    value: "notificaciones@bancolombia.com.co",
    processedSourceEventId: "pse-1" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-sender-2", {
    evidenceType: "sender_email",
    scope: "email:bancolombia:sender",
    value: "notificaciones@bancolombia.com.co",
    processedSourceEventId: "pse-2" as ProcessedSourceEventId,
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
    processedSourceEventId: "pse-1" as ProcessedSourceEventId,
    transactionId: "tx-unresolved" as TransactionId,
  });
  saveEvidenceRow("ce-match-2", {
    processedSourceEventId: "pse-2" as ProcessedSourceEventId,
    transactionId: "tx-confirmed" as TransactionId,
    updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
  });
}

function seedLast4RankingEvidence() {
  saveEvidenceRow("ce-last4-a-1", { processedSourceEventId: "pse-1" as ProcessedSourceEventId });
  saveEvidenceRow("ce-last4-a-2", {
    processedSourceEventId: "pse-2" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
  });
  saveEvidenceRow("ce-last4-b-1", {
    sourceFamily: "davivienda",
    scope: "notification:davivienda:last4",
    value: "9999",
    processedSourceEventId: "pse-3" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-last4-b-2", {
    sourceFamily: "davivienda",
    scope: "notification:davivienda:last4",
    value: "9999",
    processedSourceEventId: "pse-4" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:10:00.000Z" as IsoDateTime,
  });
}

function seedCardHintRankingEvidence() {
  saveEvidenceRow("ce-card-1", {
    sourceFamily: "apple_pay",
    evidenceType: "card_hint",
    scope: "apple_pay:card_hint",
    value: "visa platinum 1234",
    processedSourceEventId: "pse-5" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-card-2", {
    sourceFamily: "apple_pay",
    evidenceType: "card_hint",
    scope: "apple_pay:card_hint",
    value: "visa platinum 1234",
    processedSourceEventId: "pse-6" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:20:00.000Z" as IsoDateTime,
  });
}

function seedAliasRankingEvidence() {
  saveEvidenceRow("ce-alias-1", {
    sourceFamily: "nequi",
    evidenceType: "alias_token",
    scope: "notification:nequi:alias",
    value: "debito",
    processedSourceEventId: "pse-7" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-alias-2", {
    sourceFamily: "nequi",
    evidenceType: "alias_token",
    scope: "notification:nequi:alias",
    value: "debito",
    processedSourceEventId: "pse-8" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:30:00.000Z" as IsoDateTime,
  });
}

function seedSameSourceAliasAndLast4Evidence() {
  seedRepeatedScopedSuggestionEvidence();
  saveEvidenceRow("ce-alias-same-source-1", {
    evidenceType: "alias_token",
    scope: "email:bancolombia:alias",
    value: "credito",
    processedSourceEventId: "pse-alias-1" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-alias-same-source-2", {
    evidenceType: "alias_token",
    scope: "email:bancolombia:alias",
    value: "credito",
    processedSourceEventId: "pse-alias-2" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:40:00.000Z" as IsoDateTime,
  });
}

function seedLlmAccountHintEvidence() {
  saveEvidenceRow("ce-llm-hint-1", {
    evidenceType: "llm_account_hint",
    scope: "email:bancolombia:llm_account_hint",
    value: "tarjeta credito bancolombia",
    processedSourceEventId: "pse-llm-1" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-llm-hint-2", {
    evidenceType: "llm_account_hint",
    scope: "email:bancolombia:llm_account_hint",
    value: "tarjeta credito bancolombia",
    processedSourceEventId: "pse-llm-2" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:50:00.000Z" as IsoDateTime,
  });
}

function seedEquivalentLlmAccountHintEvidence() {
  saveEvidenceRow("ce-davibank-hint-1", {
    sourceFamily: "davibank",
    evidenceType: "llm_account_hint",
    scope: "email:davibank:llm_account_hint",
    value: "davibank visa oro",
    processedSourceEventId: "pse-davibank-1" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-davibank-hint-2", {
    sourceFamily: "davibank",
    evidenceType: "llm_account_hint",
    scope: "email:davibank:llm_account_hint",
    value: "davibank visa oro",
    processedSourceEventId: "pse-davibank-2" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:50:00.000Z" as IsoDateTime,
  });
  saveEvidenceRow("ce-davibank-hint-3", {
    sourceFamily: "davibank",
    evidenceType: "llm_account_hint",
    scope: "email:davibank:llm_account_hint",
    value: "tarjeta visa oro",
    processedSourceEventId: "pse-davibank-3" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:51:00.000Z" as IsoDateTime,
  });
  saveEvidenceRow("ce-davibank-hint-4", {
    sourceFamily: "davibank",
    evidenceType: "llm_account_hint",
    scope: "email:davibank:llm_account_hint",
    value: "tarjeta visa oro",
    processedSourceEventId: "pse-davibank-4" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:52:00.000Z" as IsoDateTime,
  });
}

function seedDistinctLlmAccountHintEvidence() {
  saveEvidenceRow("ce-distinct-hint-1", {
    sourceFamily: "davibank",
    evidenceType: "llm_account_hint",
    scope: "email:davibank:llm_account_hint",
    value: "tarjeta visa oro",
    processedSourceEventId: "pse-distinct-1" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-distinct-hint-2", {
    sourceFamily: "davibank",
    evidenceType: "llm_account_hint",
    scope: "email:davibank:llm_account_hint",
    value: "tarjeta visa oro",
    processedSourceEventId: "pse-distinct-2" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:50:00.000Z" as IsoDateTime,
  });
  saveEvidenceRow("ce-distinct-hint-3", {
    sourceFamily: "davibank",
    evidenceType: "llm_account_hint",
    scope: "email:davibank:llm_account_hint",
    value: "mastercard black",
    processedSourceEventId: "pse-distinct-3" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:51:00.000Z" as IsoDateTime,
  });
  saveEvidenceRow("ce-distinct-hint-4", {
    sourceFamily: "davibank",
    evidenceType: "llm_account_hint",
    scope: "email:davibank:llm_account_hint",
    value: "mastercard black",
    processedSourceEventId: "pse-distinct-4" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:52:00.000Z" as IsoDateTime,
  });
}

function seedMerchantLikeLlmAccountHintEvidence() {
  saveEvidenceRow("ce-merchant-hint-1", {
    sourceFamily: "davibank",
    evidenceType: "llm_account_hint",
    scope: "email:davibank:llm_account_hint",
    value: "rappi colombia",
    processedSourceEventId: "pse-merchant-1" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-merchant-hint-2", {
    sourceFamily: "davibank",
    evidenceType: "llm_account_hint",
    scope: "email:davibank:llm_account_hint",
    value: "rappi colombia",
    processedSourceEventId: "pse-merchant-2" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:50:00.000Z" as IsoDateTime,
  });
}

function seedCardProductHintEvidence() {
  saveEvidenceRow("ce-product-1", {
    sourceFamily: "davibank",
    evidenceType: "card_product_hint",
    scope: "email:davibank:card_product_hint",
    value: "visa oro",
    processedSourceEventId: "pse-product-1" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-product-2", {
    sourceFamily: "davibank",
    evidenceType: "card_product_hint",
    scope: "email:davibank:card_product_hint",
    value: "visa oro",
    processedSourceEventId: "pse-product-2" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:50:00.000Z" as IsoDateTime,
  });
}

function seedAccountTypeHintEvidence() {
  saveEvidenceRow("ce-type-1", {
    sourceFamily: "davibank",
    evidenceType: "account_type_hint",
    scope: "email:davibank:account_type_hint",
    value: "tarjeta de credito",
    processedSourceEventId: "pse-type-1" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-type-2", {
    sourceFamily: "davibank",
    evidenceType: "account_type_hint",
    scope: "email:davibank:account_type_hint",
    value: "tarjeta de credito",
    processedSourceEventId: "pse-type-2" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:50:00.000Z" as IsoDateTime,
  });
}

function seedCounterpartyHintEvidence() {
  saveEvidenceRow("ce-counterparty-1", {
    sourceFamily: "davibank",
    evidenceType: "counterparty_hint",
    scope: "email:davibank:counterparty_hint",
    value: "rappi colombia",
    processedSourceEventId: "pse-counterparty-1" as ProcessedSourceEventId,
  });
  saveEvidenceRow("ce-counterparty-2", {
    sourceFamily: "davibank",
    evidenceType: "counterparty_hint",
    scope: "email:davibank:counterparty_hint",
    value: "rappi colombia",
    processedSourceEventId: "pse-counterparty-2" as ProcessedSourceEventId,
    updatedAt: "2026-04-19T11:50:00.000Z" as IsoDateTime,
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
    processedSourceEventId: "pse-1" as ProcessedSourceEventId,
    transactionId: "tx-create-account" as TransactionId,
  });
  saveEvidenceRow("ce-create-2", {
    processedSourceEventId: "pse-2" as ProcessedSourceEventId,
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
      processedSourceEventId: "pse-3" as ProcessedSourceEventId,
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

  it("suppresses generic alias suggestions when the same source has card-specific evidence", () => {
    seedSameSourceAliasAndLast4Evidence();
    const service = createSuggestionService();
    const suggestions = service.listSuggestions({ db: db as any, userId: USER_ID });

    expect(suggestions.map((suggestion) => suggestion.scope)).toEqual([
      "notification:bancolombia:last4",
    ]);
  });

  it("suppresses LLM account hints when the same source has card-specific evidence", () => {
    seedRepeatedScopedSuggestionEvidence();
    seedLlmAccountHintEvidence();
    const service = createSuggestionService();
    const suggestions = service.listSuggestions({ db: db as any, userId: USER_ID });

    expect(suggestions.map((suggestion) => suggestion.scope)).toEqual([
      "notification:bancolombia:last4",
    ]);
  });

  it("lists repeated LLM account hints as account suggestions", () => {
    seedLlmAccountHintEvidence();
    const service = createSuggestionService();
    const suggestions = service.listSuggestions({ db: db as any, userId: USER_ID });

    expect(suggestions).toEqual([
      expect.objectContaining({
        scope: "email:bancolombia:llm_account_hint",
        value: "tarjeta credito bancolombia",
        sourceFamily: "bancolombia",
        evidenceType: "llm_account_hint",
        occurrences: 2,
      }),
    ]);
  });

  it("collapses equivalent same-source LLM account hint variants", () => {
    seedEquivalentLlmAccountHintEvidence();
    const service = createSuggestionService();
    const suggestions = service.listSuggestions({ db: db as any, userId: USER_ID, limit: 2 });

    expect(suggestions).toEqual([
      expect.objectContaining({
        scope: "email:davibank:llm_account_hint",
        value: "davibank visa oro",
        sourceFamily: "davibank",
        evidenceType: "llm_account_hint",
        occurrences: 4,
      }),
    ]);
  });

  it("keeps distinct same-source LLM account hint products separate", () => {
    seedDistinctLlmAccountHintEvidence();
    const service = createSuggestionService();
    const suggestions = service.listSuggestions({ db: db as any, userId: USER_ID, limit: 3 });

    expect(suggestions.map((suggestion) => suggestion.value)).toEqual([
      "mastercard black",
      "tarjeta visa oro",
    ]);
  });

  it("ignores merchant-like LLM account hints", () => {
    seedMerchantLikeLlmAccountHintEvidence();
    const service = createSuggestionService();

    expect(service.listSuggestions({ db: db as any, userId: USER_ID })).toEqual([]);
  });

  it("lists repeated card product hints as uncertain account suggestions", () => {
    seedCardProductHintEvidence();
    const service = createSuggestionService();

    expect(service.listSuggestions({ db: db as any, userId: USER_ID })).toEqual([
      expect.objectContaining({
        scope: "email:davibank:card_product_hint",
        value: "visa oro",
        sourceFamily: "davibank",
        evidenceType: "card_product_hint",
        occurrences: 2,
      }),
    ]);
  });

  it("suppresses generic account type hints when the same source has stronger product evidence", () => {
    seedCardProductHintEvidence();
    seedAccountTypeHintEvidence();
    const service = createSuggestionService();

    expect(service.listSuggestions({ db: db as any, userId: USER_ID })).toEqual([
      expect.objectContaining({
        evidenceType: "card_product_hint",
        value: "visa oro",
      }),
    ]);
  });

  it("ignores counterparty hints for account suggestions", () => {
    seedCounterpartyHintEvidence();
    const service = createSuggestionService();

    expect(service.listSuggestions({ db: db as any, userId: USER_ID })).toEqual([]);
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
      source: "email_capture",
      createdAt: NOW,
      updatedAt: NOW,
      voidedAt: null,
    });

    saveEvidenceRow("ce-create-1", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedSourceEventId: "pse-1" as ProcessedSourceEventId,
      transactionId: "tx-create-account" as TransactionId,
    });

    saveEvidenceRow("ce-create-2", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedSourceEventId: "pse-2" as ProcessedSourceEventId,
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

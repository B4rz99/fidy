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

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function saveEvidenceRow(
  id: string,
  row: {
    readonly sourceFamily: string;
    readonly evidenceType: string;
    readonly scope: string;
    readonly value: string;
    readonly processedEmailId?: string;
    readonly processedCaptureId?: string;
    readonly transactionId?: string | null;
    readonly updatedAt?: IsoDateTime;
  }
) {
  saveCaptureEvidence(db as any, {
    id: id as CaptureEvidenceId,
    userId: USER_ID,
    sourceFamily: row.sourceFamily,
    evidenceType: row.evidenceType,
    scope: row.scope,
    value: row.value,
    transactionId: (row.transactionId ?? null) as TransactionId | null,
    processedEmailId: (row.processedEmailId ?? null) as ProcessedEmailId | null,
    processedCaptureId: (row.processedCaptureId ?? null) as ProcessedCaptureId | null,
    createdAt: row.updatedAt ?? NOW,
    updatedAt: row.updatedAt ?? NOW,
    deletedAt: null,
  });
}

describe("account suggestion service", () => {
  it("lists repeated scoped suggestions and ignores repeated sender-only evidence", () => {
    saveEvidenceRow("ce-last4-1", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-1",
      transactionId: "tx-1",
    });

    saveEvidenceRow("ce-last4-2", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-2",
      transactionId: "tx-2",
      updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
    });

    saveEvidenceRow("ce-sender-1", {
      sourceFamily: "bancolombia",
      evidenceType: "sender_email",
      scope: "email:bancolombia:sender",
      value: "notificaciones@bancolombia.com.co",
      processedEmailId: "pe-1",
    });

    saveEvidenceRow("ce-sender-2", {
      sourceFamily: "bancolombia",
      evidenceType: "sender_email",
      scope: "email:bancolombia:sender",
      value: "notificaciones@bancolombia.com.co",
      processedEmailId: "pe-2",
      updatedAt: "2026-04-19T11:30:00.000Z" as IsoDateTime,
    });

    const service = createAccountSuggestionService();
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
    saveEvidenceRow("ce-last4-1", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-1",
      transactionId: "tx-1",
    });

    saveEvidenceRow("ce-last4-2", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-2",
      transactionId: "tx-2",
      updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
    });

    const service = createAccountSuggestionService({
      now: () => NOW,
      createDismissalId: () => "asd-1" as never,
    });
    const suggestion = service.listSuggestions({ db: db as any, userId: USER_ID })[0];

    expect(suggestion).toBeDefined();

    service.dismissSuggestion({
      db: db as any,
      userId: USER_ID,
      suggestion: suggestion!,
    });

    expect(service.listSuggestions({ db: db as any, userId: USER_ID })).toEqual([]);

    saveEvidenceRow("ce-last4-3", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-3",
      transactionId: "tx-3",
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

    insertTransaction(db as any, {
      id: "tx-unresolved" as TransactionId,
      userId: USER_ID,
      type: "expense",
      amount: 120000 as CopAmount,
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

    insertTransaction(db as any, {
      id: "tx-confirmed" as TransactionId,
      userId: USER_ID,
      type: "expense",
      amount: 98000 as CopAmount,
      categoryId: "shopping" as CategoryId,
      description: "Compra confirmada 1234",
      date: "2026-04-19" as IsoDate,
      accountId: "fa-default-user-1" as FinancialAccountId,
      accountAttributionState: "confirmed",
      source: "notification_android",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    saveEvidenceRow("ce-match-1", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-1",
      transactionId: "tx-unresolved",
    });

    saveEvidenceRow("ce-match-2", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-2",
      transactionId: "tx-confirmed",
      updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
    });

    const service = createAccountSuggestionService({
      now: () => "2026-04-19T12:00:00.000Z" as IsoDateTime,
      createIdentifierId: () => "fai-1" as never,
    });
    const suggestion = service.listSuggestions({ db: db as any, userId: USER_ID })[0];

    expect(suggestion).toBeDefined();

    const result = service.acceptSuggestion({
      db: db as any,
      userId: USER_ID,
      accountId: linkedAccountId,
      suggestion: suggestion!,
    });

    expect(result).toEqual({
      accountId: linkedAccountId,
      identifierScope: "notification:bancolombia:last4",
      identifierValue: "1234",
      reprocessedTransactionIds: ["tx-unresolved"],
    });

    expect(getFinancialAccountIdentifiersForAccount(db as any, linkedAccountId)).toEqual([
      expect.objectContaining({
        accountId: linkedAccountId,
        scope: "notification:bancolombia:last4",
        value: "1234",
      }),
    ]);

    expect(getTransactionById(db as any, "tx-unresolved" as TransactionId)).toEqual(
      expect.objectContaining({
        accountId: linkedAccountId,
        accountAttributionState: "inferred",
        updatedAt: "2026-04-19T12:00:00.000Z",
      })
    );

    expect(getTransactionById(db as any, "tx-confirmed" as TransactionId)).toEqual(
      expect.objectContaining({
        accountId: "fa-default-user-1",
        accountAttributionState: "confirmed",
        updatedAt: NOW,
      })
    );

    expect(service.listSuggestions({ db: db as any, userId: USER_ID })).toEqual([]);
  });

  it("returns the top three strongest suggestions in stable score order", () => {
    saveEvidenceRow("ce-last4-a-1", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-1",
    });
    saveEvidenceRow("ce-last4-a-2", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-2",
      updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
    });
    saveEvidenceRow("ce-last4-b-1", {
      sourceFamily: "davivienda",
      evidenceType: "last4",
      scope: "notification:davivienda:last4",
      value: "9999",
      processedCaptureId: "pc-3",
    });
    saveEvidenceRow("ce-last4-b-2", {
      sourceFamily: "davivienda",
      evidenceType: "last4",
      scope: "notification:davivienda:last4",
      value: "9999",
      processedCaptureId: "pc-4",
      updatedAt: "2026-04-19T11:10:00.000Z" as IsoDateTime,
    });
    saveEvidenceRow("ce-card-1", {
      sourceFamily: "apple_pay",
      evidenceType: "card_hint",
      scope: "apple_pay:card_hint",
      value: "visa platinum 1234",
      processedCaptureId: "pc-5",
    });
    saveEvidenceRow("ce-card-2", {
      sourceFamily: "apple_pay",
      evidenceType: "card_hint",
      scope: "apple_pay:card_hint",
      value: "visa platinum 1234",
      processedCaptureId: "pc-6",
      updatedAt: "2026-04-19T11:20:00.000Z" as IsoDateTime,
    });
    saveEvidenceRow("ce-alias-1", {
      sourceFamily: "nequi",
      evidenceType: "alias_token",
      scope: "notification:nequi:alias",
      value: "debito",
      processedCaptureId: "pc-7",
    });
    saveEvidenceRow("ce-alias-2", {
      sourceFamily: "nequi",
      evidenceType: "alias_token",
      scope: "notification:nequi:alias",
      value: "debito",
      processedCaptureId: "pc-8",
      updatedAt: "2026-04-19T11:30:00.000Z" as IsoDateTime,
    });

    const service = createAccountSuggestionService();
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
      processedCaptureId: "pc-1",
      transactionId: "tx-create-account",
    });

    saveEvidenceRow("ce-create-2", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-2",
      updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
    });

    const service = createAccountSuggestionService({
      now: () => "2026-04-19T12:00:00.000Z" as IsoDateTime,
      createAccountId: () => "fa-created" as FinancialAccountId,
      createIdentifierId: () => "fai-created" as never,
    });
    const suggestion = service.listSuggestions({ db: db as any, userId: USER_ID })[0];

    expect(suggestion).toBeDefined();

    const result = service.createSuggestedAccount({
      db: db as any,
      userId: USER_ID,
      suggestion: suggestion!,
      name: "Bancolombia account",
      kind: "checking",
    });

    expect(result).toEqual({
      accountId: "fa-created",
      identifierScope: "notification:bancolombia:last4",
      identifierValue: "1234",
      reprocessedTransactionIds: ["tx-create-account"],
    });

    expect(getFinancialAccountById(db as any, "fa-created" as FinancialAccountId)).toEqual(
      expect.objectContaining({
        id: "fa-created",
        userId: USER_ID,
        name: "Bancolombia account",
        kind: "checking",
        isDefault: false,
      })
    );

    expect(
      getFinancialAccountIdentifiersForAccount(db as any, "fa-created" as FinancialAccountId)
    ).toEqual([
      expect.objectContaining({
        accountId: "fa-created",
        scope: "notification:bancolombia:last4",
        value: "1234",
      }),
    ]);

    expect(getTransactionById(db as any, "tx-create-account" as TransactionId)).toEqual(
      expect.objectContaining({
        accountId: "fa-created",
        accountAttributionState: "inferred",
        updatedAt: "2026-04-19T12:00:00.000Z",
      })
    );
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
      processedCaptureId: "pc-1",
      transactionId: "tx-create-account",
    });

    saveEvidenceRow("ce-create-2", {
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      processedCaptureId: "pc-2",
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

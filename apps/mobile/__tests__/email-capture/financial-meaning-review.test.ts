// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  dismissFinancialMeaningReview,
  resolveFinancialMeaningReview,
} from "@/features/email-capture/lib/financial-meaning-review";
import {
  getNeedsReviewEmails,
  getProcessedEmailByExternalId,
  getProcessedEmailById,
  insertProcessedEmail,
} from "@/features/email-capture/lib/repository";
import {
  getQueuedSyncEntries,
  getTransactionById,
  insertTransaction,
} from "@/features/transactions/lib/repository";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
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

describe("financial meaning review", () => {
  it("marks a reviewed low-confidence email as success without deleting the linked transaction", async () => {
    insertTransaction(db as any, {
      id: "tx-1" as TransactionId,
      userId: USER_ID,
      type: "expense",
      amount: 450000 as CopAmount,
      categoryId: "shopping" as CategoryId,
      description: "Pago tarjeta de crédito",
      date: "2026-04-18" as IsoDate,
      accountId: "fa-default-user-1" as FinancialAccountId,
      accountAttributionState: "unresolved",
      source: "email_gmail",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    await insertProcessedEmail(db as any, {
      id: "pe-1" as ProcessedEmailId,
      externalId: "ext-1",
      provider: "gmail",
      status: "needs_review",
      failureReason: null,
      subject: "Bancolombia alert",
      rawBodyPreview: "Pago tarjeta",
      receivedAt: NOW,
      transactionId: "tx-1" as TransactionId,
      confidence: 0.52,
      createdAt: NOW,
      rawBody: null,
      retryCount: 0,
      nextRetryAt: null,
    });

    await resolveFinancialMeaningReview(db as any, "pe-1" as ProcessedEmailId);

    expect(await getNeedsReviewEmails(db as any)).toEqual([]);
    expect(await getProcessedEmailByExternalId(db as any, "ext-1")).toEqual(
      expect.objectContaining({
        id: "pe-1",
        status: "success",
        transactionId: "tx-1",
      })
    );
  });

  it("dismisses a low-confidence email by skipping the capture and superseding the provisional transaction", async () => {
    insertTransaction(db as any, {
      id: "tx-2" as TransactionId,
      userId: USER_ID,
      type: "expense",
      amount: 98000 as CopAmount,
      categoryId: "shopping" as CategoryId,
      description: "Cobro no rastreable",
      date: "2026-04-18" as IsoDate,
      accountId: "fa-default-user-1" as FinancialAccountId,
      accountAttributionState: "unresolved",
      source: "email_gmail",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    await insertProcessedEmail(db as any, {
      id: "pe-2" as ProcessedEmailId,
      externalId: "ext-2",
      provider: "gmail",
      status: "needs_review",
      failureReason: null,
      subject: "Unknown sender",
      rawBodyPreview: "No es gasto",
      receivedAt: NOW,
      transactionId: "tx-2" as TransactionId,
      confidence: 0.41,
      createdAt: NOW,
      rawBody: null,
      retryCount: 0,
      nextRetryAt: null,
    });

    await dismissFinancialMeaningReview(db as any, "pe-2" as ProcessedEmailId, {
      now: () => "2026-04-19T11:00:00.000Z" as IsoDateTime,
    });

    expect(await getNeedsReviewEmails(db as any)).toEqual([]);
    expect(await getProcessedEmailById(db as any, "pe-2" as ProcessedEmailId)).toEqual(
      expect.objectContaining({
        id: "pe-2",
        status: "skipped",
        transactionId: null,
      })
    );
    expect(getTransactionById(db as any, "tx-2" as TransactionId)).toEqual(
      expect.objectContaining({
        id: "tx-2",
        supersededAt: "2026-04-19T11:00:00.000Z",
        updatedAt: "2026-04-19T11:00:00.000Z",
      })
    );
    expect(getQueuedSyncEntries(db as any)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: "transactions",
          rowId: "tx-2",
          operation: "update",
          createdAt: "2026-04-19T11:00:00.000Z",
        }),
      ])
    );
  });
});

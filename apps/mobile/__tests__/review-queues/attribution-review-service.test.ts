// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveCaptureEvidence } from "@/features/capture-evidence/lib/repository";
import { upsertFinancialAccount } from "@/features/financial-accounts";
import { createAttributionReviewService } from "@/features/review-queues/lib/attribution-review-service";
import { getTransactionById, insertTransaction } from "@/features/transactions/lib/repository";
import type {
  CaptureEvidenceId,
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedCaptureId,
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

function saveEvidence(
  id: string,
  {
    transactionId,
    value,
    processedCaptureId,
    updatedAt = NOW,
  }: {
    readonly transactionId: string | null;
    readonly value: string;
    readonly processedCaptureId: string;
    readonly updatedAt?: IsoDateTime;
  }
) {
  saveCaptureEvidence(db as any, {
    id: id as CaptureEvidenceId,
    userId: USER_ID,
    sourceFamily: "davivienda",
    evidenceType: "last4",
    scope: "notification:davivienda:last4",
    value,
    transactionId: transactionId as TransactionId | null,
    transferId: null,
    processedEmailId: null,
    processedCaptureId: processedCaptureId as ProcessedCaptureId,
    createdAt: updatedAt,
    updatedAt,
    deletedAt: null,
  });
}

describe("attribution review service", () => {
  it("lists unresolved transactions with a suggested account and confirms the reviewed owner", () => {
    upsertFinancialAccount(db as any, {
      id: "fa-default-user-1" as FinancialAccountId,
      userId: USER_ID,
      name: "Main account",
      kind: "checking",
      isDefault: true,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    upsertFinancialAccount(db as any, {
      id: "fa-davivienda" as FinancialAccountId,
      userId: USER_ID,
      name: "Davivienda Visa",
      kind: "credit_card",
      isDefault: false,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    insertTransaction(db as any, {
      id: "tx-reviewed" as TransactionId,
      userId: USER_ID,
      type: "expense",
      amount: 85000 as CopAmount,
      categoryId: "shopping" as CategoryId,
      description: "Rappi Supermai",
      date: "2026-03-03" as IsoDate,
      accountId: "fa-default-user-1" as FinancialAccountId,
      accountAttributionState: "unresolved",
      source: "notification_android",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    insertTransaction(db as any, {
      id: "tx-related" as TransactionId,
      userId: USER_ID,
      type: "expense",
      amount: 120000 as CopAmount,
      categoryId: "shopping" as CategoryId,
      description: "Otro cobro",
      date: "2026-03-04" as IsoDate,
      accountId: "fa-default-user-1" as FinancialAccountId,
      accountAttributionState: "unresolved",
      source: "notification_android",
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    saveEvidence("ce-reviewed", {
      transactionId: "tx-reviewed",
      value: "4931",
      processedCaptureId: "pc-1",
    });
    saveEvidence("ce-related", {
      transactionId: "tx-related",
      value: "4931",
      processedCaptureId: "pc-2",
      updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
    });

    const service = createAttributionReviewService({
      now: () => "2026-04-19T12:00:00.000Z" as IsoDateTime,
    });

    const items = service.listQueueItems({ db: db as any, userId: USER_ID });

    expect(items).toEqual([
      expect.objectContaining({
        transaction: expect.objectContaining({ id: "tx-related" }),
        currentAccount: expect.objectContaining({ id: "fa-default-user-1" }),
        suggestedAccount: expect.objectContaining({ id: "fa-davivienda" }),
        suggestion: expect.objectContaining({
          scope: "notification:davivienda:last4",
          value: "4931",
        }),
      }),
      expect.objectContaining({
        transaction: expect.objectContaining({ id: "tx-reviewed" }),
        suggestedAccount: expect.objectContaining({ id: "fa-davivienda" }),
      }),
    ]);

    const result = service.confirmSuggestedOwner({
      db: db as any,
      userId: USER_ID,
      transactionId: "tx-reviewed" as TransactionId,
    });

    expect(result).toEqual({
      success: true,
      accountId: "fa-davivienda",
      suggestionFingerprint: JSON.stringify(["notification:davivienda:last4", "4931"]),
    });

    expect(getTransactionById(db as any, "tx-reviewed" as TransactionId)).toEqual(
      expect.objectContaining({
        accountId: "fa-davivienda",
        accountAttributionState: "confirmed",
        updatedAt: "2026-04-19T12:00:00.000Z",
      })
    );

    expect(getTransactionById(db as any, "tx-related" as TransactionId)).toEqual(
      expect.objectContaining({
        accountId: "fa-davivienda",
        accountAttributionState: "inferred",
        updatedAt: "2026-04-19T12:00:00.000Z",
      })
    );
  });
});

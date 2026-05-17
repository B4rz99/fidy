// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveCaptureEvidence } from "@/features/capture-evidence/lib/repository";
import { upsertFinancialAccount } from "@/features/financial-accounts";
import { createAttributionReviewService } from "@/features/review-queues/lib/attribution-review-service";
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

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

type SavedEvidenceInput = {
  readonly transactionId: string | null;
  readonly value: string;
  readonly processedSourceEventId: string;
  readonly updatedAt?: IsoDateTime;
};

type AccountInput = {
  readonly id: FinancialAccountId;
  readonly name: string;
  readonly kind: "checking" | "credit_card";
  readonly isDefault: boolean;
};

type ReviewTransactionInput = {
  readonly id: TransactionId;
  readonly amount: CopAmount;
  readonly description: string;
  readonly date: IsoDate;
  readonly accountId?: FinancialAccountId;
};

const attributionAccounts = [
  {
    id: "fa-default-user-1" as FinancialAccountId,
    name: "Main account",
    kind: "checking" as const,
    isDefault: true,
  },
  {
    id: "fa-davivienda" as FinancialAccountId,
    name: "Davivienda Visa",
    kind: "credit_card" as const,
    isDefault: false,
  },
];

const attributionTransactions = [
  {
    id: "tx-reviewed" as TransactionId,
    amount: 85000 as CopAmount,
    description: "Rappi Supermai",
    date: "2026-03-03" as IsoDate,
  },
  {
    id: "tx-related" as TransactionId,
    amount: 120000 as CopAmount,
    description: "Otro cobro",
    date: "2026-03-04" as IsoDate,
  },
];

const attributionEvidence = [
  {
    id: "ce-reviewed",
    transactionId: "tx-reviewed",
    value: "4931",
    processedSourceEventId: "pse-1",
  },
  {
    id: "ce-related",
    transactionId: "tx-related",
    value: "4931",
    processedSourceEventId: "pse-2",
    updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
  },
];

function insertAccount(input: AccountInput) {
  upsertFinancialAccount(db as any, {
    id: input.id,
    userId: USER_ID,
    name: input.name,
    kind: input.kind,
    isDefault: input.isDefault,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  });
}

function insertReviewTransaction(input: ReviewTransactionInput) {
  insertTransaction(db as any, {
    id: input.id,
    userId: USER_ID,
    type: "expense",
    amount: input.amount,
    categoryId: "shopping" as CategoryId,
    description: input.description,
    date: input.date,
    accountId: input.accountId ?? ("fa-default-user-1" as FinancialAccountId),
    accountAttributionState: "unresolved",
    source: "email_capture",
    createdAt: NOW,
    updatedAt: NOW,
    voidedAt: null,
  });
}

function saveEvidence(id: string, input: SavedEvidenceInput) {
  saveCaptureEvidence(db as any, {
    id: id as CaptureEvidenceId,
    userId: USER_ID,
    sourceFamily: "davivienda",
    evidenceType: "last4",
    scope: "notification:davivienda:last4",
    value: input.value,
    transactionId: input.transactionId as TransactionId | null,
    transferId: null,
    processedSourceEventId: input.processedSourceEventId as ProcessedSourceEventId,
    createdAt: input.updatedAt ?? NOW,
    updatedAt: input.updatedAt ?? NOW,
    deletedAt: null,
  });
}

describe("attribution review service", () => {
  it("lists unresolved transactions with a suggested account and confirms the reviewed owner", () => {
    attributionAccounts.forEach(insertAccount);
    attributionTransactions.forEach(insertReviewTransaction);
    attributionEvidence.forEach((row) => {
      saveEvidence(row.id, row);
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

  it("returns failure without accepting the suggestion when the reviewed transaction disappears", () => {
    attributionAccounts.forEach(insertAccount);
    attributionTransactions.forEach(insertReviewTransaction);
    attributionEvidence.forEach((row) => {
      saveEvidence(row.id, row);
    });

    const service = createAttributionReviewService({
      now: () => "2026-04-19T12:00:00.000Z" as IsoDateTime,
      getTransactionById: () => null,
    });

    const result = service.confirmSuggestedOwner({
      db: db as any,
      userId: USER_ID,
      transactionId: "tx-reviewed" as TransactionId,
    });

    expect(result).toEqual({
      success: false,
      error: "reviewItemNotFound",
    });

    expect(getTransactionById(db as any, "tx-related" as TransactionId)).toEqual(
      expect.objectContaining({
        accountId: "fa-default-user-1",
        accountAttributionState: "unresolved",
        updatedAt: NOW,
      })
    );
  });

  it("lists unresolved transactions without evidence as unsuggested review items", () => {
    insertReviewTransaction({
      id: "tx-unsuggested" as TransactionId,
      amount: 50000 as CopAmount,
      description: "Unknown merchant",
      date: "2026-03-05" as IsoDate,
      accountId: "fa-missing" as FinancialAccountId,
    });

    const service = createAttributionReviewService();

    expect(service.listQueueItems({ db: db as any, userId: USER_ID })).toEqual([
      expect.objectContaining({
        transaction: expect.objectContaining({ id: "tx-unsuggested" }),
        currentAccount: null,
        suggestedAccount: null,
        suggestion: null,
        evidenceLabel: null,
      }),
    ]);
    expect(
      service.confirmSuggestedOwner({
        db: db as any,
        userId: USER_ID,
        transactionId: "tx-unsuggested" as TransactionId,
      })
    ).toEqual({ success: false, error: "suggestedOwnerUnavailable" });
  });

  it("returns review item lookups by transaction id", () => {
    attributionAccounts.forEach(insertAccount);
    insertReviewTransaction({
      id: "tx-reviewed" as TransactionId,
      amount: 85000 as CopAmount,
      description: "Rappi Supermai",
      date: "2026-03-03" as IsoDate,
    });
    saveEvidence("ce-reviewed", {
      transactionId: "tx-reviewed",
      value: "4931",
      processedSourceEventId: "pse-1",
    });

    const service = createAttributionReviewService();

    expect(
      service.getReviewItem({
        db: db as any,
        userId: USER_ID,
        transactionId: "tx-reviewed" as TransactionId,
      })
    ).toEqual(
      expect.objectContaining({ transaction: expect.objectContaining({ id: "tx-reviewed" }) })
    );
    expect(
      service.getReviewItem({
        db: db as any,
        userId: USER_ID,
        transactionId: "tx-missing" as TransactionId,
      })
    ).toBeNull();
    expect(
      service.confirmSuggestedOwner({
        db: db as any,
        userId: USER_ID,
        transactionId: "tx-missing" as TransactionId,
      })
    ).toEqual({ success: false, error: "reviewItemNotFound" });
  });
});

// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getCaptureEvidenceById,
  saveCaptureEvidence,
} from "@/features/capture-evidence/lib/repository";
import {
  getBalanceAggregate,
  getSpendingByCategoryAggregate,
  getTransactionById,
} from "@/features/transactions/lib/repository";
import { insertTransactionStorageRow as insertTransaction } from "@/infrastructure/local-ledger/transaction-storage";
import { markTransactionSuperseded } from "@/features/transactions/transfer-reclassification.public";
import { reclassifyTransactionAsTransfer } from "@/features/transfers/lib/reclassify-transaction-as-transfer";
import { reclassifyTransactionsAsTransfer } from "@/features/transfers/lib/reclassify-transactions-as-transfer";
import { getTransferById } from "@/features/transfers/lib/repository";
import { financialAccounts, processedSourceEvents, reviewCandidates } from "@/shared/db/schema";
import type {
  CaptureEvidenceId,
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedSourceEventId,
  ReviewCandidateId,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const ORIGINAL_TRANSACTION_ID = "tx-1" as TransactionId;
const INCOMING_TRANSACTION_ID = "tx-2" as TransactionId;
const TRANSFER_ID = "tr-1" as TransferId;
const ACCOUNT_ID = "fa-1" as FinancialAccountId;
const SAVINGS_ACCOUNT_ID = "fa-2" as FinancialAccountId;
const NOW = "2026-04-19T14:00:00.000Z" as IsoDateTime;
const ORIGINAL_CREATED_AT = "2026-04-18T12:00:00.000Z" as IsoDateTime;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function insertFinancialAccount(
  id: FinancialAccountId,
  overrides: {
    readonly userId?: UserId;
    readonly deletedAt?: IsoDateTime | null;
  } = {}
) {
  db.insert(financialAccounts)
    .values({
      id,
      userId: overrides.userId ?? USER_ID,
      name: id,
      kind: "checking",
      isDefault: false,
      createdAt: ORIGINAL_CREATED_AT,
      updatedAt: ORIGINAL_CREATED_AT,
      deletedAt: overrides.deletedAt ?? null,
    })
    .run();
}

function insertOriginalTransactionRecord() {
  insertTransaction(db as any, {
    id: ORIGINAL_TRANSACTION_ID,
    userId: USER_ID,
    type: "expense",
    amount: 350000 as CopAmount,
    categoryId: "shopping" as CategoryId,
    description: "Transfer to savings",
    date: "2026-04-18" as IsoDate,
    accountId: ACCOUNT_ID,
    accountAttributionState: "confirmed",
    createdAt: ORIGINAL_CREATED_AT,
    updatedAt: ORIGINAL_CREATED_AT,
    voidedAt: null,
    supersededAt: null,
    source: "email_capture",
  });
}

function insertIncomingTransactionRecord() {
  insertTransaction(db as any, {
    id: INCOMING_TRANSACTION_ID,
    userId: USER_ID,
    type: "income",
    amount: 350000 as CopAmount,
    categoryId: "income" as CategoryId,
    description: "Transfer from checking",
    date: "2026-04-18" as IsoDate,
    accountId: SAVINGS_ACCOUNT_ID,
    accountAttributionState: "confirmed",
    createdAt: ORIGINAL_CREATED_AT,
    updatedAt: ORIGINAL_CREATED_AT,
    voidedAt: null,
    supersededAt: null,
    source: "email_capture",
  });
}

function insertReclassificationAccounts() {
  insertFinancialAccount(ACCOUNT_ID);
  insertFinancialAccount(SAVINGS_ACCOUNT_ID);
}

function insertTransferEvidence() {
  saveCaptureEvidence(db as any, {
    id: "ce-1" as CaptureEvidenceId,
    userId: USER_ID,
    sourceFamily: "bancolombia",
    evidenceType: "subject",
    scope: "email:subject",
    value: "transfer to savings",
    transactionId: ORIGINAL_TRANSACTION_ID,
    transferId: null,
    processedSourceEventId: "pse-1" as ProcessedSourceEventId,
    createdAt: ORIGINAL_CREATED_AT,
    updatedAt: ORIGINAL_CREATED_AT,
    deletedAt: null,
  });
}

function insertPendingProcessedSourceEvent() {
  db.insert(processedSourceEvents)
    .values({
      id: "pse-1" as ProcessedSourceEventId,
      userId: USER_ID,
      sourceFamily: "email",
      sourceId: "email_gmail",
      sourceEventId: "ext-1",
      status: "needs_review",
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      transactionId: ORIGINAL_TRANSACTION_ID,
      confidence: 0.52,
      receivedAt: ORIGINAL_CREATED_AT,
      processedAt: ORIGINAL_CREATED_AT,
      createdAt: ORIGINAL_CREATED_AT,
      updatedAt: ORIGINAL_CREATED_AT,
      deletedAt: null,
    })
    .run();

  db.insert(reviewCandidates)
    .values({
      id: "rc-1" as ReviewCandidateId,
      userId: USER_ID,
      processedSourceEventId: "pse-1" as ProcessedSourceEventId,
      status: "pending",
      candidateKind: "transaction",
      amount: 350000 as CopAmount,
      currency: "COP",
      occurredAt: "2026-04-18" as IsoDate,
      description: "Transfer to savings",
      categoryId: null,
      transactionType: "expense",
      confidence: 0.52,
      createdAt: ORIGINAL_CREATED_AT,
      updatedAt: ORIGINAL_CREATED_AT,
      deletedAt: null,
    })
    .run();
}

function seedReclassificationScenario() {
  insertOriginalTransactionRecord();
  insertTransferEvidence();
  insertPendingProcessedSourceEvent();
}

function runReclassification() {
  return reclassifyTransactionAsTransfer(
    db as any,
    {
      userId: USER_ID,
      transactionId: ORIGINAL_TRANSACTION_ID,
      digits: "350000",
      fromSide: { kind: "account", accountId: ACCOUNT_ID },
      toSide: { kind: "account", accountId: SAVINGS_ACCOUNT_ID },
      description: "Move to savings",
      date: new Date("2026-04-18T12:00:00.000Z"),
      processedSourceEventId: "pse-1" as ProcessedSourceEventId,
      reviewCandidateId: "rc-1" as ReviewCandidateId,
    },
    {
      now: () => new Date(NOW),
      createId: () => TRANSFER_ID,
    }
  );
}

function runReclassificationWithoutReviewCandidate() {
  return reclassifyTransactionAsTransfer(
    db as any,
    {
      userId: USER_ID,
      transactionId: ORIGINAL_TRANSACTION_ID,
      digits: "350000",
      fromSide: { kind: "account", accountId: ACCOUNT_ID },
      toSide: { kind: "account", accountId: SAVINGS_ACCOUNT_ID },
      description: "Move to savings",
      date: new Date("2026-04-18T12:00:00.000Z"),
      processedSourceEventId: "pse-1" as ProcessedSourceEventId,
    },
    {
      now: () => new Date(NOW),
      createId: () => TRANSFER_ID,
    }
  );
}

function expectCreatedTransferState() {
  expect(getTransferById(db as any, TRANSFER_ID)).toMatchObject({
    id: TRANSFER_ID,
    userId: USER_ID,
    amount: 350000,
    fromAccountId: ACCOUNT_ID,
    toAccountId: SAVINGS_ACCOUNT_ID,
    description: "Move to savings",
    date: "2026-04-18",
    source: "capture-match",
  });
  expect(getTransactionById(db as any, ORIGINAL_TRANSACTION_ID)).toMatchObject({
    id: ORIGINAL_TRANSACTION_ID,
    supersededAt: NOW,
    voidedAt: null,
    updatedAt: NOW,
  });
  expect(getCaptureEvidenceById(db as any, "ce-1" as CaptureEvidenceId)).toMatchObject({
    id: "ce-1",
    transactionId: null,
    transferId: TRANSFER_ID,
    updatedAt: NOW,
  });
}

function expectProcessedSourceEventSucceeded() {
  expect(
    db
      .select()
      .from(processedSourceEvents)
      .where(eq(processedSourceEvents.id, "pse-1" as ProcessedSourceEventId))
      .get()
  ).toEqual(
    expect.objectContaining({
      id: "pse-1",
      status: "processed",
      transactionId: ORIGINAL_TRANSACTION_ID,
      updatedAt: NOW,
    })
  );
  expect(
    db
      .select()
      .from(reviewCandidates)
      .where(eq(reviewCandidates.id, "rc-1" as ReviewCandidateId))
      .get()
  ).toEqual(
    expect.objectContaining({
      id: "rc-1",
      status: "rejected",
      updatedAt: NOW,
    })
  );
}

function expectProcessedSourceEventPending() {
  expect(
    db
      .select()
      .from(processedSourceEvents)
      .where(eq(processedSourceEvents.id, "pse-1" as ProcessedSourceEventId))
      .get()
  ).toEqual(
    expect.objectContaining({
      id: "pse-1",
      status: "needs_review",
      transactionId: ORIGINAL_TRANSACTION_ID,
      updatedAt: ORIGINAL_CREATED_AT,
    })
  );
  expect(
    db
      .select()
      .from(reviewCandidates)
      .where(eq(reviewCandidates.id, "rc-1" as ReviewCandidateId))
      .get()
  ).toEqual(
    expect.objectContaining({
      id: "rc-1",
      status: "pending",
      updatedAt: ORIGINAL_CREATED_AT,
    })
  );
}

describe("reclassifyTransactionAsTransfer", () => {
  it("creates a transfer, supersedes the original transaction, relinks capture evidence,", async () => {
    seedReclassificationScenario();
    const result = runReclassification();

    expect(result).toEqual({
      success: true,
      transfer: expect.objectContaining({
        id: TRANSFER_ID,
        amount: 350000,
        source: "capture-match",
      }),
    });
    expectCreatedTransferState();
    expectProcessedSourceEventSucceeded();
  });

  it("rejects source-event transfer reclassification without a review candidate", async () => {
    seedReclassificationScenario();
    const result = runReclassificationWithoutReviewCandidate();

    expect(result).toEqual({ success: false, error: "reviewCandidateRequired" });
    expect(getTransferById(db as any, TRANSFER_ID)).toBeNull();
    expect(getTransactionById(db as any, ORIGINAL_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
      updatedAt: ORIGINAL_CREATED_AT,
    });
    expectProcessedSourceEventPending();
  });
});

describe("reclassifyTransactionsAsTransfer", () => {
  it("creates one transfer and supersedes the matching outgoing and incoming transactions", async () => {
    insertReclassificationAccounts();
    insertOriginalTransactionRecord();
    insertIncomingTransactionRecord();

    const result = await reclassifyTransactionsAsTransfer(
      db as any,
      {
        userId: USER_ID,
        outgoingTransactionId: ORIGINAL_TRANSACTION_ID,
        incomingTransactionId: INCOMING_TRANSACTION_ID,
        description: "Move to savings",
      },
      {
        now: () => new Date(NOW),
        createId: () => TRANSFER_ID,
      }
    );

    expect(result).toEqual({
      success: true,
      transfer: expect.objectContaining({
        id: TRANSFER_ID,
        amount: 350000,
      }),
    });
    expect(getTransferById(db as any, TRANSFER_ID)).toMatchObject({
      id: TRANSFER_ID,
      userId: USER_ID,
      amount: 350000,
      fromAccountId: ACCOUNT_ID,
      toAccountId: SAVINGS_ACCOUNT_ID,
      description: "Move to savings",
      date: "2026-04-18",
      source: "capture-match",
    });
    expect(getTransactionById(db as any, ORIGINAL_TRANSACTION_ID)).toMatchObject({
      supersededAt: NOW,
      supersededByTransferId: TRANSFER_ID,
      voidedAt: null,
      updatedAt: NOW,
    });
    expect(getTransactionById(db as any, INCOMING_TRANSACTION_ID)).toMatchObject({
      supersededAt: NOW,
      supersededByTransferId: TRANSFER_ID,
      voidedAt: null,
      updatedAt: NOW,
    });
    expect(getBalanceAggregate(db as any, USER_ID)).toBe(0);
    expect(getSpendingByCategoryAggregate(db as any, USER_ID, "2026-04" as any)).toEqual([]);
  });

  it("rolls back the transfer and supersession links when the atomic commit fails", async () => {
    insertReclassificationAccounts();
    insertOriginalTransactionRecord();
    insertIncomingTransactionRecord();

    await expect(
      reclassifyTransactionsAsTransfer(
        db as any,
        {
          userId: USER_ID,
          outgoingTransactionId: ORIGINAL_TRANSACTION_ID,
          incomingTransactionId: INCOMING_TRANSACTION_ID,
          description: "Move to savings",
        },
        {
          now: () => new Date(NOW),
          createId: () => TRANSFER_ID,
          saveTransactionRow: (tx, input) => {
            if (input.id === INCOMING_TRANSACTION_ID) {
              throw new Error("failed to supersede incoming transaction");
            }
            return markTransactionSuperseded(tx, input);
          },
        }
      )
    ).rejects.toThrow("failed to supersede incoming transaction");

    expect(getTransferById(db as any, TRANSFER_ID)).toBeNull();
    expect(getTransactionById(db as any, ORIGINAL_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
      updatedAt: ORIGINAL_CREATED_AT,
    });
    expect(getTransactionById(db as any, INCOMING_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
      updatedAt: ORIGINAL_CREATED_AT,
    });
  });

  it("rolls back when a supersession writer silently skips one source transaction", async () => {
    insertReclassificationAccounts();
    insertOriginalTransactionRecord();
    insertIncomingTransactionRecord();

    await expect(
      reclassifyTransactionsAsTransfer(
        db as any,
        {
          userId: USER_ID,
          outgoingTransactionId: ORIGINAL_TRANSACTION_ID,
          incomingTransactionId: INCOMING_TRANSACTION_ID,
          description: "Move to savings",
        },
        {
          now: () => new Date(NOW),
          createId: () => TRANSFER_ID,
          saveTransactionRow: (tx, input) => {
            if (input.id === INCOMING_TRANSACTION_ID) return;
            return markTransactionSuperseded(tx, input);
          },
        }
      )
    ).rejects.toThrow("transfer reclassification did not supersede both source transactions");

    expect(getTransferById(db as any, TRANSFER_ID)).toBeNull();
    expect(getTransactionById(db as any, ORIGINAL_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
      updatedAt: ORIGINAL_CREATED_AT,
    });
    expect(getTransactionById(db as any, INCOMING_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
      updatedAt: ORIGINAL_CREATED_AT,
    });
  });

  it("rejects transactions that do not both belong to the user", async () => {
    insertOriginalTransactionRecord();
    insertTransaction(db as any, {
      id: INCOMING_TRANSACTION_ID,
      userId: "other-user" as UserId,
      type: "income",
      amount: 350000 as CopAmount,
      categoryId: "income" as CategoryId,
      description: "Transfer from checking",
      date: "2026-04-18" as IsoDate,
      accountId: SAVINGS_ACCOUNT_ID,
      accountAttributionState: "confirmed",
      createdAt: ORIGINAL_CREATED_AT,
      updatedAt: ORIGINAL_CREATED_AT,
      voidedAt: null,
      supersededAt: null,
      source: "email_capture",
    });

    const result = await reclassifyTransactionsAsTransfer(
      db as any,
      {
        userId: USER_ID,
        outgoingTransactionId: ORIGINAL_TRANSACTION_ID,
        incomingTransactionId: INCOMING_TRANSACTION_ID,
        description: "Move to savings",
      },
      {
        now: () => new Date(NOW),
        createId: () => TRANSFER_ID,
      }
    );

    expect(result).toEqual({ success: false, error: "transactionsNotFound" });
    expect(getTransferById(db as any, TRANSFER_ID)).toBeNull();
    expect(getTransactionById(db as any, ORIGINAL_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
    });
    expect(getTransactionById(db as any, INCOMING_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
    });
  });

  it("rejects same-amount transactions from different dates", async () => {
    insertReclassificationAccounts();
    insertOriginalTransactionRecord();
    insertIncomingTransactionRecord();
    insertTransaction(db as any, {
      id: "tx-3" as TransactionId,
      userId: USER_ID,
      type: "income",
      amount: 350000 as CopAmount,
      categoryId: "income" as CategoryId,
      description: "Transfer from checking",
      date: "2026-04-19" as IsoDate,
      accountId: SAVINGS_ACCOUNT_ID,
      accountAttributionState: "confirmed",
      createdAt: ORIGINAL_CREATED_AT,
      updatedAt: ORIGINAL_CREATED_AT,
      voidedAt: null,
      supersededAt: null,
      source: "email_capture",
    });

    const result = await reclassifyTransactionsAsTransfer(
      db as any,
      {
        userId: USER_ID,
        outgoingTransactionId: ORIGINAL_TRANSACTION_ID,
        incomingTransactionId: "tx-3" as TransactionId,
        description: "Move to savings",
      },
      {
        now: () => new Date(NOW),
        createId: () => TRANSFER_ID,
      }
    );

    expect(result).toEqual({ success: false, error: "transactionsNotReclassifiable" });
    expect(getTransferById(db as any, TRANSFER_ID)).toBeNull();
    expect(getTransactionById(db as any, ORIGINAL_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
    });
    expect(getTransactionById(db as any, "tx-3" as TransactionId)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
    });
  });

  it("rejects transactions with unresolved account attribution", async () => {
    insertReclassificationAccounts();
    insertOriginalTransactionRecord();
    insertTransaction(db as any, {
      id: INCOMING_TRANSACTION_ID,
      userId: USER_ID,
      type: "income",
      amount: 350000 as CopAmount,
      categoryId: "income" as CategoryId,
      description: "Transfer from checking",
      date: "2026-04-18" as IsoDate,
      accountId: SAVINGS_ACCOUNT_ID,
      accountAttributionState: "unresolved",
      createdAt: ORIGINAL_CREATED_AT,
      updatedAt: ORIGINAL_CREATED_AT,
      voidedAt: null,
      supersededAt: null,
      source: "email_capture",
    });

    const result = await reclassifyTransactionsAsTransfer(
      db as any,
      {
        userId: USER_ID,
        outgoingTransactionId: ORIGINAL_TRANSACTION_ID,
        incomingTransactionId: INCOMING_TRANSACTION_ID,
        description: "Move to savings",
      },
      {
        now: () => new Date(NOW),
        createId: () => TRANSFER_ID,
      }
    );

    expect(result).toEqual({ success: false, error: "transactionsNotReclassifiable" });
    expect(getTransferById(db as any, TRANSFER_ID)).toBeNull();
    expect(getTransactionById(db as any, ORIGINAL_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
    });
    expect(getTransactionById(db as any, INCOMING_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
    });
  });

  it("rejects transactions whose accounts are not active accounts for the user", async () => {
    insertFinancialAccount(ACCOUNT_ID);
    insertFinancialAccount(SAVINGS_ACCOUNT_ID, { userId: "other-user" as UserId });
    insertOriginalTransactionRecord();
    insertIncomingTransactionRecord();

    const result = await reclassifyTransactionsAsTransfer(
      db as any,
      {
        userId: USER_ID,
        outgoingTransactionId: ORIGINAL_TRANSACTION_ID,
        incomingTransactionId: INCOMING_TRANSACTION_ID,
        description: "Move to savings",
      },
      {
        now: () => new Date(NOW),
        createId: () => TRANSFER_ID,
      }
    );

    expect(result).toEqual({ success: false, error: "transactionsNotReclassifiable" });
    expect(getTransferById(db as any, TRANSFER_ID)).toBeNull();
    expect(getTransactionById(db as any, ORIGINAL_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
    });
    expect(getTransactionById(db as any, INCOMING_TRANSACTION_ID)).toMatchObject({
      supersededAt: null,
      supersededByTransferId: null,
    });
  });
});

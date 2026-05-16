// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  confirmSourceEventFinancialMeaningReview,
  dismissSourceEventFinancialMeaningReview,
  dismissFinancialMeaningReview,
  getFinancialMeaningReviewItems,
  resolveFinancialMeaningReview,
} from "@/features/email-capture/lib/financial-meaning-review";
import {
  getNeedsReviewEmails,
  getNeedsReviewEmailSourceEvents,
  getProcessedEmailByExternalId,
  getProcessedEmailById,
  insertProcessedEmail,
} from "@/features/email-capture/lib/repository";
import { getTransactionById, insertTransaction } from "@/features/transactions/lib/repository";
import { processedSourceEvents, reviewCandidates } from "@/shared/db/schema";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedEmailId,
  ProcessedSourceEventId,
  ReviewCandidateId,
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

type EmailTransactionOverrides = Partial<{
  id: TransactionId;
  amount: CopAmount;
  description: string;
  date: IsoDate;
  updatedAt: IsoDateTime;
  supersededAt: IsoDateTime | null;
}>;

type NeedsReviewEmailOverrides = Partial<{
  id: ProcessedEmailId;
  externalId: string;
  subject: string;
  rawBodyPreview: string;
  transactionId: TransactionId | null;
  confidence: number;
}>;

type NeedsReviewSourceEventOverrides = Partial<typeof processedSourceEvents.$inferInsert>;
type ReviewCandidateOverrides = Partial<typeof reviewCandidates.$inferInsert>;

const defaultEmailTransaction = {
  id: "tx-1" as TransactionId,
  userId: USER_ID,
  type: "expense" as const,
  amount: 450000 as CopAmount,
  categoryId: "shopping" as CategoryId,
  description: "Pago tarjeta de crédito",
  date: "2026-04-18" as IsoDate,
  accountId: "fa-default-user-1" as FinancialAccountId,
  accountAttributionState: "unresolved",
  source: "email_gmail" as const,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

const defaultNeedsReviewEmail = {
  id: "pe-1" as ProcessedEmailId,
  externalId: "ext-1",
  provider: "gmail" as const,
  status: "needs_review" as const,
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
};

const reviewCandidateTransactions = [
  {
    id: "tx-active" as TransactionId,
    amount: 120000 as CopAmount,
    description: "Active charge",
  },
  {
    id: "tx-inactive" as TransactionId,
    amount: 80000 as CopAmount,
    description: "Superseded charge",
    supersededAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
  },
];

const reviewCandidateEmails = [
  {
    id: "pe-active" as ProcessedEmailId,
    externalId: "ext-active",
    subject: "Active review",
    rawBodyPreview: "Still relevant",
    transactionId: "tx-active" as TransactionId,
    confidence: 0.42,
  },
  {
    id: "pe-missing" as ProcessedEmailId,
    externalId: "ext-missing",
    subject: "Missing tx",
    rawBodyPreview: "No transaction",
    transactionId: "tx-missing" as TransactionId,
    confidence: 0.42,
  },
  {
    id: "pe-unlinked" as ProcessedEmailId,
    externalId: "ext-unlinked",
    subject: "No link",
    rawBodyPreview: "No linked tx",
    transactionId: null,
    confidence: 0.42,
  },
  {
    id: "pe-inactive" as ProcessedEmailId,
    externalId: "ext-inactive",
    subject: "Inactive tx",
    rawBodyPreview: "Superseded",
    transactionId: "tx-inactive" as TransactionId,
    confidence: 0.42,
  },
];

function insertEmailTransactionRow(overrides: EmailTransactionOverrides = {}) {
  insertTransaction(db as any, {
    ...defaultEmailTransaction,
    ...overrides,
    ...(overrides.supersededAt == null ? {} : { supersededAt: overrides.supersededAt }),
  });
}

async function insertNeedsReviewEmail(overrides: NeedsReviewEmailOverrides = {}) {
  await insertProcessedEmail(db as any, {
    ...defaultNeedsReviewEmail,
    ...overrides,
  });
}

function insertNeedsReviewSourceEvent(overrides: NeedsReviewSourceEventOverrides = {}) {
  db.insert(processedSourceEvents)
    .values({
      id: "pse-review-1" as ProcessedSourceEventId,
      userId: USER_ID,
      sourceFamily: "email",
      sourceId: "email_gmail",
      sourceEventId: "ext-source-review-1",
      status: "needs_review",
      failureReason: null,
      subject: "Bancolombia alert",
      rawBodyPreview: "Pago por revisar",
      rawBody: "Pago por revisar",
      retryCount: 0,
      nextRetryAt: null,
      transactionId: null,
      confidence: 0.42,
      receivedAt: NOW,
      processedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      ...overrides,
    })
    .run();
}

function insertReviewCandidate(overrides: ReviewCandidateOverrides = {}) {
  db.insert(reviewCandidates)
    .values({
      id: "rc-review-1" as ReviewCandidateId,
      userId: USER_ID,
      processedSourceEventId: "pse-review-1" as ProcessedSourceEventId,
      status: "pending",
      candidateKind: "transaction",
      occurredAt: NOW,
      amount: 450000 as CopAmount,
      currency: "COP",
      description: "Pago tarjeta de crédito",
      confidence: 0.42,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      ...overrides,
    })
    .run();
}

describe("financial meaning review", () => {
  it("marks a reviewed low-confidence email as success without deleting the linked transaction", async () => {
    insertEmailTransactionRow();
    await insertNeedsReviewEmail();

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

  it("does not list legacy processed emails as financial meaning review items", async () => {
    reviewCandidateTransactions.forEach(insertEmailTransactionRow);
    await Promise.all(reviewCandidateEmails.map(insertNeedsReviewEmail));

    await expect(getFinancialMeaningReviewItems(db as any, USER_ID)).resolves.toEqual([]);
  });

  it("lists source-event needs-review candidates in the financial meaning queue", async () => {
    insertNeedsReviewSourceEvent();
    insertReviewCandidate();

    await expect(getFinancialMeaningReviewItems(db as any, USER_ID)).resolves.toEqual([
      expect.objectContaining({
        kind: "source_event",
        processedSourceEvent: expect.objectContaining({ id: "pse-review-1" }),
        reviewCandidate: expect.objectContaining({ id: "rc-review-1" }),
      }),
    ]);
  });

  it("loads needs-review email source events only when a pending review candidate exists", async () => {
    insertNeedsReviewSourceEvent();
    insertNeedsReviewSourceEvent({
      id: "pse-review-without-candidate" as ProcessedSourceEventId,
      sourceEventId: "ext-source-review-without-candidate",
    });
    insertReviewCandidate();
    insertReviewCandidate({
      id: "rc-review-rejected" as ReviewCandidateId,
      processedSourceEventId: "pse-review-without-candidate" as ProcessedSourceEventId,
      status: "rejected",
    });

    await expect(getNeedsReviewEmailSourceEvents(db as any, USER_ID)).resolves.toEqual([
      expect.objectContaining({ id: "pse-review-1" }),
    ]);
  });

  it("resolving a missing review item is a no-op", async () => {
    await expect(
      resolveFinancialMeaningReview(db as any, "pe-missing" as ProcessedEmailId)
    ).resolves.toBeUndefined();
  });

  it("resolves orphaned review items by clearing needs-review status even without a transaction", async () => {
    await insertNeedsReviewEmail({
      id: "pe-orphan" as ProcessedEmailId,
      externalId: "ext-orphan",
      subject: "Orphan review",
      rawBodyPreview: "No transaction attached",
      transactionId: null,
      confidence: 0.31,
    });

    await resolveFinancialMeaningReview(db as any, "pe-orphan" as ProcessedEmailId);

    expect(await getProcessedEmailById(db as any, "pe-orphan" as ProcessedEmailId)).toEqual(
      expect.objectContaining({
        id: "pe-orphan",
        status: "success",
        transactionId: null,
      })
    );
  });

  it("dismisses a low-confidence email by skipping the capture and superseding the provisional transaction", async () => {
    insertEmailTransactionRow({
      id: "tx-2" as TransactionId,
      amount: 98000 as CopAmount,
      description: "Cobro no rastreable",
    });
    await insertNeedsReviewEmail({
      id: "pe-2" as ProcessedEmailId,
      externalId: "ext-2",
      subject: "Unknown sender",
      rawBodyPreview: "No es gasto",
      transactionId: "tx-2" as TransactionId,
      confidence: 0.41,
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
  });

  it("dismissing a missing review item is a no-op when using default dependencies", async () => {
    await expect(
      dismissFinancialMeaningReview(db as any, "pe-missing" as ProcessedEmailId)
    ).resolves.toBeUndefined();
  });

  it("dismisses orphaned review items without trying to supersede a missing transaction", async () => {
    await insertNeedsReviewEmail({
      id: "pe-missing-tx" as ProcessedEmailId,
      externalId: "ext-missing-tx",
      subject: "Missing linked transaction",
      rawBodyPreview: "No longer exists",
      transactionId: "tx-missing" as TransactionId,
      confidence: 0.29,
    });

    await dismissFinancialMeaningReview(db as any, "pe-missing-tx" as ProcessedEmailId);

    expect(await getProcessedEmailById(db as any, "pe-missing-tx" as ProcessedEmailId)).toEqual(
      expect.objectContaining({
        id: "pe-missing-tx",
        status: "skipped",
        transactionId: null,
      })
    );
  });

  it("dismisses a source-event review candidate through source-event status", async () => {
    insertNeedsReviewSourceEvent();
    insertReviewCandidate();

    await dismissSourceEventFinancialMeaningReview(
      db as any,
      USER_ID,
      "pse-review-1" as ProcessedSourceEventId,
      "rc-review-1" as ReviewCandidateId,
      () => "2026-04-19T11:00:00.000Z" as IsoDateTime
    );

    expect(db.select().from(processedSourceEvents).all()).toEqual([
      expect.objectContaining({
        id: "pse-review-1",
        status: "dismissed",
        updatedAt: "2026-04-19T11:00:00.000Z",
      }),
    ]);
    expect(db.select().from(reviewCandidates).all()).toEqual([
      expect.objectContaining({
        id: "rc-review-1",
        status: "rejected",
        updatedAt: "2026-04-19T11:00:00.000Z",
      }),
    ]);
  });

  it("dismisses only the selected review candidate when sibling candidates remain", async () => {
    insertNeedsReviewSourceEvent();
    insertReviewCandidate();
    insertReviewCandidate({
      id: "rc-review-2" as ReviewCandidateId,
      description: "Second possible meaning",
    });

    await dismissSourceEventFinancialMeaningReview(
      db as any,
      USER_ID,
      "pse-review-1" as ProcessedSourceEventId,
      "rc-review-1" as ReviewCandidateId,
      () => "2026-04-19T11:00:00.000Z" as IsoDateTime
    );

    expect(db.select().from(processedSourceEvents).all()).toEqual([
      expect.objectContaining({
        id: "pse-review-1",
        status: "needs_review",
        updatedAt: "2026-04-19T11:00:00.000Z",
      }),
    ]);
    expect(db.select().from(reviewCandidates).orderBy(reviewCandidates.id).all()).toEqual([
      expect.objectContaining({
        id: "rc-review-1",
        status: "rejected",
        updatedAt: "2026-04-19T11:00:00.000Z",
      }),
      expect.objectContaining({
        id: "rc-review-2",
        status: "pending",
      }),
    ]);
  });

  it("confirms a source-event review candidate as an unresolved transaction", async () => {
    insertNeedsReviewSourceEvent();
    insertReviewCandidate();

    await expect(
      confirmSourceEventFinancialMeaningReview(db as any, {
        userId: USER_ID,
        processedSourceEventId: "pse-review-1" as ProcessedSourceEventId,
        reviewCandidateId: "rc-review-1" as ReviewCandidateId,
        now: () => "2026-04-19T11:00:00.000Z" as IsoDateTime,
      })
    ).resolves.toBe(true);

    expect(db.select().from(processedSourceEvents).all()).toEqual([
      expect.objectContaining({
        id: "pse-review-1",
        status: "processed",
        transactionId: expect.any(String),
      }),
    ]);
    expect(db.select().from(reviewCandidates).all()).toEqual([
      expect.objectContaining({
        id: "rc-review-1",
        status: "accepted",
      }),
    ]);
  });

  it("accepting one source-event review candidate rejects pending sibling candidates", async () => {
    insertNeedsReviewSourceEvent();
    insertReviewCandidate();
    insertReviewCandidate({
      id: "rc-review-2" as ReviewCandidateId,
      description: "Second possible meaning",
    });

    await expect(
      confirmSourceEventFinancialMeaningReview(db as any, {
        userId: USER_ID,
        processedSourceEventId: "pse-review-1" as ProcessedSourceEventId,
        reviewCandidateId: "rc-review-1" as ReviewCandidateId,
        now: () => "2026-04-19T11:00:00.000Z" as IsoDateTime,
      })
    ).resolves.toBe(true);

    expect(db.select().from(processedSourceEvents).all()).toEqual([
      expect.objectContaining({
        id: "pse-review-1",
        status: "processed",
        transactionId: expect.any(String),
      }),
    ]);
    expect(db.select().from(reviewCandidates).orderBy(reviewCandidates.id).all()).toEqual([
      expect.objectContaining({
        id: "rc-review-1",
        status: "accepted",
      }),
      expect.objectContaining({
        id: "rc-review-2",
        status: "rejected",
      }),
    ]);
  });
});

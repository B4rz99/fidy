// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  dismissFinancialMeaningReview,
  getFinancialMeaningReviewItems,
  resolveFinancialMeaningReview,
} from "@/features/email-capture/lib/financial-meaning-review";
import {
  getNeedsReviewEmails,
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
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import type { LocalLedgerReviewCandidateId } from "@/local-ledger/public";

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

function insertReviewCandidate(overrides: { readonly id?: LocalLedgerReviewCandidateId } = {}) {
  const processedSourceEventId = "pse-1" as ProcessedSourceEventId;
  db.insert(processedSourceEvents)
    .values({
      id: processedSourceEventId,
      userId: USER_ID,
      sourceFamily: "email",
      sourceId: "email_gmail",
      sourceEventId: "ext-candidate",
      status: "needs_review",
      failureReason: null,
      receivedAt: NOW,
      processedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    })
    .run();
  db.insert(reviewCandidates)
    .values({
      id: overrides.id ?? ("rc-1" as LocalLedgerReviewCandidateId),
      userId: USER_ID,
      processedSourceEventId,
      status: "pending",
      candidateKind: "transaction",
      occurredAt: "2026-04-18T00:00:00.000Z" as IsoDateTime,
      amount: 450000 as CopAmount,
      currency: "COP",
      description: "Pago tarjeta",
      confidence: 0.52,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    })
    .run();
}

describe("financial meaning review", () => {
  it("does not resolve legacy processed-email review rows", async () => {
    insertEmailTransactionRow();
    await insertNeedsReviewEmail();

    await resolveFinancialMeaningReview(db as any, "pe-1" as ProcessedEmailId);

    expect(await getNeedsReviewEmails(db as any, USER_ID)).toEqual([]);
    expect(await getProcessedEmailByExternalId(db as any, "ext-1")).toEqual(
      expect.objectContaining({
        id: "pe-1",
        status: "needs_review",
        transactionId: "tx-1",
      })
    );
  });

  it("does not list legacy processed-email review rows", async () => {
    reviewCandidateTransactions.forEach(insertEmailTransactionRow);
    await Promise.all(reviewCandidateEmails.map(insertNeedsReviewEmail));

    await expect(getFinancialMeaningReviewItems(db as any)).resolves.toEqual([]);
  });

  it("lists pending Local Ledger review candidates without a processed email transaction", async () => {
    insertReviewCandidate();

    await expect(getFinancialMeaningReviewItems(db as any, USER_ID)).resolves.toEqual([
      expect.objectContaining({
        processedEmail: expect.objectContaining({
          id: "rc-1",
          transactionId: null,
          reviewCandidateId: "rc-1",
          processedSourceEventId: "pse-1",
        }),
        transaction: expect.objectContaining({
          id: "rc-1",
          amount: 450000,
          description: "Pago tarjeta",
          accountAttributionState: "unresolved",
          source: "email_capture",
        }),
      }),
    ]);
  });

  it("resolving a missing review item is a no-op", async () => {
    await expect(
      resolveFinancialMeaningReview(db as any, "pe-missing" as ProcessedEmailId)
    ).resolves.toBeUndefined();
  });

  it("accepts Local Ledger review candidates through the resolution model", async () => {
    insertReviewCandidate();

    await resolveFinancialMeaningReview(db as any, "rc-1" as unknown as ProcessedEmailId);

    expect(db.select().from(reviewCandidates).all()).toEqual([
      expect.objectContaining({ id: "rc-1", status: "accepted" }),
    ]);
    expect(db.select().from(processedSourceEvents).all()).toEqual([
      expect.objectContaining({ id: "pse-1", status: "processed" }),
    ]);
    expect(
      sqlite.prepare("select amount, category_id, description, source from transactions").all()
    ).toEqual([
      expect.objectContaining({
        amount: 450000,
        category_id: "other",
        description: "Pago tarjeta",
        source: "email_capture",
      }),
    ]);
  });

  it("dismisses Local Ledger review candidates through the resolution model", async () => {
    insertReviewCandidate();

    await dismissFinancialMeaningReview(db as any, "rc-1" as unknown as ProcessedEmailId, {
      now: () => "2026-04-19T11:00:00.000Z" as IsoDateTime,
    });

    expect(db.select().from(reviewCandidates).all()).toEqual([
      expect.objectContaining({ id: "rc-1", status: "rejected" }),
    ]);
    expect(db.select().from(processedSourceEvents).all()).toEqual([
      expect.objectContaining({ id: "pse-1", status: "dismissed" }),
    ]);
  });

  it("leaves orphaned legacy review rows unchanged", async () => {
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
        status: "needs_review",
        transactionId: null,
      })
    );
  });

  it("dismisses a legacy review row by superseding only its provisional transaction", async () => {
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

    expect(await getNeedsReviewEmails(db as any, USER_ID)).toEqual([]);
    expect(await getProcessedEmailById(db as any, "pe-2" as ProcessedEmailId)).toEqual(
      expect.objectContaining({
        id: "pe-2",
        status: "needs_review",
        transactionId: "tx-2",
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

  it("leaves orphaned legacy review rows unchanged on dismissal", async () => {
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
        status: "needs_review",
        transactionId: "tx-missing",
      })
    );
  });
});

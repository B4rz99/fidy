import type { CaptureEvidenceRow, CaptureEvidenceSeed } from "@/features/capture-evidence/public";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import type { TransactionRow } from "@/features/transactions/query.public";
import type {
  CreateReviewCandidateInput,
  RecordTransactionInput,
  RecordTransactionResult,
} from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import type { AppClock } from "@/shared/effect/clock";
import type { AppTelemetry } from "@/shared/effect/telemetry";
import type {
  CategoryId,
  IsoDateTime,
  ProcessedEmailId,
  ProcessedSourceEventId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import type { ProcessedEmailRow, ProcessedSourceEventRow } from "../../lib/repository";
import type { RawEmail } from "../../schema";
import type { ParseContext } from "../create-parse-email-service";
import type { LlmParsedTransaction } from "../llm-parser";

export type {
  CategoryId,
  IsoDateTime,
  ProcessedEmailId,
  ProcessedSourceEventId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
export type { ProcessedEmailRow, ProcessedSourceEventRow } from "../../lib/repository";
export type { RawEmail } from "../../schema";
export type { LlmParsedTransaction } from "../llm-parser";

export type PipelineResult = {
  filtered: number;
  skippedDuplicate: number;
  skippedCrossSource: number;
  saved: number;
  failed: number;
  pendingRetry: number;
  needsReview: number;
  parseImprovementRequests: readonly EmailParseImprovementRequest[];
};

export type EmailParseImprovementRequest = {
  readonly rawText: string;
  readonly source: "email_gmail" | "email_outlook";
  readonly status: "failed" | "needs_review";
  readonly confidence: number | null;
  readonly parseMethod: "llm";
};

export type ProgressCallback = (progress: {
  total: number;
  completed: number;
  saved: number;
  failed: number;
  needsReview: number;
}) => void;

export type RetryResult = {
  retried: number;
  succeeded: number;
  permanentlyFailed: number;
};

export type CreateEmailPipelineServiceDeps = {
  readonly parseEmailApi: (
    body: string,
    options?: { readonly parseContext?: ParseContext }
  ) => Promise<LlmParsedTransaction | null>;
  readonly parseContext?: ParseContext;
  readonly lookupMerchantRule: (
    db: AnyDb,
    userId: UserId,
    merchantKey: string
  ) => Promise<CategoryId | null>;
  readonly findDuplicateTransaction: (input: {
    readonly db: AnyDb;
    readonly userId: UserId;
    readonly amount: LlmParsedTransaction["amount"];
    readonly date: LlmParsedTransaction["date"];
    readonly merchant: string;
  }) => Promise<TransactionId | null>;
  readonly getProcessedEmailSourceEventIds: (
    db: AnyDb,
    userId: UserId,
    sourceEvents: readonly { readonly sourceId: string; readonly sourceEventId: string }[]
  ) => Promise<Set<string>>;
  readonly getPendingRetryEmailSourceEvents: (
    db: AnyDb,
    userId: UserId
  ) => Promise<readonly ProcessedSourceEventRow[]>;
  readonly insertProcessedEmail: (db: AnyDb, row: ProcessedEmailRow) => Promise<void>;
  readonly insertProcessedEmailSourceEvent: (
    db: AnyDb,
    row: ProcessedSourceEventRow
  ) => Promise<void>;
  readonly markSourceEventForRetry: (input: {
    readonly db: AnyDb;
    readonly id: ProcessedSourceEventId;
    readonly retryCount: number;
    readonly nextRetryAt: IsoDateTime;
  }) => Promise<void>;
  readonly markSourceEventPermanentlyFailed: (
    db: AnyDb,
    id: ProcessedSourceEventId
  ) => Promise<void>;
  readonly markSourceEventRetrySuccess: (input: {
    readonly db: AnyDb;
    readonly id: ProcessedSourceEventId;
    readonly status: "processed" | "needs_review" | "duplicate";
    readonly transactionId: TransactionId | null;
    readonly confidence: number;
  }) => Promise<void>;
  readonly updateProcessedSourceEventStatus: (input: {
    readonly db: AnyDb;
    readonly id: ProcessedSourceEventId;
    readonly status: string;
    readonly transactionId: TransactionId | null;
    readonly rawBody?: string | null;
  }) => Promise<void>;
  readonly buildEmailCaptureEvidence: (input: {
    readonly from: string;
    readonly body?: string;
    readonly fromAccountHint?: string;
    readonly toAccountHint?: string;
    readonly cardProductHint?: string;
    readonly accountTypeHint?: string;
    readonly counterpartyHint?: string;
  }) => readonly CaptureEvidenceSeed[];
  readonly saveCaptureEvidenceRows: (
    db: AnyDb,
    rows: readonly CaptureEvidenceRow[]
  ) => void | Promise<void>;
  readonly linkCaptureEvidenceToTransaction: (
    db: AnyDb,
    input: {
      readonly processedEmailId: ProcessedEmailId;
      readonly processedSourceEventId?: ProcessedSourceEventId | null;
      readonly transactionId: TransactionId;
      readonly updatedAt: IsoDateTime;
    }
  ) => void | Promise<void>;
  readonly ensureDefaultFinancialAccount: (
    db: AnyDb,
    userId: UserId,
    options?: { now?: IsoDateTime }
  ) => FinancialAccountRow;
  readonly insertTransaction: (db: AnyDb, row: TransactionRow) => void | Promise<void>;
  readonly recordTransaction?: (input: RecordTransactionInput) => Promise<RecordTransactionResult>;
  readonly createReviewCandidate?: (
    db: AnyDb,
    input: CreateReviewCandidateInput
  ) => Promise<{ readonly success: true } | { readonly success: false; readonly error: string }>;
  readonly insertMerchantRule: (
    db: AnyDb,
    userId: UserId,
    merchantKey: string,
    categoryId: CategoryId,
    createdAt: IsoDateTime
  ) => Promise<void>;
  readonly trackTransactionCreated: (input: {
    type: LlmParsedTransaction["type"];
    category: string;
    source: "email";
  }) => void | Promise<void>;
  readonly clock?: AppClock;
  readonly telemetry?: AppTelemetry;
  readonly parseRateLimit?: {
    readonly delayMs?: number;
    readonly concurrency?: number | null;
    readonly sleep?: (delayMs: number) => Promise<void>;
  };
  readonly maxCandidateEmails?: number;
};

export type EmailPipelineService = {
  readonly processEmails: (
    db: AnyDb,
    userId: UserId,
    rawEmails: RawEmail[],
    onProgress?: ProgressCallback
  ) => Promise<PipelineResult>;
  readonly processRetries: (db: AnyDb, userId: UserId) => Promise<RetryResult>;
};

export type ProcessEmails = EmailPipelineService["processEmails"];
export type ProcessRetries = EmailPipelineService["processRetries"];

export type EmailSaveStatus = "success" | "needs_review";

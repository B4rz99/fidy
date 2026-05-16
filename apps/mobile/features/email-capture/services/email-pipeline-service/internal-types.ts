import type { Effect } from "effect";
import type { CaptureEvidenceSeed } from "@/features/capture-evidence/public";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
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
import type {
  CreateEmailPipelineServiceDeps,
  EmailParseImprovementRequest,
  EmailSaveStatus,
  LlmParsedTransaction,
  PipelineResult,
  ProcessedEmailRow,
  ProgressCallback,
  RawEmail,
  RetryResult,
} from "./public-types";

export type PipelineRuntime = {
  readonly runClockEffect: <A>(effect: Effect.Effect<A, unknown, AppClock>) => Promise<A>;
  readonly runTelemetryEffect: <A>(effect: Effect.Effect<A, unknown, AppTelemetry>) => Promise<A>;
  readonly runEmailEffect: <A>(
    effect: Effect.Effect<A, unknown, CreateEmailPipelineServiceDeps>
  ) => Promise<A>;
  readonly runEmailWithClock: <A>(
    effect: Effect.Effect<A, unknown, CreateEmailPipelineServiceDeps | AppClock>
  ) => Promise<A>;
  readonly parseRateLimit: {
    readonly delayMs: number;
    readonly concurrency: number | null;
    readonly sleep: (delayMs: number) => Promise<void>;
  };
  readonly maxCandidateEmails?: number;
};

export type CaptureEvidenceRowsInput = {
  readonly userId: UserId;
  readonly from: string;
  readonly body?: string;
  readonly fromAccountHint?: string;
  readonly toAccountHint?: string;
  readonly cardProductHint?: string;
  readonly accountTypeHint?: string;
  readonly counterpartyHint?: string;
  readonly processedEmailId: ProcessedEmailId | null;
  readonly processedSourceEventId?: ProcessedSourceEventId | null;
  readonly transactionId: TransactionId | null;
  readonly now: IsoDateTime;
  readonly buildEmailCaptureEvidence: (input: {
    readonly from: string;
    readonly body?: string;
    readonly fromAccountHint?: string;
    readonly toAccountHint?: string;
    readonly cardProductHint?: string;
    readonly accountTypeHint?: string;
    readonly counterpartyHint?: string;
  }) => readonly CaptureEvidenceSeed[];
};

export type CaptureEvidenceSaveInput = Omit<
  CaptureEvidenceRowsInput,
  "buildEmailCaptureEvidence"
> & {
  readonly db: AnyDb;
};

export type LinkCaptureEvidenceInput = {
  readonly db: AnyDb;
  readonly processedEmailId: ProcessedEmailId;
  readonly processedSourceEventId?: ProcessedSourceEventId | null;
  readonly transactionId: TransactionId;
  readonly updatedAt: IsoDateTime;
};

export type MerchantRuleEffectInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly merchantKey: string;
  readonly categoryId: CategoryId;
  readonly createdAt: IsoDateTime;
};

export type SourceEventRetryScheduleEffectInput = {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly retryCount: number;
  readonly nextRetryAt: IsoDateTime;
};

export type SourceEventRetrySuccessEffectInput = {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly status: "processed" | "needs_review" | "duplicate";
  readonly transactionId: TransactionId | null;
  readonly confidence: number;
};

export type ProcessedSourceEventStatusEffectInput = {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly status: string;
  readonly transactionId: TransactionId | null;
  readonly rawBody?: string | null;
};

export type DefaultAccountInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly now: IsoDateTime;
};

export type SaveTransactionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly parsed: LlmParsedTransaction;
  readonly email: RawEmail;
  readonly status: EmailSaveStatus;
};

export type RetryEmailSnapshot = Omit<ProcessedEmailRow, "id"> & {
  readonly id: string;
};

export type SaveRetryTransactionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly parsed: LlmParsedTransaction;
  readonly email: RetryEmailSnapshot;
  readonly processedSourceEventId?: ProcessedSourceEventId;
};

export type PersistedTransactionContext = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly parsed: LlmParsedTransaction;
  readonly categoryId: CategoryId;
  readonly source: "email_gmail" | "email_outlook";
  readonly now: IsoDateTime;
  readonly txId: TransactionId;
  readonly defaultAccount: FinancialAccountRow;
};

export type EmailTransactionContext = PersistedTransactionContext & {
  readonly email: RawEmail;
  readonly status: EmailSaveStatus;
  readonly processedEmailId: ProcessedEmailId | null;
  readonly processedSourceEventId: ProcessedSourceEventId;
};

export type RetryTransactionContext = PersistedTransactionContext & {
  readonly email: RetryEmailSnapshot;
  readonly status: EmailSaveStatus;
  readonly processedSourceEventId?: ProcessedSourceEventId;
};

export type ProcessEmailsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly rawEmails: RawEmail[];
  readonly onProgress?: ProgressCallback;
};

export type ProcessRetriesInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
};

export type EmailBatchPlan = {
  readonly toProcess: RawEmail[];
  readonly dedupedInBatch: number;
  readonly skippedAlreadyProcessed: number;
  readonly result: PipelineResult;
  readonly total: number;
};

export type EmailBatchContext = {
  readonly runtime: PipelineRuntime;
  readonly db: AnyDb;
  readonly userId: UserId;
  parseStarts: number;
  parseStartGate: Promise<void>;
  persistenceGate: Promise<void>;
};

export type RetryBatchContext = {
  readonly runtime: PipelineRuntime;
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly result: RetryResult;
};

export type EmailQueue = {
  readonly emails: RawEmail[];
  nextIdx: number;
};

export type IncomingParseOutcome =
  | { readonly kind: "parsed"; readonly parsed: LlmParsedTransaction }
  | { readonly kind: "filtered" }
  | { readonly kind: "failed" };

export type IncomingEmailOutcome = {
  readonly result: PipelineResult;
  readonly parseDurationMs: number;
  readonly persistenceDurationMs: number;
  readonly savedTransaction: boolean;
};

export type IncomingEmailPersistenceOutcome = {
  readonly result: PipelineResult;
  readonly persistenceDurationMs: number;
  readonly savedTransaction: boolean;
};

export type DuplicateLookupOutcome =
  | { readonly kind: "new" }
  | { readonly kind: "duplicate"; readonly transactionId: TransactionId }
  | { readonly kind: "failed" };

export type RetryParseOutcome =
  | { readonly kind: "parsed"; readonly parsed: LlmParsedTransaction }
  | { readonly kind: "retry" }
  | { readonly kind: "skipped" };

export type RetryDuplicateOutcome =
  | { readonly kind: "new" }
  | { readonly kind: "duplicate"; readonly transactionId: TransactionId }
  | { readonly kind: "retry" };

export type UnparsedIncomingEmailKind = Exclude<IncomingParseOutcome["kind"], "parsed">;
export type EmailMetric =
  | "filtered"
  | "skippedCrossSource"
  | "saved"
  | "failed"
  | "pendingRetry"
  | "needsReview";

export type AppendEmailParseImprovementRequestInput = {
  readonly result: PipelineResult;
  readonly request: EmailParseImprovementRequest;
};

export type UnparsedProcessedEmailRowInput = {
  readonly email: RawEmail;
  readonly processedEmailId: ProcessedEmailId;
  readonly createdAt: IsoDateTime;
  readonly status: "pending_retry" | "skipped";
  readonly failureReason: string | null;
  readonly nextRetryAt: IsoDateTime | null;
};

export type UnparsedProcessedSourceEventRowInput = Omit<
  UnparsedProcessedEmailRowInput,
  "processedEmailId" | "status"
> & {
  readonly userId: UserId;
  readonly processedSourceEventId: ProcessedSourceEventId;
  readonly status: "pending_retry" | "dismissed";
};

export type DuplicateProcessedEmailRowInput = {
  readonly email: RawEmail;
  readonly processedEmailId: ProcessedEmailId;
  readonly transactionId: TransactionId;
  readonly confidence: number;
  readonly createdAt: IsoDateTime;
};

export type DuplicateProcessedSourceEventRowInput = Omit<
  DuplicateProcessedEmailRowInput,
  "processedEmailId"
> & {
  readonly userId: UserId;
  readonly processedSourceEventId: ProcessedSourceEventId;
};

export type TrackSavedTransactionInput = {
  readonly parsed: LlmParsedTransaction;
  readonly categoryId: CategoryId;
};

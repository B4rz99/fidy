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
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import type {
  CreateEmailPipelineServiceDeps,
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
    readonly sleep: (delayMs: number) => Promise<void>;
  };
};

export type CaptureEvidenceRowsInput = {
  readonly userId: UserId;
  readonly from: string;
  readonly fromAccountHint?: string;
  readonly toAccountHint?: string;
  readonly processedEmailId: ProcessedEmailId;
  readonly transactionId: TransactionId | null;
  readonly now: IsoDateTime;
  readonly buildEmailCaptureEvidence: (input: {
    readonly from: string;
    readonly fromAccountHint?: string;
    readonly toAccountHint?: string;
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

export type RetryScheduleEffectInput = {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly retryCount: number;
  readonly nextRetryAt: IsoDateTime;
};

export type RetrySuccessEffectInput = {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly status: EmailSaveStatus;
  readonly transactionId: TransactionId;
  readonly confidence: number;
};

export type ProcessedEmailStatusEffectInput = {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly status: string;
  readonly transactionId: TransactionId | null;
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

export type SaveRetryTransactionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly parsed: LlmParsedTransaction;
  readonly email: ProcessedEmailRow;
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
  readonly processedEmailId: ProcessedEmailId;
};

export type RetryTransactionContext = PersistedTransactionContext & {
  readonly email: ProcessedEmailRow;
  readonly status: EmailSaveStatus;
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
  readonly result: PipelineResult;
  readonly total: number;
  readonly onProgress?: ProgressCallback;
  completed: number;
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
export type EmailMetric = "filtered" | "skippedCrossSource" | "saved" | "failed" | "needsReview";

export type UnparsedProcessedEmailRowInput = {
  readonly email: RawEmail;
  readonly processedEmailId: ProcessedEmailId;
  readonly createdAt: IsoDateTime;
  readonly status: "pending_retry" | "skipped";
  readonly failureReason: string | null;
  readonly nextRetryAt: IsoDateTime | null;
};

export type DuplicateProcessedEmailRowInput = {
  readonly email: RawEmail;
  readonly processedEmailId: ProcessedEmailId;
  readonly transactionId: TransactionId;
  readonly confidence: number;
  readonly createdAt: IsoDateTime;
};

export type TrackSavedTransactionInput = {
  readonly parsed: LlmParsedTransaction;
  readonly categoryId: CategoryId;
  readonly status: EmailSaveStatus;
};

export type IncomingEmailPersistenceInput = {
  readonly context: EmailBatchContext;
  readonly email: RawEmail;
  readonly row: ProcessedEmailRow;
  readonly processedEmailId: ProcessedEmailId;
  readonly transactionId: TransactionId | null;
  readonly createdAt: IsoDateTime;
};

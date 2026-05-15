import {
  buildEmailCaptureEvidence,
  linkCaptureEvidenceToTransaction,
  saveCaptureEvidenceRows,
} from "@/features/capture-evidence/public";
import { findDuplicateTransaction } from "@/features/capture-sources/lib/dedup";
import { ensureDefaultFinancialAccount } from "@/features/financial-accounts/public";
import { insertTransaction } from "@/features/transactions/lib/repository";
import {
  type CreateReviewCandidateInput,
  createReviewCandidateUseCase,
} from "@/local-ledger/public";
import { createWriteThroughMutationModule } from "@/mutations";
import type { AnyDb } from "@/shared/db";
import { trackTransactionCreated } from "@/shared/lib/analytics";
import type { UserId } from "@/shared/types/branded";
import { insertMerchantRule, lookupMerchantRule } from "../lib/merchant-rules";
import {
  getPendingRetryEmails,
  getProcessedExternalIds,
  insertProcessedEmail,
  markForRetry,
  markPermanentlyFailed,
  markRetrySuccess,
  updateProcessedEmailStatus,
} from "../lib/repository";
import type { RawEmail } from "../schema";
import {
  createEmailPipelineService,
  type PipelineResult,
  type ProcessEmails,
  type ProcessRetries,
  type ProgressCallback,
  type RetryResult,
} from "./create-email-pipeline-service";
import { retryableParseEmailApi } from "./parse-email-api";

export type { PipelineResult, ProcessEmails, ProcessRetries, ProgressCallback, RetryResult };

const FOREGROUND_PARSE_START_DELAY_MS = 0;
const BACKGROUND_PARSE_START_DELAY_MS = 0;
const INITIAL_SYNC_PARSE_START_DELAY_MS = 0;
const PARSE_CONCURRENCY = 15;

const emailPipelineDeps = {
  parseEmailApi: retryableParseEmailApi,
  lookupMerchantRule,
  findDuplicateTransaction,
  getProcessedExternalIds,
  getPendingRetryEmails,
  insertProcessedEmail,
  markForRetry,
  markPermanentlyFailed,
  markRetrySuccess,
  updateProcessedEmailStatus,
  buildEmailCaptureEvidence,
  saveCaptureEvidenceRows,
  linkCaptureEvidenceToTransaction,
  ensureDefaultFinancialAccount,
  insertTransaction,
  insertMerchantRule,
  trackTransactionCreated,
  createReviewCandidate: (db: AnyDb, input: CreateReviewCandidateInput) =>
    createReviewCandidateUseCase({
      commit: (command) => createWriteThroughMutationModule(db).commit(command as never),
    })(input),
};

const emailPipeline = createEmailPipelineService({
  ...emailPipelineDeps,
  parseRateLimit: {
    delayMs: FOREGROUND_PARSE_START_DELAY_MS,
    concurrency: PARSE_CONCURRENCY,
  },
});

const backgroundEmailPipeline = createEmailPipelineService({
  ...emailPipelineDeps,
  parseRateLimit: {
    delayMs: BACKGROUND_PARSE_START_DELAY_MS,
    concurrency: PARSE_CONCURRENCY,
  },
});

const initialSyncEmailPipeline = createEmailPipelineService({
  ...emailPipelineDeps,
  parseContext: "initial_sync",
  parseRateLimit: {
    delayMs: INITIAL_SYNC_PARSE_START_DELAY_MS,
    concurrency: PARSE_CONCURRENCY,
  },
});

export const processEmails: ProcessEmails = (
  db: AnyDb,
  userId: UserId,
  rawEmails: RawEmail[],
  onProgress?: ProgressCallback
) => emailPipeline.processEmails(db, userId, rawEmails, onProgress);

export const processBackgroundEmails: ProcessEmails = (
  db: AnyDb,
  userId: UserId,
  rawEmails: RawEmail[],
  onProgress?: ProgressCallback
) => backgroundEmailPipeline.processEmails(db, userId, rawEmails, onProgress);

export const processInitialSyncEmails: ProcessEmails = (
  db: AnyDb,
  userId: UserId,
  rawEmails: RawEmail[],
  onProgress?: ProgressCallback
) => initialSyncEmailPipeline.processEmails(db, userId, rawEmails, onProgress);

export const processRetries: ProcessRetries = (db: AnyDb, userId: UserId) =>
  emailPipeline.processRetries(db, userId);

import { findDuplicateTransaction } from "@/features/capture-sources/lib/dedup";
import { insertTransaction } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
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
import { parseEmailApi } from "./parse-email-api";

export type { PipelineResult, ProcessEmails, ProcessRetries, ProgressCallback, RetryResult };

const emailPipeline = createEmailPipelineService({
  parseEmailApi,
  lookupMerchantRule,
  findDuplicateTransaction,
  getProcessedExternalIds,
  getPendingRetryEmails,
  insertProcessedEmail,
  markForRetry,
  markPermanentlyFailed,
  markRetrySuccess,
  updateProcessedEmailStatus,
  insertTransaction,
  enqueueSync,
  insertMerchantRule,
  trackTransactionCreated,
});

export const processEmails: ProcessEmails = (
  db: AnyDb,
  userId: UserId,
  rawEmails: RawEmail[],
  onProgress?: ProgressCallback
) => emailPipeline.processEmails(db, userId, rawEmails, onProgress);

export const processRetries: ProcessRetries = (db: AnyDb, userId: UserId) =>
  emailPipeline.processRetries(db, userId);
